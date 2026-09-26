import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  // Imported after dotenv so the DB client sees DATABASE_URL.
  const { db, closeDb } = await import("../src/lib/db");
  // Schema and snapshots are plain SQL files (schema.sql is the source of truth), so run them as-is.
  const runFile = (file: string) => db().query(readFileSync(join(__dirname, file), "utf8"));
  const { seed } = await import("./seed");
  try {
    if (process.argv.includes("--reset")) {
      // Only ever drops our own schema; public (another app's tables) is never touched.
      await db().query("DROP SCHEMA IF EXISTS support_desk CASCADE");
      console.log("Dropped schema support_desk.");
    }
    await runFile("schema.sql");
    console.log("Schema support_desk is up to date.");
    // Migrate only: apply schema.sql (idempotent) and leave existing data alone.
    if (process.argv.includes("--schema-only")) return;
    if (process.argv.includes("--from-sql")) {
      // Fast path: load the exported snapshot (timestamps are relative to now()).
      await runFile("seed.sql");
      console.log("Loaded db/seed.sql.");
    } else {
      await seed();
    }
  } finally {
    await closeDb();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
