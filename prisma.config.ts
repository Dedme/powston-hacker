import path from "node:path";
import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Prisma CLI (db push, migrate) only works with local SQLite
    // Runtime uses TURSO_DB_URL via the adapter in src/lib/db.ts
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
