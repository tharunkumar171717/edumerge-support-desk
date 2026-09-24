import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  // Imported after dotenv so the DB client sees DATABASE_URL.
  const { sql, closeDb } = await import("../src/lib/db");
  const { seed } = await import("./seed");
  try {
    if (process.argv.includes("--reset")) {
      // Only ever drops our own schema; public (another app's tables) is never touched.
      await sql.unsafe("DROP SCHEMA IF EXISTS support_desk CASCADE");
      console.log("Dropped schema support_desk.");
    }
    await sql.unsafe(readFileSync(join(__dirname, "schema.sql"), "utf8"));
    console.log("Schema support_desk is up to date.");
    if (process.argv.includes("--from-sql")) {
      // Fast path: load the exported snapshot (timestamps are relative to now()).
      await sql.unsafe(readFileSync(join(__dirname, "seed.sql"), "utf8"));
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
