import { Transport } from './Transport';
import { FALLBACK_SERVICE_UUID, PROTO_ENDPOINTS } from '../constants';
import { bytesToString } from '../utils/crypto';

/**
 * BLE Transport implementation using Web Bluetooth API
 */
export class BLETransport extends Transport {
  private device: BluetoothDevice;
  private nuLookup = new Map<string, string>();

  private server?: BluetoothRemoteGATTServer;
  private service?: BluetoothRemoteGATTService;
  private connected: boolean = false;

  constructor(device: BluetoothDevice) {
    super();
    this.device = device;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    try {
      // Connect to GATT server
      this.server = await this.device.gatt?.connect();
      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      // Prefer the default service, then discover other services authorized by requestDevice().
      let services: BluetoothRemoteGATTService[];
      try {
        services = await this.server.getPrimaryServices(FALLBACK_SERVICE_UUID);
      } catch (error) {
        if (!['NotFoundError', 'SecurityError'].includes((error as Error).name)) throw error;
        services = await this.server.getPrimaryServices();
      }

      for (const service of services) {
        const nuLookup = new Map<string, string>();
        let characteristics: BluetoothRemoteGATTCharacteristic[];
        try {
          characteristics = await service.getCharacteristics();
        } catch (error) {
          if ((error as Error).name === 'NotFoundError') continue;
          throw error;
        }
        for (const char of characteristics) {
          let descriptors: BluetoothRemoteGATTDescriptor[];
          try {
            descriptors = await char.getDescriptors();
          } catch (error) {
            if ((error as Error).name === 'NotFoundError') continue;
            throw error;
          }
          for (const desc of descriptors) {
            if (desc.uuid.slice(4, 8) !== '2901') continue;
            const rawName = await desc.readValue();
            const name = bytesToString(new Uint8Array(rawName.buffer, rawName.byteOffset, rawName.byteLength));
            nuLookup.set(name.toLowerCase(), char.uuid);
          }
        }
        if (nuLookup.has(PROTO_ENDPOINTS.PROV_SESSION) && nuLookup.has(PROTO_ENDPOINTS.PROTO_VER)) {
          this.service = service;
          this.nuLookup = nuLookup;
          break;
        }
      }
      if (!this.service) throw new Error('No provisioning service found among authorized BLE services');

      console.debug('BLE discovered characteristics:', this.nuLookup);
      this.connected = true;
    } catch (error) {
      this.disconnect();
      throw new Error(`BLE connection failed: ${error}`);
    }
  }

  disconnect(): void {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = undefined;
    this.service = undefined;
    this.nuLookup.clear();
    this.connected = false;
  }

  async sendData(endpoint: string, data: Uint8Array): Promise<Uint8Array> {
    if (!this.isConnected()) {
      throw new Error('Not connected to device');
    }

    const charUUID = this.nuLookup.get(endpoint.toLowerCase());
    if (!charUUID) {
      throw new Error(`Characteristic UUID for endpoint ${endpoint} not found`);
    }

    const characteristic = await this.service?.getCharacteristic(charUUID);
    if (!characteristic) {
      throw new Error(`Characteristic for UUID ${charUUID} not found`);
    }

    // FIXME: Uint8Array have wrong generic type constraints in this case
    const cleanData = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
    await characteristic.writeValueWithResponse(cleanData);
    const response = await characteristic.readValue();
    return new Uint8Array(response.buffer);
  }

  isConnected(): boolean {
    return this.connected && this.server?.connected === true;
  }

  /**
   * Get the underlying Bluetooth device
   */
  getDevice(): BluetoothDevice {
    return this.device;
  }
}
