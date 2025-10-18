import { Security } from './Security';
import * as proto from '../generated/proto.js';

/**
 * Security0 - No encryption (unsecure mode)
 */
export class Security0 extends Security {
  private established: boolean = false;

  async encrypt(data: Uint8Array): Promise<Uint8Array> {
    return data;
  }

  async decrypt(data: Uint8Array): Promise<Uint8Array> {
    return data;
  }

  async getSessionSetupRequest(): Promise<Uint8Array> {
    let setupReq = proto.SessionData.create({});
    setupReq.secVer = proto.SecSchemeVersion.SecScheme0;
    setupReq.sec0 = proto.Sec0Payload.create({
      msg: proto.Sec0MsgType.S0_Session_Command,
      sc: proto.S0SessionCmd.create({})
    });
    return proto.Sec0Payload.encode(setupReq).finish();
  }

  async processSessionSetupResponse(response: Uint8Array): Promise<void> {
    const setupResp = proto.SessionData.decode(response);
    if (setupResp.secVer === proto.SecSchemeVersion.SecScheme0 && setupResp.sec0) {
      this.established = true;
    } else {
      throw new Error('Invalid session setup response for Security0');
    }
  }

  isEstablished(): boolean {
    return this.established;
  }
}
