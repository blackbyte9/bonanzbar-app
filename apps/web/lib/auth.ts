import type { PriceMode, Role } from "@bonanzbar/shared";
import { hasPermission, type Permission } from "@bonanzbar/shared";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const demoTokens: Record<string, string> = {
  "demo-admin-local-only": "ada@bonanzbar.local",
  "demo-manager-local-only": "max@bonanzbar.local",
  "demo-member-local-only": "mia@bonanzbar.local",
};

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  priceMode: PriceMode;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function authenticate(request: Request): Promise<AuthenticatedUser | Response> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : request.headers.get("x-bonanzbar-token");
  const email = token ? demoTokens[token] : undefined;
  if (!email) return unauthorized("Ein gültiges Sitzungstoken ist erforderlich.");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return unauthorized("Dieses Konto ist nicht verfügbar.");

  return { id: user.id, name: user.name, email: user.email, role: user.role, priceMode: user.priceMode };
}

export async function requirePermission(
  request: Request,
  permission: Permission,
): Promise<AuthenticatedUser | Response> {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  if (!hasPermission(user.role, permission)) {
    return NextResponse.json({ error: "Deine Rolle ist für diese Aktion nicht berechtigt." }, { status: 403 });
  }
  return user;
}

export function isDemoAuthEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_AUTH_ENABLED !== "false";
}

export const localDemoTokens = {
  ADMIN: "demo-admin-local-only",
  MANAGER: "demo-manager-local-only",
  USER: "demo-member-local-only",
} as const;
