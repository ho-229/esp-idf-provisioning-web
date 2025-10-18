import {
  ESPDeviceInterface,
  ESPWifiAp,
  ESPWifiStatus,
  ESPSecurityConfig,
} from './types';
import { Transport } from './transport/Transport';
import { BLETransport } from './transport/BLETransport';
import { SoftAPTransport } from './transport/SoftAPTransport';
import { Security } from './security/Security';
import { Security0 } from './security/Security0';
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

  /**
   * Create a new ESPDevice instance
   * @param device - BluetoothDevice for BLE or URL for SoftAP
   */
  constructor(device: BluetoothDevice | URL) {
    this.device = device;
  }

  /**
   * Connect to the device
   * @param proofOfPossession - Proof of possession for secure modes
   * @param softAPPassword - Password for SoftAP mode (not used in browser)
   * @param username - Username for authentication
   */
  async connect(security?: ESPSecurityConfig): Promise<void> {
    // Initialize transport
    await this.initializeTransport();

    // Initialize security
    this.initializeSecurity(security);

    // Establish secure session if needed
    if (security) {
      await this.establishSession();
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
   * Disconnect from device
   */
  disconnect(): void {
    if (this.transportImpl) {
      this.transportImpl.disconnect();
      this.transportImpl = undefined;
    }
    this.securityImpl = undefined;
  }

  /**
   * Get device
   */
  getDevice(): BluetoothDevice | URL {
    return this.device;
  }

  /**
   * Initialize security layer based on security type
   */
  private initializeSecurity(security?: ESPSecurityConfig): void {
    if (!security) {
      this.securityImpl = new Security0();
    } else {
      throw new Error('Unsupported security configuration');
    }
  }

  /**
   * Establish secure session with device
   */
  private async establishSession(): Promise<void> {
    if (!this.transportImpl || !this.securityImpl) {
      throw new Error('Transport or security not initialized');
    }

    // Get session setup request
    const setupRequest = await this.securityImpl.getSessionSetupRequest();

    // Send session setup request
    const setupResponse = await this.transportImpl.sendData(
      PROTO_ENDPOINTS.PROV_SESSION,
      setupRequest
    );

    // Process session setup response
    await this.securityImpl.processSessionSetupResponse(setupResponse);
  }

  /**
   * Initialize transport layer based on transport type
   */
  private async initializeTransport(): Promise<void> {
    if (this.device instanceof URL) {
      this.transportImpl = new SoftAPTransport(this.device.toString());
    } else {  // BluetoothDevice
      this.transportImpl = new BLETransport(
        this.device,
        FALLBACK_SERVICE_UUID,
        new Map(Object.entries(FALLBACK_NU_LOOKUP))
      );
    }
    await this.transportImpl.connect();
  }

  /**
   * Send custom data to device
   * @param path - Data endpoint path
   * @param data - Data to send
   * @returns Response data from device
   */
  private async sendData(path: string, data: Uint8Array): Promise<Uint8Array> {
    if (!this.transportImpl || !this.securityImpl) {
      throw new Error('Device not connected');
    }

    // Encrypt data if security is established
    const encryptedData = await this.securityImpl.encrypt(data);
    console.debug('Send encrypted data length:', encryptedData.length);

    // Send encrypted data
    const encryptedResponse = await this.transportImpl.sendData(path, encryptedData);

    // Decrypt response
    return await this.securityImpl.decrypt(encryptedResponse);
  }
}
