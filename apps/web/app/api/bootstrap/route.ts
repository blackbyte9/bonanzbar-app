import { NextResponse } from "next/server";
import { hasRole, normalizeRoles, resolveUnitPriceCents } from "@bonanzbar/shared";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;

  const [items, latestCount, barSettings] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockCount.findFirst({
      where: { status: "FINALIZED" },
      orderBy: { countedAt: "desc" },
      include: { lines: true },
    }),
    prisma.barSettings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    }),
  ]);
  const quantityByItem = new Map(latestCount?.lines.map((line) => [line.itemId, line.quantity]));
  const inventory = items.map((item) => ({
    ...item,
    onHand: quantityByItem.get(item.id) ?? 0,
    effectivePriceCents: resolveUnitPriceCents(item, user.priceMode, barSettings.isOfficiallyOpen),
  }));

  const result: Record<string, unknown> = {
    user,
    inventory,
    latestCount: latestCount ? { id: latestCount.id, label: latestCount.label, countedAt: latestCount.countedAt } : null,
  };

  if (hasRole(user.roles, "ADMIN")) {
    const [databaseUsers, pendingInventoryItems] = await Promise.all([
      prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, roles: true, priceMode: true, active: true } }),
      prisma.shoppingItem.findMany({
        where: { itemId: null },
        select: {
          id: true,
          name: true,
          quantity: true,
          proposedCategory: true,
          proposedUnit: true,
          proposedReorderLevel: true,
          proposedPriceCents: true,
          proposedHelperPriceCents: true,
          list: { select: { title: true, status: true } },
        },
      }),
    ]);
    const users = databaseUsers.map((databaseUser) => ({ ...databaseUser, roles: normalizeRoles(databaseUser.roles) }));
    Object.assign(result, { users, pendingInventoryItems, barSettings });
  }
  if (hasRole(user.roles, "MANAGER")) {
    const [counts, shoppingLists, bills, databaseUsers] = await Promise.all([
      prisma.stockCount.findMany({ orderBy: { countedAt: "desc" }, take: 8, include: { lines: true } }),
      prisma.shoppingList.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } }),
      prisma.bill.findMany({ orderBy: { issuedAt: "desc" }, include: { recipient: { select: { name: true } }, lines: true }, take: 10 }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, roles: true }, orderBy: { name: "asc" } }),
    ]);
    const billRecipients = databaseUsers.map((databaseUser) => ({ ...databaseUser, roles: normalizeRoles(databaseUser.roles) }));
    Object.assign(result, { counts, shoppingLists, bills, billRecipients });
  }
  if (hasRole(user.roles, "USER")) {
    result.recentConsumptions = await prisma.consumption.findMany({
      where: { userId: user.id },
      include: { item: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    });
  }

  return NextResponse.json(result);
}
