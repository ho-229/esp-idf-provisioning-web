# ESP-IDF Provisioning Web SDK

A TypeScript SDK for provisioning ESP32 devices from web browsers using the ESP-IDF provisioning protocol. Supports both BLE (Web Bluetooth) and SoftAP (HTTP) transport modes.

## Features

- [ ] **Multiple Security Modes**
  - [ ] Security1 (not implemented)
  - [ ] Security2 (not implemented)
- [x] **BLE Transport**: Uses Web Bluetooth API for wireless provisioning
- [x] **SoftAP Transport**: HTTP-based provisioning for devices in AP mode
- [x] **Provisioning Protocol**: Supports ESP-IDF provisioning protocol for WiFi credentials
  - [x] Scan APs
  - [x] Provision device status monitoring
  - [ ] Reset and re-provisioning
  - [ ] Custom endpoints

## Browser Compatibility

- **BLE Mode**: Requires browsers with Web Bluetooth API support (Chrome, Edge, Opera)
- **SoftAP Mode**: Works in all modern browsers (user must manually connect to WiFi)

## Installation

```bash
npm install esp-idf-provisioning-web
```

## Usage

### BLE Provisioning

```typescript
import { ESPProvisionManager } from 'esp-idf-provisioning-web';

// Search for devices with BLE
const device = await ESPProvisionManager.searchBLEDevice();

// Connect with proof of possession
await device.connect();

// Scan for WiFi networks
const wifiList = await device.scanWifiList();

// Provision the device
await device.provision('MyWiFiSSID', 'MyWiFiPassword');

// Wait for STA connected
let result;
do {
  result = await device.fetchWifiStatus();
  await new Promise((resolve) => setTimeout(resolve, 2000));
} while (result.staState !== ESPWifiStaState.connecting);

if (result.staState === ESPWifiStaState.connected) {
  console.log('Provisioning successful!');
} else {
  console.log('Provisioning failed:', result);
}

// Disconnect
device.disconnect();
```

### SoftAP Provisioning

**Important**: The browser cannot automatically connect to WiFi networks. Users must manually connect to the ESP device's access point before running this code.

```typescript
import { ESPProvisionManager } from 'esp-idf-provisioning-web';

// Create device instance for SoftAP
// User should already be connected to the device's WiFi network
const device = ESPProvisionManager.createSoftAPDevice(new URL('http://192.168.4.1'));

// Connect and provision
await device.connect();
await device.provision('MyWiFiSSID', 'MyWiFiPassword');
```

### Check Bluetooth Support

```typescript
// Check if Web Bluetooth is available
if (ESPProvisionManager.isBluetoothSupported()) {
  const isAvailable = await ESPProvisionManager.getBluetoothAvailability();
  console.log('Bluetooth available:', isAvailable);
}
```

## Browser Limitations

### BLE Mode
- Requires user interaction (button click) to initiate device scanning
- User must manually select device from browser's device picker
- HTTPS or localhost required for Web Bluetooth API
- Service UUID must be filled in optionalServiceUUIDs for some browsers

### SoftAP Mode
- Browser cannot connect to WiFi networks programmatically
- User must manually connect to ESP device's access point
- CORS may need to be configured on the ESP device
- May not work on all networks due to browser security restrictions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT

## References

- [ESP-IDF Provisioning Protocol](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/provisioning/provisioning.html)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [React Native ESP-IDF Provisioning](https://github.com/orbital-systems/react-native-esp-idf-provisioning)
