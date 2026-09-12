import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const scryptOptions = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, scryptOptions, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = await deriveKey(password, salt);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt" ||
    !/^[A-Za-z0-9_-]+$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[2])
  ) {
    return false;
  }

  const expected = Buffer.from(parts[2], "base64url");
  if (expected.length !== keyLength) return false;

  const actual = await deriveKey(password, parts[1]);
  return timingSafeEqual(actual, expected);
}
