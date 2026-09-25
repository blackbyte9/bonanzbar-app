import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission, normalizeRoles, roles, type Role } from "@bonanzbar/shared";
import { isDemoAuthEnabled, localDemoAccounts, localDemoTokens } from "../lib/demo-mode";

const productionRoleAssignments: Record<Role, readonly Role[]> = {
  ADMIN: ["ADMIN"],
  MANAGER: ["MANAGER"],
  USER: ["USER"],
  GUEST: ["GUEST"],
};

test("Demo-Konten haben dieselben effektiven Rollen wie gleich konfigurierte Produktionskonten", () => {
  for (const role of roles) {
    assert.equal(typeof localDemoTokens[role], "string");
    assert.deepEqual(
      normalizeRoles(localDemoAccounts[role].roles),
      normalizeRoles(productionRoleAssignments[role]),
    );
  }

  assert.deepEqual(normalizeRoles(localDemoAccounts.MANAGER.roles), ["MANAGER", "USER"]);
  assert.equal(hasPermission(localDemoAccounts.MANAGER.roles, "consumption:create"), true);
  assert.equal(hasPermission(localDemoAccounts.ADMIN.roles, "consumption:create"), true);
  assert.equal(hasPermission(localDemoAccounts.GUEST.roles, "consumption:create"), false);
});

test("Demo-Anmeldung bleibt in Production deaktiviert", () => {
  assert.equal(isDemoAuthEnabled("production", "true"), false);
  assert.equal(isDemoAuthEnabled("development", "false"), false);
  assert.equal(isDemoAuthEnabled("development"), true);
});
