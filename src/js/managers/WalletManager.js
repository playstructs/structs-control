import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Secp256k1, sha256 } from "@cosmjs/crypto";

/**
 * Wallet derivation + signing primitive. Ported verbatim from
 * references/structs-webapp/src/js/managers/WalletManager.js with TypeScript
 * adjustments removed -- behaviour is unchanged.
 *
 * The mnemonic IS sensitive. WalletManager keeps it in memory only; persistence
 * is owned by `store/session.js` (which writes to sessionStorage, never local).
 */
export class WalletManager {
  constructor() {
    this.textEncoder = new TextEncoder();
  }

  /**
   * @param {string} mnemonic
   * @returns {Promise<DirectSecp256k1HdWallet>}
   */
  async createWallet(mnemonic) {
    return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "structs" });
  }

  /**
   * SHA256-then-secp256k1 signature, hex-encoded to fixed length. Mirrors the
   * webapp's `createSignatureForProxyMessage`.
   *
   * @param {string} message
   * @param {Uint8Array} privateKey
   * @returns {Promise<string>}
   */
  async signMessage(message, privateKey) {
    const digest = sha256(this.textEncoder.encode(message));
    const signature = await Secp256k1.createSignature(digest, privateKey);
    return this.bytesToHex(signature.toFixedLength());
  }

  /**
   * @param {Uint8Array} byteArray
   * @returns {string}
   */
  bytesToHex(byteArray) {
    let out = "";
    for (const b of byteArray) {
      out += (b & 0xff).toString(16).padStart(2, "0");
    }
    return out;
  }
}
