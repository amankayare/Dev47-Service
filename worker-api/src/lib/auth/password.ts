import crypto from "node:crypto";

export interface HashOptions {
  saltLength?: number;
}

const DEFAULT_SALT_LENGTH = 16;
const SALT_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a random alphanumeric salt matching Werkzeug's gen_salt().
 */
export function generateSalt(length = DEFAULT_SALT_LENGTH): string {
  if (length <= 0) {
    throw new Error("Salt length must be at least 1.");
  }
  const randomBytes = crypto.randomBytes(length);
  let salt = "";
  for (let i = 0; i < length; i += 1) {
    salt += SALT_CHARS[randomBytes[i] % SALT_CHARS.length];
  }
  return salt;
}

/**
 * Check if the provided plaintext password matches a stored Werkzeug hash.
 * Supports:
 * - scrypt:n:r:p$salt$hexhash (Werkzeug 2.3+ default)
 * - pbkdf2:sha256:iterations$salt$hexhash (Werkzeug pbkdf2 default)
 * - pbkdf2:sha1:iterations$salt$hexhash
 */
export function checkPasswordHash(passwordHash: string, password: string): boolean {
  if (!passwordHash || typeof passwordHash !== "string") {
    return false;
  }

  const parts = passwordHash.split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [method, salt, hashval] = parts;
  if (!method || !salt || !hashval) {
    return false;
  }

  try {
    const computedHex = hashInternal(method, salt, password);
    const computedBuf = Buffer.from(computedHex, "hex");
    const targetBuf = Buffer.from(hashval, "hex");

    if (computedBuf.length !== targetBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, targetBuf);
  } catch {
    return false;
  }
}

/**
 * Generate a Werkzeug-compatible password hash using the default scrypt method.
 * Format: scrypt:32768:8:1$<salt>$<hexhash>
 */
export function generatePasswordHash(
  password: string,
  options?: HashOptions,
): string {
  const salt = generateSalt(options?.saltLength ?? DEFAULT_SALT_LENGTH);
  const n = 32768;
  const r = 8;
  const p = 1;
  const method = `scrypt:${n}:${r}:${p}`;
  const hex = hashInternal(method, salt, password);
  return `${method}$${salt}$${hex}`;
}

function hashInternal(methodStr: string, salt: string, password: string): string {
  const [method, ...args] = methodStr.split(":");
  const saltBuf = Buffer.from(salt, "utf-8");
  const passBuf = Buffer.from(password, "utf-8");

  if (method === "scrypt") {
    let n = 32768;
    let r = 8;
    let p = 1;

    if (args.length === 3) {
      n = parseInt(args[0], 10);
      r = parseInt(args[1], 10);
      p = parseInt(args[2], 10);
      if (Number.isNaN(n) || Number.isNaN(r) || Number.isNaN(p)) {
        throw new Error("Invalid scrypt arguments");
      }
    } else if (args.length !== 0) {
      throw new Error("'scrypt' takes 3 arguments.");
    }

    const maxmem = 132 * n * r * p;
    const derivedKey = crypto.scryptSync(passBuf, saltBuf, 64, {
      N: n,
      r,
      p,
      maxmem,
    });
    return derivedKey.toString("hex");
  }

  if (method === "pbkdf2") {
    let hashName = "sha256";
    let iterations = 1000000;

    if (args.length === 1) {
      hashName = args[0];
    } else if (args.length === 2) {
      hashName = args[0];
      iterations = parseInt(args[1], 10);
      if (Number.isNaN(iterations) || iterations <= 0) {
        throw new Error("Invalid pbkdf2 iterations");
      }
    } else if (args.length > 2) {
      throw new Error("'pbkdf2' takes at most 2 arguments.");
    }

    let keylen = 32;
    if (hashName.toLowerCase() === "sha1") {
      keylen = 20;
    } else if (hashName.toLowerCase() === "sha512") {
      keylen = 64;
    }

    const derivedKey = crypto.pbkdf2Sync(
      passBuf,
      saltBuf,
      iterations,
      keylen,
      hashName,
    );
    return derivedKey.toString("hex");
  }

  throw new Error(`Invalid hash method '${method}'.`);
}
