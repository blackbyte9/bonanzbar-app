export const roles = ["ADMIN", "MANAGER", "USER", "GUEST"] as const;
export type Role = (typeof roles)[number];

export const priceModes = ["PUBLIC", "HELPER", "DYNAMIC", "GUEST"] as const;
export type PriceMode = (typeof priceModes)[number];

export const roleLabels: Record<Role, string> = {
  ADMIN: "Administration",
  MANAGER: "Barleitung",
  USER: "Mitglied",
  GUEST: "Gast",
};

export const priceModeLabels: Record<PriceMode, string> = {
  PUBLIC: "Immer regulärer Preis",
  HELPER: "Immer Helferpreis",
  DYNAMIC: "Nach Betriebsmodus",
  GUEST: "Immer Gastpreis",
};

export type Permission =
  | "inventory:read"
  | "inventory:write"
  | "users:manage"
  | "events:read"
  | "events:manage"
  | "events:apply"
  | "counts:manage"
  | "shopping:manage"
  | "bills:manage"
  | "reports:read"
  | "consumption:create"
  | "consumption:undo"
  | "recaps:manage"
  | "social:write"
  | "tasks:manage"
  | "ledger:manage";

const permissionsByRole: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "inventory:read",
    "inventory:write",
    "users:manage",
    "events:read",
    "events:manage",
    "events:apply",
    "bills:manage",
    "reports:read",
    "consumption:create",
    "consumption:undo",
    "recaps:manage",
    "social:write",
    "tasks:manage",
    "ledger:manage",
  ],
  MANAGER: [
    "inventory:read",
    "events:read",
    "events:manage",
    "events:apply",
    "counts:manage",
    "shopping:manage",
    "bills:manage",
    "reports:read",
    "consumption:create",
    "consumption:undo",
    "social:write",
    "tasks:manage",
  ],
  USER: ["inventory:read", "events:read", "events:apply", "consumption:create", "consumption:undo", "social:write"],
  GUEST: ["inventory:read", "events:read"],
};

export function normalizeRoles(assignedRoles: readonly Role[]): Role[] {
  const normalized = roles.filter((role) => assignedRoles.includes(role));
  if (normalized.includes("ADMIN")) return [...roles];
  if (normalized.includes("MANAGER")) return ["MANAGER", "USER"];
  if (normalized.includes("GUEST")) return ["GUEST"];
  return normalized;
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
  packageSize: number;
  reorderLevel: number;
  priceCents: number;
  helperPriceCents?: number;
  guestPriceCents?: number;
  trackInventory?: boolean;
  showInMenu?: boolean;
}

export function splitQuantityIntoPackages(quantity: number, packageSize: number): { packages: number; units: number } {
  const normalizedQuantity = Math.max(0, Math.floor(quantity));
  const normalizedPackageSize = Math.max(1, Math.floor(packageSize));
  return {
    packages: Math.floor(normalizedQuantity / normalizedPackageSize),
    units: normalizedQuantity % normalizedPackageSize,
  };
}

export function formatCurrency(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function resolveUnitPriceCents(
  item: { priceCents: number; helperPriceCents: number; guestPriceCents?: number },
  priceMode: PriceMode,
  isOfficiallyOpen: boolean,
): number {
  if (priceMode === "PUBLIC") return item.priceCents;
  if (priceMode === "HELPER") return item.helperPriceCents;
  if (priceMode === "GUEST") return item.guestPriceCents ?? item.priceCents;
  return isOfficiallyOpen ? item.priceCents : item.helperPriceCents;
}
