import { roles, type Role } from "@bonanzbar/shared";

type LocalDemoAccount = {
  token: string;
  email: string;
  roles: readonly Role[];
};

export const localDemoAccounts = {
  ADMIN: { token: "demo-admin-local-only", email: "ada@bonanzbar.local", roles: ["ADMIN", "MANAGER", "USER"] },
  MANAGER: { token: "demo-manager-local-only", email: "max@bonanzbar.local", roles: ["MANAGER"] },
  USER: { token: "demo-member-local-only", email: "mia@bonanzbar.local", roles: ["USER"] },
  GUEST: { token: "demo-guest-local-only", email: "gina@bonanzbar.local", roles: ["GUEST"] },
} as const satisfies Record<Role, LocalDemoAccount>;

export const localDemoTokens = Object.fromEntries(
  roles.map((role) => [role, localDemoAccounts[role].token]),
) as Record<Role, string>;

export function localDemoAccountForToken(token: string): LocalDemoAccount | undefined {
  return roles.map((role) => localDemoAccounts[role]).find((account) => account.token === token);
}

export function isDemoAuthEnabled(
  environment = process.env.NODE_ENV,
  configuredValue = process.env.DEMO_AUTH_ENABLED,
): boolean {
  return environment !== "production" && configuredValue !== "false";
}
