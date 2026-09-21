import { NextResponse } from "next/server";
import { hasRole, normalizeRoles, resolveUnitPriceCents } from "@bonanzbar/shared";
import { authenticate } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await authenticate(request);
  if (user instanceof Response) return user;
  const canManageEvents = hasRole(user.roles, "MANAGER");

  const [items, latestCount, barSettings, events, notes] = await Promise.all([
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
    prisma.barEvent.findMany({
      where: canManageEvents ? {} : { status: "PUBLISHED" },
      orderBy: { startsAt: "asc" },
      include: {
        duties: {
          orderBy: { label: "asc" },
          include: {
            applications: canManageEvents
              ? { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true, email: true } } } }
              : { where: { userId: user.id }, select: { id: true, status: true, note: true, createdAt: true } },
          },
        },
      },
    }),
    prisma.bulletinNote.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: { event: { select: { id: true, title: true } } },
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
    events,
    notes,
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
          proposedPackageSize: true,
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
    const [counts, shoppingLists, bills, databaseUsers, allocations, correctionRequests] = await Promise.all([
      prisma.stockCount.findMany({ orderBy: { countedAt: "desc" }, take: 8, include: { lines: true } }),
      prisma.shoppingList.findMany({ orderBy: { createdAt: "desc" }, include: { items: true } }),
      prisma.bill.findMany({ orderBy: { issuedAt: "desc" }, include: { recipient: { select: { name: true } }, lines: true }, take: 10 }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, roles: true }, orderBy: { name: "asc" } }),
      prisma.costAllocation.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          bills: {
            orderBy: { recipient: { name: "asc" } },
            include: { recipient: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.consumptionCorrection.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true } },
          item: { select: { id: true, name: true } },
        },
      }),
    ]);
    const billRecipients = databaseUsers.map((databaseUser) => ({ ...databaseUser, roles: normalizeRoles(databaseUser.roles) }));
    Object.assign(result, { counts, shoppingLists, bills, billRecipients, allocations, correctionRequests });
  }
  if (hasRole(user.roles, "USER")) {
    const [recentConsumptions, correctionRequests, correctionCandidates, consumptionSummary, openBillSummary] = await Promise.all([
      prisma.consumption.findMany({
        where: { userId: user.id },
        include: { item: true },
        orderBy: { occurredAt: "desc" },
        take: 10,
      }),
      prisma.consumptionCorrection.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { item: { select: { id: true, name: true } } },
      }),
      prisma.consumption.findMany({
        where: { userId: user.id, voidedAt: null },
        distinct: ["itemId"],
        orderBy: { occurredAt: "desc" },
        include: { item: { select: { id: true, name: true } } },
      }),
      prisma.consumption.aggregate({
        where: { userId: user.id, voidedAt: null },
        _sum: { quantity: true },
      }),
      prisma.bill.aggregate({
        where: { recipientId: user.id, status: "OPEN" },
        _sum: { totalCents: true },
      }),
    ]);
    Object.assign(result, {
      recentConsumptions,
      correctionRequests,
      correctionCandidates,
      consumptionSummary: { totalQuantity: consumptionSummary._sum.quantity ?? 0 },
      openBillTotalCents: openBillSummary._sum.totalCents ?? 0,
    });
  }

  return NextResponse.json(result);
}
