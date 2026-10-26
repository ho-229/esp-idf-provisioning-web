import { Security } from './Security';
import * as proto from '../generated/proto.js';
import { AESCTRStream, sha256, stringToBytes } from '../utils/crypto';

/** ESP-IDF Security 1: X25519, optional PoP, and one continuous AES-CTR stream. */
export class Security1 extends Security {
  private phase: 'command0' | 'response0' | 'command1' | 'response1' | 'established' = 'command0';
  private keyPair?: CryptoKeyPair;
  private publicKey?: Uint8Array;
  private devicePublicKey?: Uint8Array;
  private cipher?: AESCTRStream;

  constructor(private proofOfPossession: string, patchVersion?: number) {
    super();
    if ((patchVersion ?? 0) !== 0) {
      throw new Error('Unsupported Security1 patch version');
    }
    if (typeof proofOfPossession !== 'string') {
      throw new Error('Unsupported security configuration');
    }
  }

  async getSessionSetupRequest(): Promise<Uint8Array> {
    if (this.phase === 'command0') {
      this.keyPair = await crypto.subtle.generateKey('X25519', false, ['deriveBits']) as CryptoKeyPair;
      this.publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', this.keyPair.publicKey));
      this.phase = 'response0';
      return proto.SessionData.encode({
        secVer: proto.SecSchemeVersion.SecScheme1,
        sec1: {
          msg: proto.Sec1MsgType.Session_Command0,
          sc0: { clientPubkey: this.publicKey },
        },
      }).finish();
    }
    if (this.phase === 'command1' && this.cipher && this.devicePublicKey) {
      const clientVerifyData = await this.cipher.update(this.devicePublicKey);
      this.phase = 'response1';
      return proto.SessionData.encode({
        secVer: proto.SecSchemeVersion.SecScheme1,
        sec1: { msg: proto.Sec1MsgType.Session_Command1, sc1: { clientVerifyData } },
      }).finish();
    }
    throw new Error('Invalid Security1 handshake state');
  }

  async processSessionSetupResponse(response: Uint8Array): Promise<void> {
    const session = proto.SessionData.decode(response);
    if (session.secVer !== proto.SecSchemeVersion.SecScheme1 || !session.sec1) {
      throw new Error('Invalid Security1 session response');
    }
    const payload = session.sec1;
    if (this.phase === 'response0' && this.keyPair) {
      const reply = payload.sr0;
      if (payload.msg !== proto.Sec1MsgType.Session_Response0 || !reply ||
          reply.status !== proto.Status.Success || reply.devicePubkey?.length !== 32 ||
          reply.deviceRandom?.length !== 16) {
        throw new Error('Invalid Security1 key exchange response');
      }
      this.devicePublicKey = new Uint8Array(reply.devicePubkey);
      const peerKey = await crypto.subtle.importKey(
        'raw', new Uint8Array(this.devicePublicKey), 'X25519', false, []
      );
      const sharedKey = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'X25519', public: peerKey }, this.keyPair.privateKey, 256
      ));
      this.keyPair = undefined;
      try {
        if (this.proofOfPossession.length > 0) {
          const hash = await sha256(stringToBytes(this.proofOfPossession));
          for (let i = 0; i < sharedKey.length; i++) sharedKey[i] ^= hash[i];
          hash.fill(0);
        }
        this.proofOfPossession = '';
        this.cipher = await AESCTRStream.create(sharedKey, reply.deviceRandom);
      } finally {
        sharedKey.fill(0);
      }
      this.phase = 'command1';
      return;
    }
    if (this.phase === 'response1' && this.cipher && this.publicKey) {
      const reply = payload.sr1;
      if (payload.msg !== proto.Sec1MsgType.Session_Response1 || !reply ||
          reply.status !== proto.Status.Success || reply.deviceVerifyData?.length !== 32) {
        throw new Error('Security1 authentication failed');
      }
      const verified = await this.cipher.update(reply.deviceVerifyData);
      let difference = 0;
      for (let i = 0; i < this.publicKey.length; i++) difference |= verified[i] ^ this.publicKey[i];
      if (difference !== 0) throw new Error('Security1 device verification failed');
      this.phase = 'established';
      return;
    }
    throw new Error('Unexpected Security1 handshake response');
  }

  async encrypt(data: Uint8Array): Promise<Uint8Array> {
    if (!this.isEstablished() || !this.cipher) throw new Error('Security1 session not established');
    return this.cipher.update(data);
  }

  async decrypt(data: Uint8Array): Promise<Uint8Array> {
    return this.encrypt(data);
  }

  isEstablished(): boolean {
    return this.phase === 'established';
  }
}
