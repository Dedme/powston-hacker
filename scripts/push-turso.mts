#!/usr/bin/env node
/**
 * Push the Prisma schema to Turso.
 *
 * Prisma CLI only works with local SQLite, so this script:
 * 1. Runs `prisma db push` against a temp SQLite file
 * 2. Dumps the schema SQL from that temp file
 * 3. Executes the SQL against the Turso database
 */

import { execSync } from "child_process";
import { createClient } from "@libsql/client";
import { mkdtempSync, readFileSync, unlinkSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import "dotenv/config";

const TURSO_URL = process.env.TURSO_DB_URL;
const TURSO_TOKEN = process.env.TURSO_DB_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Missing TURSO_DB_URL or TURSO_DB_TOKEN in .env");
  process.exit(1);
}

async function main() {
  console.log("1. Pushing schema to temp SQLite...");
  const tempDir = mkdtempSync(join(tmpdir(), "prisma-turso-"));
  const tempDb = join(tempDir, "temp.db");

  try {
    execSync(
      `DATABASE_URL="file:${tempDb}" npx prisma db push --accept-data-loss`,
      { stdio: "inherit" }
    );

    console.log("\n2. Extracting schema SQL...");
    const schemaDump = execSync(`sqlite3 "${tempDb}" ".schema"`, {
      encoding: "utf-8",
    });

    // Filter out internal SQLite tables
    const statements = schemaDump
      .split(";\n")
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 0 &&
          !s.includes("sqlite_sequence") &&
          !s.startsWith("CREATE TABLE IF NOT EXISTS \"_prisma_migrations\"")
      )
      .map((s) => s + ";");

    console.log(`   Found ${statements.length} statements.`);

    console.log("\n3. Pushing to Turso...");
    const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

    for (const sql of statements) {
      const tableName = sql.match(/CREATE TABLE[^"]*"([^"]+)"/)?.[1] || "?";
      try {
        await client.execute(sql);
        console.log(`   ✓ ${tableName}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          console.log(`   ⊘ ${tableName} (already exists)`);
        } else {
          console.error(`   ✗ ${tableName}: ${msg}`);
        }
      }
    }

    // Also create indexes
    const indexDump = execSync(
      `sqlite3 "${tempDb}" "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"`,
      { encoding: "utf-8" }
    );
    const indexStatements = indexDump
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (indexStatements.length > 0) {
      console.log(`\n4. Creating ${indexStatements.length} indexes...`);
      for (const sql of indexStatements) {
        const idxName = sql.match(/CREATE[^"]*"([^"]+)"/)?.[1] || "?";
        try {
          await client.execute(sql);
          console.log(`   ✓ ${idxName}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("already exists")) {
            console.log(`   ⊘ ${idxName} (already exists)`);
          } else {
            console.error(`   ✗ ${idxName}: ${msg}`);
          }
        }
      }
    }

    client.close();
    console.log("\n✅ Schema pushed to Turso successfully.");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
