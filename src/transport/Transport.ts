/**
 * Base class for transport implementations
 */
export abstract class Transport {
  /**
   * Connect to the device
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the device
   */
  abstract disconnect(): void;

  /**
   * Send data to a specific endpoint
   */
  abstract sendData(endpoint: string, data: Uint8Array): Promise<Uint8Array>;

  /**
   * Check if transport is connected
   */
  abstract isConnected(): boolean;
}
