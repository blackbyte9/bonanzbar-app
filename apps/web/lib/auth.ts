import type { PriceMode, Role } from "@bonanzbar/shared";
import { hasPermission, normalizeRoles, type Permission } from "@bonanzbar/shared";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemoAuthEnabled, localDemoAccountForToken } from "@/lib/demo-mode";
import { jsonError } from "@/lib/http";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export { isDemoAuthEnabled, localDemoTokens } from "@/lib/demo-mode";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  priceMode: PriceMode;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function readCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  return cookie
    .split(";")
    .map((part) => part.trim().split("=", 2))
    .find(([key]) => key === name)?.[1];
}

function unsafeCookieRequestHasTrustedOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

function authenticatedUser(user: {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  priceMode: PriceMode;
}): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: normalizeRoles(user.roles),
    priceMode: user.priceMode,
  };
}

async function findUser(where: { id: string } | { email: string }) {
  try {
    return await prisma.user.findUnique({ where });
  } catch (error) {
    return jsonError(error);
  }
}

export async function authenticate(request: Request): Promise<AuthenticatedUser | Response> {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  const cookieToken = bearerToken ? undefined : readCookie(request, sessionCookieName);
  const session = bearerToken || cookieToken ? readSessionToken(bearerToken ?? cookieToken ?? "") : undefined;
  if (session) {
    if (cookieToken && !unsafeCookieRequestHasTrustedOrigin(request)) {
      return NextResponse.json({ error: "Die Anfrage stammt nicht von dieser Website." }, { status: 403 });
    }
    const user = await findUser({ id: session.userId });
    if (user instanceof Response) return user;
    if (!user || !user.active) return unauthorized("Dieses Konto ist nicht verfügbar.");
    return authenticatedUser(user);
  }

  const demoToken = request.headers.get("x-bonanzbar-token");
  const email = isDemoAuthEnabled() && demoToken ? localDemoAccountForToken(demoToken)?.email : undefined;
  if (!email) return unauthorized("Eine gültige Sitzung ist erforderlich.");

  const user = await findUser({ email });
  if (user instanceof Response) return user;
  if (!user) {
    return unauthorized("Die lokalen Demo-Daten fehlen. Prüfe zuerst den Development-Branch mit „npm.cmd run db:environment -- development“ und führe danach „npm.cmd run db:seed“ aus.");
  }
  if (!user.active) return unauthorized("Dieses Konto ist nicht verfügbar.");

  return authenticatedUser(user);
}

export async function requirePermission(
  request: Request,
  permission: Permission,
): Promise<AuthenticatedUser | Response> {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  if (!hasPermission(user.roles, permission)) {
    return NextResponse.json({ error: "Deine Rolle ist für diese Aktion nicht berechtigt." }, { status: 403 });
  }
  return user;
}
