const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const localEnvironment = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

const requestedName = process.argv[2]?.toLowerCase();
const force = process.argv.slice(3).includes("--force");
const allowedNames = new Set(["development", "preview", "production"]);

if (requestedName !== "show" && !allowedNames.has(requestedName)) {
  console.error("Verwendung: npm.cmd run db:environment -- <show|development|preview|production> [--force]");
  process.exit(1);
}

const configuredName = process.env.BONANZBAR_DATABASE_ENVIRONMENT?.toLowerCase();
if (requestedName !== "show" && configuredName !== requestedName) {
  console.error(`BONANZBAR_DATABASE_ENVIRONMENT muss in .env.local auf "${requestedName}" gesetzt sein.`);
  process.exit(1);
}

const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

async function main() {
  const marker = await prisma.databaseEnvironment.findUnique({ where: { id: "default" } });
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (requestedName === "show") {
    console.log(`Verbundener Endpoint: ${databaseUrl.hostname}${databaseUrl.pathname}`);
    console.log(`Erwartete lokale Umgebung: ${configuredName ?? "nicht gesetzt"}`);
    console.log(`Datenbankmarker: ${marker?.name.toLowerCase() ?? "nicht gesetzt"}`);
    return;
  }

  if (marker && marker.name.toLowerCase() !== requestedName && !force) {
    throw new Error(
      `Die Datenbank ist bereits als "${marker.name.toLowerCase()}" markiert. `
      + "Prüfe den Neon-Branch und verwende nur bei einer absichtlichen Korrektur --force.",
    );
  }

  await prisma.databaseEnvironment.upsert({
    where: { id: "default" },
    update: { name: requestedName.toUpperCase() },
    create: { id: "default", name: requestedName.toUpperCase() },
  });

  console.log(`Datenbank ist als "${requestedName}" markiert.`);
  console.log(`Verbundener Endpoint: ${databaseUrl.hostname}${databaseUrl.pathname}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
