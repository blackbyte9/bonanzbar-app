import { PriceMode, PrismaClient, Role } from "../generated/prisma";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.consumption.deleteMany();
  await prisma.shoppingItem.deleteMany();
  await prisma.shoppingList.deleteMany();
  await prisma.stockCountLine.deleteMany();
  await prisma.stockCount.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.barSettings.deleteMany();
  await prisma.applicationSetup.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("bonanzbar-demo");
  const [admin, manager, member] = await Promise.all([
    prisma.user.create({ data: { name: "Ada Administration", email: "ada@bonanzbar.local", role: Role.ADMIN, priceMode: PriceMode.PUBLIC, passwordHash } }),
    prisma.user.create({ data: { name: "Max Barleitung", email: "max@bonanzbar.local", role: Role.MANAGER, priceMode: PriceMode.HELPER, passwordHash } }),
    prisma.user.create({ data: { name: "Mia Mitglied", email: "mia@bonanzbar.local", role: Role.USER, priceMode: PriceMode.DYNAMIC, passwordHash } }),
  ]);
  await prisma.barSettings.create({ data: { id: "default", isOfficiallyOpen: false, updatedBy: admin.id } });

  const items = await Promise.all([
    prisma.inventoryItem.create({ data: { name: "Pils", category: "Bier", unit: "Flasche", priceCents: 280, helperPriceCents: 180, reorderLevel: 24 } }),
    prisma.inventoryItem.create({ data: { name: "Rotwein", category: "Wein", unit: "Flasche", priceCents: 1600, helperPriceCents: 1000, reorderLevel: 6 } }),
    prisma.inventoryItem.create({ data: { name: "Mineralwasser", category: "Softdrinks", unit: "Flasche", priceCents: 150, helperPriceCents: 100, reorderLevel: 18 } }),
    prisma.inventoryItem.create({ data: { name: "Gin", category: "Spirituosen", unit: "Flasche", priceCents: 2450, helperPriceCents: 1800, reorderLevel: 3 } }),
  ]);

  const start = await prisma.stockCount.create({
    data: {
      label: "Eröffnungszählung",
      countedAt: new Date("2026-08-01T18:00:00.000Z"),
      createdBy: admin.id,
      lines: { create: items.map((item, index) => ({ itemId: item.id, quantity: [72, 18, 48, 8][index] })) },
    },
  });
  await prisma.stockCount.create({
    data: {
      label: "Letzte Zählung",
      countedAt: new Date("2026-09-01T18:00:00.000Z"),
      createdBy: manager.id,
      lines: { create: items.map((item, index) => ({ itemId: item.id, quantity: [31, 10, 23, 5][index] })) },
    },
  });

  await prisma.shoppingList.create({
    data: {
      title: "Nachbestellung September",
      createdBy: manager.id,
      items: { create: [
        { itemId: items[0].id, name: items[0].name, quantity: 3 },
        { itemId: items[2].id, name: items[2].name, quantity: 2 },
        { name: "Tonic Water", quantity: 2 },
      ] },
    },
  });
  await prisma.consumption.create({
    data: { userId: member.id, itemId: items[0].id, quantity: 2, unitCents: 180, occurredAt: new Date("2026-08-15T20:00:00.000Z") },
  });
  await prisma.bill.create({
    data: {
      recipientId: member.id,
      totalCents: 560,
      dueAt: new Date("2026-09-15T00:00:00.000Z"),
      lines: { create: [{ itemId: items[0].id, description: "Pilsner", quantity: 2, unitCents: 280 }] },
    },
  });

  console.log(`${items.length} Artikel und die Eröffnungszählung ${start.id} wurden angelegt.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
