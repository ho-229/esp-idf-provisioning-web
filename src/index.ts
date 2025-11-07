/**
 * ESP-IDF Provisioning Web SDK
 *
 * A TypeScript library for provisioning ESP32 devices via Web Bluetooth API and HTTP.
 * Supports both BLE and SoftAP transport modes with Security0, Security1, and Security2.
 *
 * Note: Browser limitations apply:
 * - BLE requires user interaction to select devices
 * - SoftAP requires manual WiFi connection by the user
 * - Some security features may require additional crypto libraries for production use
 */

export { ESPDevice } from './ESPDevice';
export { ESPProvisionManager } from './ESPProvisionManager';

export {
  ESPWifiAuthMode,
  ESPWifiStaState,
  ESPConnectFailReason,
  type ESPDeviceInterface,
  type ESPSecurity1Config,
  type ESPSecurity2Config,
  type ESPWifiAp,
  type ESPWifiStatus,
} from './types';

export {
  FALLBACK_SERVICE_UUID,
  DEFAULT_DEVICE_PREFIX,
} from './constants';
