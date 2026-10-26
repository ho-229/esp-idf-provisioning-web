import {
  ESPDeviceInterface,
  ESPWifiAp,
  ESPWifiStatus,
  ESPSecurityConfig,
  ESPSecurityResolver,
  ESPProvisioningInfo,
} from './types';
import { Transport } from './transport/Transport';
import { BLETransport } from './transport/BLETransport';
import { SoftAPTransport } from './transport/SoftAPTransport';
import { Security } from './security/Security';
import { Security0 } from './security/Security0';
import { Security1 } from './security/Security1';
import { bytesToString, stringToBytes } from './utils/crypto';
import { FALLBACK_NU_LOOKUP, FALLBACK_SERVICE_UUID, PROTO_ENDPOINTS } from './constants';
import {
  getScanResultRequest,
  getScanStartRequest,
  getScanStatusRequest,
  processScanResultResponse,
  processScanStartResponse,
  processScanStatusResponse,
} from './protocol/wifiScan';
import {
  getConfigApplyRequest,
  getConfigStatusRequest,
  getConfigUpdateRequest,
  processConfigApplyResponse,
  processConfigStatusResponse,
  processConfigUpdateResponse,
} from './protocol/wifiConfig';

/**
 * ESP Device class for provisioning operations
 */
export class ESPDevice implements ESPDeviceInterface {
  private device: BluetoothDevice | URL;
  private transportImpl?: Transport;
  private securityImpl?: Security;
  private requestQueue: Promise<void> = Promise.resolve();

  /**
   * Create a new ESPDevice instance
   * @param device - BluetoothDevice for BLE or URL for SoftAP
   */
  constructor(device: BluetoothDevice | URL) {
    this.device = device;
  }

  /** Connect, read public metadata, resolve credentials, then complete the handshake. */
  async connect(security?: ESPSecurityConfig | ESPSecurityResolver): Promise<void> {
    if (this.transportImpl) throw new Error('Device already connected or connecting');
    const transport = this.device instanceof URL
      ? new SoftAPTransport(this.device.toString())
      : new BLETransport(this.device, FALLBACK_SERVICE_UUID, new Map(Object.entries(FALLBACK_NU_LOOKUP)));
    this.transportImpl = transport;
    try {
      await transport.connect();
      const response = await transport.sendData(PROTO_ENDPOINTS.PROTO_VER, stringToBytes('ESP'));
      const info: ESPProvisioningInfo = JSON.parse(bytesToString(response));
      if (!info || !info.prov || typeof info.prov !== 'object' || Array.isArray(info.prov)) {
        throw new Error('Invalid proto-ver metadata');
      }
      if (this.transportImpl !== transport || !transport.isConnected()) {
        throw new Error('Device disconnected during discovery');
      }
      const config = typeof security === 'function' ? await security(info) : security;
      if (this.transportImpl !== transport || !transport.isConnected()) {
        throw new Error('Device disconnected while resolving security');
      }
      const version = config?.type === 'Security1' ? 1 : config?.type === 'Security2' ? 2 : 0;
      if (info.prov.sec_ver !== undefined && info.prov.sec_ver !== version) {
        throw new Error(`Device requires Security${info.prov.sec_ver}; provide a matching security configuration`);
      }
      let session: Security;
      if (!config) {
        session = new Security0();
      } else if (config.type === 'Security1') {
        session = new Security1(config.proofOfPossession, info.prov.sec_patch_ver);
      } else {
        throw new Error('Unsupported security configuration');
      }
      await this.establishSession(transport, session);
      if (this.transportImpl !== transport || !transport.isConnected()) {
        throw new Error('Device disconnected during handshake');
      }
      this.securityImpl = session;
    } catch (error) {
      if (this.transportImpl === transport) this.disconnect();
      throw error;
    }
  }

  /**
   * Scan for available WiFi networks
   * @returns List of WiFi networks
   */
  async scanWifiList(): Promise<ESPWifiAp[]> {
    if (!this.transportImpl || !this.securityImpl) {
      throw new Error('Device not connected');
    }

    try {
      const scanRequest = getScanStartRequest();
      const scanResponse = await this.sendData(PROTO_ENDPOINTS.PROV_SCAN, scanRequest);
      processScanStartResponse(scanResponse);

      const scanStatusRequest = getScanStatusRequest();
      const scanStatusResponse = await this.sendData(PROTO_ENDPOINTS.PROV_SCAN, scanStatusRequest);
      const { scanFinished, count } = processScanStatusResponse(scanStatusResponse);
      if (!scanFinished) {
        throw new Error('WiFi scan should have finished');
      }

      let wifiList: ESPWifiAp[] = [];
      for (let i = 0; i < count; i++) {
        const scanResultRequest = getScanResultRequest(i, 1);
        const scanResultResponse = await this.sendData(
          PROTO_ENDPOINTS.PROV_SCAN,
          scanResultRequest
        );
        const list = processScanResultResponse(scanResultResponse);
        wifiList = wifiList.concat(list);
      }
      return wifiList;
    } catch (error) {
      throw new Error(`WiFi scan failed: ${error}`);
    }
  }

  /**
   * Provision device with WiFi credentials
   * @note Call fetchWifiStatus() after provisioning to check provisioning status
   * @param ssid - WiFi network SSID
   * @param passphrase - WiFi network password
   */
  async provision(ssid: string, passphrase: string): Promise<void> {
    if (!this.transportImpl || !this.securityImpl) {
      throw new Error('Device not connected');
    }

    try {
      const configRequest = getConfigUpdateRequest(ssid, passphrase);
      const configResponse = await this.sendData(PROTO_ENDPOINTS.PROV_CONFIG, configRequest);
      processConfigUpdateResponse(configResponse);

      const applyRequest = getConfigApplyRequest();
      const applyResponse = await this.sendData(PROTO_ENDPOINTS.PROV_CONFIG, applyRequest);
      processConfigApplyResponse(applyResponse);
    } catch (error) {
      throw new Error(`Provisioning failed: ${error}`);
    }
  }

  /**
   * Fetch WiFi status from device
   * @returns WiFi status
   */
  async fetchWifiStatus(): Promise<ESPWifiStatus> {
    if (!this.transportImpl || !this.securityImpl) {
      throw new Error('Device not connected');
    }

    try {
      const statusRequest = getConfigStatusRequest();
      const statusResponse = await this.sendData(PROTO_ENDPOINTS.PROV_CONFIG, statusRequest);
      return processConfigStatusResponse(statusResponse);
    } catch (error) {
      throw new Error(`Fetching WiFi status failed: ${error}`);
    }
  }

  /**
   * Send custom data to device
   * @param path - Data endpoint path
   * @param data - Data to send
   * @returns Response data from device
   */
  async sendData(path: string, data: Uint8Array): Promise<Uint8Array> {
    const transport = this.transportImpl;
    const security = this.securityImpl;
    if (!transport || !security?.isEstablished()) throw new Error('Device not connected');
    if (path === PROTO_ENDPOINTS.PROV_SESSION) throw new Error('Session endpoint is managed by connect()');

    // Security1 shares one CTR stream in both directions. Serialize the entire
    // request/response pair, including custom endpoints.
    const request = this.requestQueue.then(async () => {
      if (this.transportImpl !== transport || this.securityImpl !== security || !transport.isConnected()) {
        throw new Error('Device disconnected');
      }
      try {
        if (path === PROTO_ENDPOINTS.PROTO_VER) return await transport.sendData(path, data);
        const encrypted = await security.encrypt(data);
        const response = await transport.sendData(path, encrypted);
        return await security.decrypt(response);
      } catch (error) {
        // A lost response leaves the shared cipher position unknown.
        if (this.transportImpl === transport) this.disconnect();
        throw error;
      }
    });
    this.requestQueue = request.then(() => {}, () => {});
    return request;
  }

  /**
   * Disconnect from device
   */
  disconnect(): void {
    if (this.transportImpl) {
      this.transportImpl.disconnect();
      this.transportImpl = undefined;
    }
    this.securityImpl = undefined;
    this.requestQueue = Promise.resolve();
  }

  /**
   * Get device
   */
  getDevice(): BluetoothDevice | URL {
    return this.device;
  }

  private async establishSession(transport: Transport, security: Security): Promise<void> {
    while (!security.isEstablished()) {
      if (this.transportImpl !== transport || !transport.isConnected()) {
        throw new Error('Device disconnected during handshake');
      }
      const request = await security.getSessionSetupRequest();
      const response = await transport.sendData(PROTO_ENDPOINTS.PROV_SESSION, request);
      await security.processSessionSetupResponse(response);
    }
  }
}
