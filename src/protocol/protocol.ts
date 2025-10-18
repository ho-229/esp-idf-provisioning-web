import * as proto from '../generated/proto.js';
import { ESPWifiAuthMode } from '../types.js';

export function wifiAuthModeToESPWifiAuthMode(mode: proto.WifiAuthMode): ESPWifiAuthMode {
  switch (mode) {
    case proto.WifiAuthMode.Open:
      return ESPWifiAuthMode.open;
    case proto.WifiAuthMode.WEP:
      return ESPWifiAuthMode.wep;
    case proto.WifiAuthMode.WPA_PSK:
      return ESPWifiAuthMode.wpaPsk;
    case proto.WifiAuthMode.WPA2_PSK:
      return ESPWifiAuthMode.wpa2Psk;
    case proto.WifiAuthMode.WPA_WPA2_PSK:
      return ESPWifiAuthMode.wpaWpa2Psk;
    case proto.WifiAuthMode.WPA2_ENTERPRISE:
      return ESPWifiAuthMode.wpa2Enterprise;
    case proto.WifiAuthMode.WPA3_PSK:
      return ESPWifiAuthMode.wpa3Psk;
    case proto.WifiAuthMode.WPA2_WPA3_PSK:
      return ESPWifiAuthMode.wpa2Wpa3Psk;
  }
}
