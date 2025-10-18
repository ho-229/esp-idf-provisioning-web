import * as proto from '../generated/proto.js';
import { ESPScanStatusResponse, ESPWifiAp } from '../types.js';
import { bytesToHex, bytesToString } from '../utils/crypto.js';
import { wifiAuthModeToESPWifiAuthMode } from './protocol.js';

export function getScanStartRequest(
  blocking: boolean = true,
  passive: boolean = false,
  groupChannels: number = 5,
  periodMs: number = 120
): Uint8Array {
  let cmd = proto.CmdScanStart.create({});
  cmd.blocking = blocking;
  cmd.passive = passive;
  cmd.groupChannels = groupChannels;
  cmd.periodMs = periodMs;
  const scanRequest = proto.WiFiScanPayload.create({
    msg: proto.WiFiScanMsgType.TypeCmdScanStart,
    cmdScanStart: cmd,
  });
  return proto.WiFiScanPayload.encode(scanRequest).finish();
}

export function processScanStartResponse(response: Uint8Array): void {
  try {
    const scanResponse = proto.WiFiScanPayload.decode(response);
    if (scanResponse.status !== proto.Status.Success) {
      throw new Error(`Scan start failed: ${scanResponse.status}`);
    }
  } catch (error) {
    console.error('Error processing scan start response:', error);
  }
}

export function getScanStatusRequest(): Uint8Array {
  const scanRequest = proto.WiFiScanPayload.create({
    msg: proto.WiFiScanMsgType.TypeCmdScanStatus,
    cmdScanStatus: proto.CmdScanStatus.create({}),
  });
  return proto.WiFiScanPayload.encode(scanRequest).finish();
}

export function processScanStatusResponse(response: Uint8Array): ESPScanStatusResponse {
  try {
    const scanResponse = proto.WiFiScanPayload.decode(response);
    if (scanResponse.status !== proto.Status.Success) {
      throw new Error(`Scan status failed: ${scanResponse.status}`);
    }
    const result = scanResponse.respScanStatus as proto.RespScanStatus;
    return {
      scanFinished: result.scanFinished,
      count: result.resultCount,
    };
  } catch (error) {
    throw new Error('Failed to decode scan status response');
  }
}

export function getScanResultRequest(index: number, count: number): Uint8Array {
  let cmd = proto.CmdScanResult.create({});
  cmd.startIndex = index;
  cmd.count = count;
  const scanRequest = proto.WiFiScanPayload.create({
    msg: proto.WiFiScanMsgType.TypeCmdScanResult,
    cmdScanResult: cmd,
  });
  return proto.WiFiScanPayload.encode(scanRequest).finish();
}

export function processScanResultResponse(response: Uint8Array): ESPWifiAp[] {
  try {
    const scanResponse = proto.WiFiScanPayload.decode(response);
    if (scanResponse.status !== proto.Status.Success) {
      throw new Error(`Scan result failed: ${scanResponse.status}`);
    }
    const result = scanResponse.respScanResult as proto.RespScanResult;
    const wifiList: ESPWifiAp[] = result.entries.map((entity) => {
      const wifi = entity as proto.WiFiScanResult;
      return {
        ssid: bytesToString(wifi.ssid),
        rssi: wifi.rssi,
        auth: wifiAuthModeToESPWifiAuthMode(wifi.auth),
        bssid: bytesToHex(wifi.bssid),
        channel: wifi.channel,
      };
    });
    return wifiList;
  } catch (error) {
    throw new Error('Failed to decode scan result response');
  }
}
