export const roles = ["ADMIN", "MANAGER", "USER"] as const;
export type Role = (typeof roles)[number];

export const priceModes = ["PUBLIC", "HELPER", "DYNAMIC"] as const;
export type PriceMode = (typeof priceModes)[number];

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administration",
  MANAGER: "Barleitung",
  USER: "Mitglied",
};

export const priceModeLabels: Record<PriceMode, string> = {
  PUBLIC: "Immer regulärer Preis",
  HELPER: "Immer Helferpreis",
  DYNAMIC: "Nach Betriebsmodus",
};

export type Permission =
  | "inventory:read"
  | "inventory:write"
  | "users:manage"
  | "counts:manage"
  | "shopping:manage"
  | "bills:manage"
  | "reports:read"
  | "consumption:create";

const permissionsByRole: Record<Role, readonly Permission[]> = {
  ADMIN: ["inventory:read", "inventory:write", "users:manage"],
  MANAGER: [
    "inventory:read",
    "counts:manage",
    "shopping:manage",
    "bills:manage",
    "reports:read",
    "consumption:create",
  ],
  USER: ["inventory:read", "consumption:create"],
};

export function normalizeRoles(assignedRoles: readonly Role[]): Role[] {
  const normalized = roles.filter((role) => assignedRoles.includes(role));
  return normalized.includes("ADMIN") ? [...roles] : normalized;
}

export function hasRole(assignedRoles: readonly Role[], role: Role): boolean {
  return normalizeRoles(assignedRoles).includes(role);
}

export function hasPermission(assignedRoles: readonly Role[], permission: Permission): boolean {
  return normalizeRoles(assignedRoles).some((role) => permissionsByRole[role].includes(permission));
}

export interface InventoryItemInput {
  name: string;
  category: string;
  unit: string;
  reorderLevel: number;
  priceCents: number;
}

export function formatCurrency(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function resolveUnitPriceCents(
  item: { priceCents: number; helperPriceCents: number },
  priceMode: PriceMode,
  isOfficiallyOpen: boolean,
): number {
  if (priceMode === "PUBLIC") return item.priceCents;
  if (priceMode === "HELPER") return item.helperPriceCents;
  return isOfficiallyOpen ? item.priceCents : item.helperPriceCents;
}
