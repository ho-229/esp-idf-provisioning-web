const path = require('node:path');
const protobuf = require('protobufjs');
const { ESPDevice, ESPProvisionManager, FALLBACK_SERVICE_UUID } = require('../dist/index.cjs.js');

const SessionData = protobuf.loadSync(path.join(__dirname, '../src/proto/session.proto')).lookupType('SessionData');
const CUSTOM_UUID = '55cc035e-fb27-4f80-be02-3c60828b7451';
const OTHER_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
const encode = text => new TextEncoder().encode(text);
const decode = bytes => new TextDecoder().decode(bytes);
const dataView = bytes => new DataView(Uint8Array.from(bytes).buffer);
const notFound = () => new DOMException('Not found', 'NotFoundError');
const sessionResponse = () => SessionData.encode({
  secVer: 0, sec0: { msg: 1, sr: { status: 0 } },
}).finish();

function createService(uuid, endpoints = ['proto-ver', 'prov-session', 'custom-data'], options = {}) {
  const writes = [];
  const characteristics = endpoints.map((endpoint, index) => {
    let response;
    return {
      // Deliberately use different assignments from the old ff51/ff52/ff53 table.
      uuid: uuid.slice(0, 4) + (0xa100 + index).toString(16) + uuid.slice(8),
      getDescriptors: jest.fn(async () => {
        if (options.descriptorError) throw options.descriptorError;
        if (options.noDescriptors) throw notFound();
        const bytes = encode(options.sliced ? '!' + endpoint + '?' : endpoint);
        return [{
          uuid: '00002901-0000-1000-8000-00805f9b34fb',
          readValue: async () => options.sliced
            ? new DataView(bytes.buffer, 1, bytes.byteLength - 2)
            : dataView(bytes),
        }];
      }),
      async writeValueWithResponse(bytes) {
        writes.push(endpoint);
        if (endpoint === 'proto-ver') {
          response = encode(JSON.stringify({ prov: { sec_ver: 0 } }));
        } else if (endpoint === 'prov-session') {
          const request = SessionData.decode(bytes);
          expect(request.secVer).toBe(0);
          expect(request.sec0).toBeDefined();
          response = sessionResponse();
        } else {
          response = encode('reply:' + decode(bytes));
        }
      },
      async readValue() { return dataView(response); },
    };
  });
  return {
    uuid, characteristics, writes,
    async getCharacteristics() {
      if (!characteristics.length) throw notFound();
      return characteristics;
    },
    async getCharacteristic(id) {
      // Do not let a mock accept abbreviated UUID strings that Web Bluetooth rejects.
      expect(id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
      const characteristic = characteristics.find(item => item.uuid === id);
      if (!characteristic) throw notFound();
      return characteristic;
    },
  };
}

function createDevice(services = [createService(CUSTOM_UUID)], authorized = services.map(s => s.uuid)) {
  const grants = new Set(authorized);
  const gatt = {
    connected: false,
    async connect() { this.connected = true; return this; },
    disconnect() { this.connected = false; },
    getPrimaryServices: jest.fn(async id => {
      if (id && !grants.has(id)) throw new DOMException('Not authorized', 'SecurityError');
      const matches = services.filter(service => grants.has(service.uuid) && (!id || id === service.uuid));
      if (!matches.length) throw notFound();
      return matches;
    }),
  };
  class NativeLikeDevice extends EventTarget {
    get name() { return 'PROV_test'; }
    get gatt() { return gatt; }
  }
  return { native: Object.freeze(new NativeLikeDevice()), gatt, grants, services };
}

async function roundTrip(device, fixture) {
  expect(device.getDevice()).toBe(fixture.native);
  await device.connect();
  expect(decode(await device.sendData('custom-data', encode('hello')))).toBe('reply:hello');
  device.disconnect();
  expect(fixture.gatt.connected).toBe(false);
}

async function expectConnectionFailure(fixture, message) {
  await expect(new ESPDevice(fixture.native).connect()).rejects.toThrow(message);
  expect(fixture.gatt.connected).toBe(false);
  expect(fixture.services.flatMap(service => service.writes)).toEqual([]);
}

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
beforeEach(() => jest.spyOn(console, 'debug').mockImplementation(() => {}));
afterEach(() => {
  jest.restoreAllMocks();
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else delete globalThis.navigator;
});

test.each([FALLBACK_SERVICE_UUID, CUSTOM_UUID])('discovers endpoints and completes Security0 over %s', async uuid => {
  const fixture = createDevice([createService(uuid)]);
  await roundTrip(new ESPDevice(fixture.native), fixture);
});

test('prefers the default service when multiple services are authorized', async () => {
  const fixture = createDevice([createService(CUSTOM_UUID), createService(FALLBACK_SERVICE_UUID)]);
  await roundTrip(new ESPDevice(fixture.native), fixture);
  expect(fixture.gatt.getPrimaryServices.mock.calls).toEqual([[FALLBACK_SERVICE_UUID]]);
  expect(fixture.services[0].writes).toEqual([]);
});

test.each([false, true])('discovers a custom service when the default is absent (default authorized: %s)', async authorized => {
  const fixture = createDevice();
  if (authorized) fixture.grants.add(FALLBACK_SERVICE_UUID);
  await roundTrip(new ESPDevice(fixture.native), fixture);
  expect(fixture.gatt.getPrimaryServices.mock.calls).toEqual([[FALLBACK_SERVICE_UUID], []]);
});

describe.each([FALLBACK_SERVICE_UUID, CUSTOM_UUID])('endpoint validation for %s', uuid => {
  test('rejects a service without user descriptions', async () => {
    await expectConnectionFailure(createDevice([createService(uuid, undefined, { noDescriptors: true })]), /No provisioning service/);
  });
  test.each(['prov-session', 'proto-ver'])('rejects a service missing %s', async missing => {
    const endpoints = ['proto-ver', 'prov-session', 'custom-data'].filter(name => name !== missing);
    await expectConnectionFailure(createDevice([createService(uuid, endpoints)]), /No provisioning service/);
  });
});

test('skips services with no characteristics or no endpoint descriptions', async () => {
  const fixture = createDevice([
    createService('f0cc035e-fb27-4f80-be02-3c60828b7451', []),
    createService(OTHER_UUID, ['battery-level'], { noDescriptors: true }),
    createService(CUSTOM_UUID),
  ]);
  await roundTrip(new ESPDevice(fixture.native), fixture);
});

test('does not merge endpoint names across services', async () => {
  await expectConnectionFailure(createDevice([
    createService(CUSTOM_UUID, ['proto-ver']),
    createService(OTHER_UUID, ['prov-session']),
  ]), /No provisioning service/);
});

test('reads descriptions within the returned DataView bounds', async () => {
  const fixture = createDevice([createService(CUSTOM_UUID, undefined, { sliced: true })]);
  await roundTrip(new ESPDevice(fixture.native), fixture);
});

test('reuses the discovered mapping for subsequent requests', async () => {
  const service = createService(CUSTOM_UUID);
  const fixture = createDevice([service]);
  const device = new ESPDevice(fixture.native);
  await device.connect();
  for (let i = 0; i < 3; i++) {
    expect(decode(await device.sendData('custom-data', encode('hello')))).toBe('reply:hello');
  }
  for (const characteristic of service.characteristics) {
    expect(characteristic.getDescriptors).toHaveBeenCalledTimes(1);
  }
  device.disconnect();
});

test('fails and disconnects when no service is authorized', async () => {
  await expectConnectionFailure(createDevice([createService(CUSTOM_UUID)], []), /Not found/);
});

test('propagates connection errors without attempting another discovery', async () => {
  const fixture = createDevice();
  fixture.gatt.getPrimaryServices.mockRejectedValue(new DOMException('Disconnected', 'NetworkError'));
  await expectConnectionFailure(fixture, /Disconnected/);
  expect(fixture.gatt.getPrimaryServices).toHaveBeenCalledTimes(1);
});

test('propagates descriptor discovery errors and cleans up', async () => {
  await expectConnectionFailure(createDevice([createService(CUSTOM_UUID, undefined, {
    descriptorError: new DOMException('Descriptor failure', 'NetworkError'),
  })]), /Descriptor failure/);
});

test('can retry after failed endpoint discovery', async () => {
  const fixture = createDevice([createService(CUSTOM_UUID, ['custom-data'])]);
  const device = new ESPDevice(fixture.native);
  await expect(device.connect()).rejects.toThrow(/No provisioning service/);
  expect(fixture.gatt.connected).toBe(false);
  fixture.services.splice(0, 1, createService(CUSTOM_UUID));
  await roundTrip(device, fixture);
});

function mockPicker(fixture) {
  const requestDevice = jest.fn(async options => {
    const services = [
      ...(options.optionalServices ?? []),
      ...(options.filters ?? []).flatMap(filter => filter.services ?? []),
    ];
    for (const uuid of services) fixture.grants.add(uuid);
    return fixture.native;
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { bluetooth: { getAvailability: async () => true, requestDevice } },
  });
  return requestDevice;
}

test('keeps the default picker options', async () => {
  const fixture = createDevice([createService(FALLBACK_SERVICE_UUID)], []);
  const requestDevice = mockPicker(fixture);
  await roundTrip(await ESPProvisionManager.searchBLEDevice(), fixture);
  expect(requestDevice).toHaveBeenCalledWith({
    filters: [{ namePrefix: 'PROV_' }, { services: [FALLBACK_SERVICE_UUID] }],
    optionalServices: [FALLBACK_SERVICE_UUID],
  });
});

test.each([
  { filters: [{ services: [CUSTOM_UUID] }] },
  { filters: [{ namePrefix: 'PROV_' }], optionalServices: [CUSTOM_UUID] },
  { acceptAllDevices: true, optionalServices: [CUSTOM_UUID] },
  { filters: [{ services: [OTHER_UUID] }], optionalServices: [CUSTOM_UUID] },
])('uses existing picker permissions without changing options: %j', async options => {
  const fixture = createDevice([
    createService(OTHER_UUID, ['battery-level'], { noDescriptors: true }),
    createService(CUSTOM_UUID),
  ], []);
  const requestDevice = mockPicker(fixture);
  Object.freeze(options);
  await roundTrip(await ESPProvisionManager.searchBLEDevice(options), fixture);
  expect(requestDevice.mock.calls[0][0]).toBe(options);
});

test('returns null when the user cancels the picker', async () => {
  mockPicker(createDevice()).mockRejectedValue(notFound());
  await expect(ESPProvisionManager.searchBLEDevice()).resolves.toBeNull();
});

test('preserves SoftAP Security0 provisioning', async () => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (url.endsWith('/proto-ver')) return new Response(JSON.stringify({ prov: { sec_ver: 0 } }));
    if (url.endsWith('/prov-session')) return new Response(sessionResponse());
    return new Response(encode('reply:' + decode(options.body)));
  });
  const url = new URL('http://device.invalid');
  const device = ESPProvisionManager.createSoftAPDevice(url);
  expect(device.getDevice()).toBe(url);
  await device.connect();
  expect(decode(await device.sendData('custom-data', encode('hello')))).toBe('reply:hello');
  device.disconnect();
});
