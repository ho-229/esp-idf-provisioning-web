import * as proto from '../generated/proto.js';
import { ESPConnectFailReason, ESPWifiAp, ESPWifiStaState, ESPWifiStatus } from '../types.js';
import { bytesToHex, bytesToString, stringToBytes } from '../utils/crypto.js';
import { wifiAuthModeToESPWifiAuthMode } from './protocol.js';

export function getConfigStatusRequest(): Uint8Array {
  let configRequest = proto.WiFiConfigPayload.create({});
  configRequest.msg = proto.WiFiConfigMsgType.TypeCmdGetStatus;
  configRequest.cmdGetStatus = proto.CmdGetStatus.create({});
  return proto.WiFiConfigPayload.encode(configRequest).finish();
}

export function processConfigStatusResponse(response: Uint8Array): ESPWifiStatus {
  try {
    const configResponse = proto.WiFiConfigPayload.decode(response);
    const result = configResponse.respGetStatus as proto.RespGetStatus;
    if (result.status !== proto.Status.Success) {
      throw new Error(`Config status failed: ${result.status}`);
    }
    let staState: ESPWifiStaState;
    switch (result.staState) {
      case proto.WifiStationState.Disconnected:
        staState = ESPWifiStaState.disconnected;
        break;
      case proto.WifiStationState.Connecting:
        staState = ESPWifiStaState.connecting;
        break;
      case proto.WifiStationState.Connected:
        staState = ESPWifiStaState.connected;
        break;
      case proto.WifiStationState.ConnectionFailed:
        staState = ESPWifiStaState.failed;
        break;
    }

    let failedReason: ESPConnectFailReason | undefined;
    switch (result.failReason) {
      case proto.WifiConnectFailedReason.AuthError:
        failedReason = ESPConnectFailReason.authError;
        break;
      case proto.WifiConnectFailedReason.NetworkNotFound:
        failedReason = ESPConnectFailReason.networkNotFound;
        break;
      default:
        break;
    }

    let connected: ESPWifiAp | undefined;
    if (result.connected) {
      connected = {
        ssid: bytesToString(result.connected.ssid),
        rssi: result.connected.rssi,
        auth: wifiAuthModeToESPWifiAuthMode(result.connected.auth),
        bssid: bytesToHex(result.connected.bssid),
        channel: result.connected.channel,
      };
    }

    return {
      staState,
      failedReason,
      connected,
    };
  } catch (error) {
    throw new Error('Failed to decode config status response');
  }
}

export function getConfigUpdateRequest(ssid: string, passphrase: string): Uint8Array {
  let configRequest = proto.WiFiConfigPayload.create({});
  configRequest.msg = proto.WiFiConfigMsgType.TypeCmdSetConfig;
  configRequest.cmdSetConfig = proto.CmdSetConfig.create({
    ssid: stringToBytes(ssid),
    passphrase: stringToBytes(passphrase),
  });
  return proto.WiFiConfigPayload.encode(configRequest).finish();
}

export function processConfigUpdateResponse(response: Uint8Array): void {
  try {
    const configResponse = proto.WiFiConfigPayload.decode(response);
    const result = configResponse.respSetConfig as proto.RespSetConfig;
    if (result.status !== proto.Status.Success) {
      throw new Error(`Config update failed: ${result.status}`);
    }
  } catch (error) {
    throw new Error('Failed to decode config update response');
  }
}

export function getConfigApplyRequest(): Uint8Array {
  let configRequest = proto.WiFiConfigPayload.create({});
  configRequest.msg = proto.WiFiConfigMsgType.TypeCmdApplyConfig;
  configRequest.cmdApplyConfig = proto.CmdApplyConfig.create({});
  return proto.WiFiConfigPayload.encode(configRequest).finish();
}

export function processConfigApplyResponse(response: Uint8Array): void {
  try {
    const configResponse = proto.WiFiConfigPayload.decode(response);
    const result = configResponse.respApplyConfig as proto.RespApplyConfig;
    if (result.status !== proto.Status.Success) {
      throw new Error(`Config apply failed: ${result.status}`);
    }
  } catch (error) {
    throw new Error('Failed to decode config apply response');
  }
}
