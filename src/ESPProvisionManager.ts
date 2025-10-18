import { ESPDevice } from './ESPDevice';
import { DEFAULT_BLE_DEVICE_OPTIONS } from './constants';

/**
 * ESP Provision Manager for device discovery
 */
export class ESPProvisionManager {
  /**
   * Search for ESP devices using BLE
   * @param devicePrefix - Prefix to filter device names
   * @param transport - Transport type (only BLE supported for search)
   * @param security - Security type to use
   * @returns Promise resolving to array of discovered devices
   */
  static async searchBLEDevice(
    bleDeviceOptions: RequestDeviceOptions = DEFAULT_BLE_DEVICE_OPTIONS,
  ): Promise<ESPDevice | null> {
    // Check if Web Bluetooth is available
    const availability = await ESPProvisionManager.getBluetoothAvailability();
    if (!availability) {
      throw new Error('Web Bluetooth is not available.');
    }

    try {
      // Request Bluetooth device with filters
      const device = await navigator.bluetooth.requestDevice(bleDeviceOptions);
      if (!device.name) {
        throw new Error('Device name not available');
      }

      // Create ESPDevice instance
      return new ESPDevice(device);
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        // User cancelled the device selection
        return null;
      }
      throw new Error(`Device search failed: ${error}`);
    }
  }

  /**
   * Create an ESPDevice instance for SoftAP mode
   * Note: Browser cannot automatically connect to WiFi.
   * User must manually connect to the device's access point before using this.
   *
   * @param baseURL - Base URL for the SoftAP
   * @returns ESPDevice instance configured for SoftAP
   */
  static createSoftAPDevice(baseURL: URL): ESPDevice {
    return new ESPDevice(baseURL);
  }

  /**
   * Check if Web Bluetooth is supported
   * @returns true if Web Bluetooth is available
   */
  static isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Get Bluetooth availability status
   * @returns Promise resolving to availability status
   */
  static async getBluetoothAvailability(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      return false;
    }

    try {
      return await navigator.bluetooth.getAvailability();
    } catch (error) {
      console.error('Failed to get Bluetooth availability:', error);
      return false;
    }
  }
}
