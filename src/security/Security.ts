/**
 * Base class for security implementations
 */
export abstract class Security {
  /**
   * Encrypt data for transmission
   */
  abstract encrypt(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Decrypt received data
   */
  abstract decrypt(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Get session setup request data
   */
  abstract getSessionSetupRequest(): Promise<Uint8Array>;

  /**
   * Process session setup response
   */
  abstract processSessionSetupResponse(response: Uint8Array): Promise<void>;

  /**
   * Check if security is established
   */
  abstract isEstablished(): boolean;
}
