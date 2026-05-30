import crypto from "node:crypto";

export function hashPassword(password: string, salt?: string) {
  const realSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, realSalt, 120_000, 32, "sha256").toString("hex");
  return { salt: realSalt, hash };
}

export function verifyPassword(input: {
  password: string;
  salt?: string | null;
  hash?: string | null;
}) {
  if (!input.salt || !input.hash) return false;
  const { hash } = hashPassword(input.password, input.salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(String(input.hash)));
}

export function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
