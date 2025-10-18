import { Transport } from './Transport';

/**
 * SoftAP Transport implementation using HTTP
 * Note: Browser cannot automatically connect to WiFi networks.
 * User must manually connect to the device's SoftAP before using this transport.
 */
export class SoftAPTransport extends Transport {
  private baseUrl: string;
  private connected: boolean = false;

  /**
   * @param baseUrl - Base URL of the device (e.g., http://192.168.4.1)
   */
  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    try {
      // Verify connection by making a test request
      const response = await fetch(`${this.baseUrl}/proto-ver`, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(
        `SoftAP connection failed. Please ensure you are connected to the device's WiFi network. Error: ${error}`
      );
    }
  }

  disconnect(): void {
    this.connected = false;
  }

  async sendData(endpoint: string, data: Uint8Array): Promise<Uint8Array> {
    if (!this.connected) {
      throw new Error('Not connected to device');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data.buffer as ArrayBuffer,
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(`SoftAP communication failed: ${error}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Set custom base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
