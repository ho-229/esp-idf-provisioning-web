/**
 * Constants for ESP provisioning protocol
 */

// Protocol endpoints
export const PROTO_ENDPOINTS = {
  PROV_SESSION: 'prov-session',
  PROV_SCAN: 'prov-scan',
  PROV_CTRL: 'prov-ctrl',
  PROV_CONFIG: 'prov-config',
  PROTO_VER: 'proto-ver',
};

// Default device prefix for scanning
export const DEFAULT_DEVICE_PREFIX = 'PROV_';

// Fallback Service UUID
export const FALLBACK_SERVICE_UUID = '1775244d-6b43-439b-877c-060f2d9bed07';

export const FALLBACK_NU_LOOKUP = {
  'prov-session': 'ff51',
  'prov-config': 'ff52',
  'proto-ver': 'ff53',
};

export const DEFAULT_BLE_DEVICE_OPTIONS: RequestDeviceOptions = {
  filters: [{ namePrefix: DEFAULT_DEVICE_PREFIX }, { services: [FALLBACK_SERVICE_UUID] }],
  optionalServices: [FALLBACK_SERVICE_UUID],
};
