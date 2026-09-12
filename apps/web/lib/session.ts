import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "bonanzbar_session";
export const sessionMaxAgeSeconds = 60 * 60 * 8;

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "replace-this-before-production" || secret.length < 32) {
    throw new Error("AUTH_SECRET muss mindestens 32 Zeichen lang sein.");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function isSessionPayload(value: unknown): value is SessionPayload {
  return Boolean(
    value &&
    typeof value === "object" &&
    "userId" in value &&
    "expiresAt" in value &&
    typeof value.userId === "string" &&
    typeof value.expiresAt === "number" &&
    value.userId.length > 0 &&
    Number.isSafeInteger(value.expiresAt),
  );
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string): SessionPayload | undefined {
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[1])
  ) {
    return undefined;
  }

  const expectedSignature = sign(parts[0]);
  if (
    parts[1].length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expectedSignature))
  ) {
    return undefined;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }

  if (!isSessionPayload(payload) || payload.expiresAt <= Math.floor(Date.now() / 1000)) {
    return undefined;
  }
  return payload;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function initialAdminSetupEnabled(): boolean {
  return Boolean(process.env.INITIAL_ADMIN_SETUP_TOKEN);
}

export function validInitialAdminSetupToken(token: string): boolean {
  const expected = process.env.INITIAL_ADMIN_SETUP_TOKEN;
  if (!expected) return false;
  const providedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
