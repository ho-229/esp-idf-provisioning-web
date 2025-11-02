export type ESPSecurityConfig = ESPSecurity1Config | ESPSecurity2Config;

export interface ESPSecurity1Config {
  type: 'Security1';
  proofOfPossession: string;
}

export interface ESPSecurity2Config {
  type: 'Security2';
  username: string;
  password: string;
}

/**
 * WiFi authentication modes
 */
export enum ESPWifiAuthMode {
  open = 0,
  wep = 1,
  wpa2Enterprise = 2,
  wpa2Psk = 3,
  wpaPsk = 4,
  wpaWpa2Psk = 5,
  wpa3Psk = 6,
  wpa2Wpa3Psk = 7,
}

/**
 * WiFi STA state
 */
export enum ESPWifiStaState {
  connected = 0,
  connecting = 1,
  disconnected = 2,
  failed = 3,
}

/**
 * WiFi scan failure reasons
 */
export enum ESPConnectFailReason {
  authError = 1,
  networkNotFound = 2,
}

export interface ESPWifiStatus {
  staState: ESPWifiStaState;
  failedReason?: ESPConnectFailReason;
  connected?: ESPWifiAp;
}

/**
 * WiFi network information returned by device scan
 */
export interface ESPWifiAp {
  ssid: string;
  rssi: number;
  auth: ESPWifiAuthMode;
  bssid: string;
  channel: number;
}

/**
 * Scan status response
 */
export interface ESPScanStatusResponse {
  scanFinished: boolean;
  count: number;
}

/**
 * Device interface for ESP provisioning
 */
export interface ESPDeviceInterface {
  connect(security?: ESPSecurityConfig): Promise<void>;

  scanWifiList(): Promise<ESPWifiAp[]>;

  provision(ssid: string, passphrase: string): Promise<void>;

  fetchWifiStatus(): Promise<ESPWifiStatus>;

  sendData(path: string, data: Uint8Array): Promise<Uint8Array>;

  disconnect(): void;

  getDevice(): BluetoothDevice | URL;
}
