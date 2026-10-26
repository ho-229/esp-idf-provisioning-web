/**
 * ESP-IDF Provisioning Web SDK
 *
 * A TypeScript library for provisioning ESP32 devices via Web Bluetooth API and HTTP.
 * Supports both BLE and SoftAP transport modes with Security0 and Security1.
 *
 * Note: Browser limitations apply:
 * - BLE requires user interaction to select devices
 * - SoftAP requires manual WiFi connection by the user
 * - Security1 requires Web Crypto with X25519 support (HTTPS or localhost)
 */

export { ESPDevice } from './ESPDevice';
export { ESPProvisionManager } from './ESPProvisionManager';

export {
  ESPWifiAuthMode,
  ESPWifiStaState,
  ESPConnectFailReason,
  type ESPDeviceInterface,
  type ESPSecurityConfig,
  type ESPSecurityResolver,
  type ESPProvisioningInfo,
  type ESPProvisioningMetadata,
  type ESPSecurity1Config,
  type ESPSecurity2Config,
  type ESPWifiAp,
  type ESPWifiStatus,
} from './types';

export {
  FALLBACK_SERVICE_UUID,
  DEFAULT_DEVICE_PREFIX,
} from './constants';
