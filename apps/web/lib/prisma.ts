import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { bonanzbarPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.bonanzbarPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.bonanzbarPrisma = prisma;
