import { Transport } from './Transport';
// import { BLE_SERVICE_UUID, BLE_PROVISIONING_UUID, BLE_SESSION_UUID } from '../constants';
import { bytesToString } from '../utils/crypto';

/**
 * BLE Transport implementation using Web Bluetooth API
 */
export class BLETransport extends Transport {
  private device: BluetoothDevice;
  private serviceUUID: string;
  private nuLookup: Map<string, string>;

  private server?: BluetoothRemoteGATTServer;
  private service?: BluetoothRemoteGATTService;
  private connected: boolean = false;

  constructor(device: BluetoothDevice, serviceUUID: string, nuLookup: Map<string, string>) {
    super();
    this.device = device;
    this.serviceUUID = serviceUUID;
    this.nuLookup = nuLookup;
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

      // Get provisioning services
      try {
        const services = await this.server.getPrimaryServices(this.serviceUUID);
        if (services.length > 1) {
          const service = services.find((s) => s.uuid === this.serviceUUID);
          if (!service) {
            throw new Error(`Service with UUID ${this.serviceUUID} not found`);
          }
          this.service = service;
        } else {
          this.service = services[0];
        }
      } catch (error) {
        throw new Error(`Failed to get primary services: ${error}`);
      }

      const characteristics = await this.service.getCharacteristics();
      for (const char of characteristics) {
        const descriptors = await char.getDescriptors();
        for (const desc of descriptors) {
          if (desc.uuid.slice(4, 8) !== '2901') continue;
          const rawName = await desc.readValue();
          this.nuLookup.set(bytesToString(new Uint8Array(rawName.buffer)).toLowerCase(), char.uuid);
        }
      }

      console.debug('BLE discovered characteristics:', this.nuLookup);
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`BLE connection failed: ${error}`);
    }
  }

  disconnect(): void {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = undefined;
    this.service = undefined;
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
