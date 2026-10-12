import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts the church account's refresh token before it is stored, so a leaked
 * database backup alone is not enough to reach the church's Drive.
 *
 * AES-256-GCM both encrypts and authenticates: decrypting with the wrong key,
 * or data that was tampered with, throws instead of returning garbage.
 */

const VERSION = "v1";
const IV_BYTES = 12;

function parseKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded. Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, base64Key: string): string {
  // A fresh random IV every time: reusing one with the same key breaks GCM.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", parseKey(base64Key), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(".");
}

export function decryptSecret(encrypted: string, base64Key: string): string {
  const [version, iv, tag, ciphertext] = encrypted.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Encrypted value is not in a recognised format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    parseKey(base64Key),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
