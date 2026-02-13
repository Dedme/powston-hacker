import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildPrisma() {
  // Use libSQL adapter for both Turso (production) and local SQLite
  // TURSO_DB_URL is a libsql:// URL; DATABASE_URL is a file: URL for local dev
  const url = process.env.TURSO_DB_URL ?? process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.TURSO_DB_TOKEN,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
