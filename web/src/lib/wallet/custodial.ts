import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// Custodial wallets: we generate and hold the worker/issuer keys so non-crypto
// users aren't blocked by seed phrases. Keys are encrypted at rest with
// AES-256-GCM (authenticated encryption — detects tampering on decrypt).
const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY;
  if (!raw) throw new Error("WALLET_ENCRYPTION_KEY is not set");
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  }
  return buf;
}

export type EncryptedKey = {
  encryptedPrivateKey: string; // hex ciphertext
  iv: string; // hex (12-byte nonce)
  authTag: string; // hex (GCM authentication tag)
};

export type NewWallet = EncryptedKey & { address: string };

/** Create a fresh wallet and return its address + encrypted private key. */
export function createWallet(): NewWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, ...encrypt(privateKey) };
}

export function encrypt(plaintext: string): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    encryptedPrivateKey: enc.toString("hex"),
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

/** Decrypt a stored wallet key back into a usable private key. */
export function decryptPrivateKey(rec: EncryptedKey): Hex {
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(rec.iv, "hex"));
  decipher.setAuthTag(Buffer.from(rec.authTag, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(rec.encryptedPrivateKey, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8") as Hex;
}
