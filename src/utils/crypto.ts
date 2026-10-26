/**
 * Cryptographic utilities for ESP provisioning protocol
 */

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert string to Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * SHA-256 hash function
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return new Uint8Array(hashBuffer);
}

/**
 * HMAC-SHA-256
 */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new Uint8Array(data));
  return new Uint8Array(signature);
}

/**
 * AES-CTR encryption
 */
export async function aesEncrypt(
  key: Uint8Array,
  counter: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: new Uint8Array(counter), length: 128 },
    cryptoKey,
    new Uint8Array(data)
  );
  return new Uint8Array(encrypted);
}

/**
 * AES-CTR decryption
 */
export async function aesDecrypt(
  key: Uint8Array,
  counter: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'AES-CTR' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: new Uint8Array(counter), length: 128 },
    cryptoKey,
    new Uint8Array(data)
  );
  return new Uint8Array(decrypted);
}

/**
 * Concatenate multiple Uint8Arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/** Stateful AES-CTR, preserving partial blocks across requests and responses. */
export class AESCTRStream {
  private offset = 0;

  private constructor(private key: CryptoKey, private counter: Uint8Array<ArrayBuffer>) {}

  static async create(key: Uint8Array, counter: Uint8Array): Promise<AESCTRStream> {
    if (key.length !== 32 || counter.length !== 16) throw new Error('Invalid AES-256-CTR parameters');
    const cryptoKey = await crypto.subtle.importKey(
      'raw', new Uint8Array(key), 'AES-CTR', false, ['encrypt']
    );
    return new AESCTRStream(cryptoKey, new Uint8Array(counter));
  }

  async update(data: Uint8Array): Promise<Uint8Array> {
    // Web Crypto restarts at a block boundary. Skip the already-consumed bytes
    // of the current block to match mbedTLS's continuous stream in both directions.
    const input = new Uint8Array(this.offset + data.length);
    input.set(data, this.offset);
    const output = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: this.counter, length: 128 }, this.key, input
    );
    const result = new Uint8Array(output).slice(this.offset);
    let blocks = Math.floor(input.length / 16);
    for (let i = this.counter.length - 1; i >= 0 && blocks > 0; i--) {
      const sum = this.counter[i] + blocks;
      this.counter[i] = sum & 0xff;
      blocks = Math.floor(sum / 256);
    }
    this.offset = input.length % 16;
    return result;
  }
}
