import pg from "pg";
import { Sequelize, type Transaction } from "sequelize";
import * as M from "./models";

export type { Transaction };
export type { CategoryModel, CommentModel, NotificationModel, PriorityModel, TeamModel, TicketEventModel, TicketModel, UserModel } from "./models";

function createSequelize(): Sequelize {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sequelize = new Sequelize(url, {
    dialect: "postgres",
    dialectModule: pg, // passed explicitly so the bundler never has to resolve it dynamically
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    // Serverless: one connection per instance (Supabase's pooler does the pooling); recycle idle ones.
    pool: { max: 1, min: 0, idle: 20_000, evict: 20_000, acquire: 30_000 },
    define: {
      schema: "support_desk",
      underscored: true, // createdAt ↔ created_at
      timestamps: false, // the domain layer sets created_at / updated_at itself
      freezeTableName: true,
    },
  });
  return sequelize;
}

const g = globalThis as unknown as { __sequelize?: Sequelize };
let modelsReady = false;

/**
 * The shared Sequelize instance, created on first use (so `next build` needs no DATABASE_URL)
 * and reused across hot reloads and warm serverless invocations.
 */
export function db(): Sequelize {
  const sequelize = (g.__sequelize ??= createSequelize());
  // The connection is shared through globalThis, but Next.js can load this module more than once
  // (pages and API routes are bundled separately; hot reloads re-run it). Each copy has its own
  // model classes, so each registers them on the shared connection the first time it is used.
  if (!modelsReady) {
    M.initModels(sequelize);
    modelsReady = true;
  }
  return sequelize;
}

/** The models, registered on the connection. Services always get them from here: `const { TicketModel } = models();` */
export function models() {
  db();
  const { initModels: _init, ...rest } = M;
  void _init;
  return rest;
}

/**
 * Runs `fn` in a transaction. The pool has one connection, so every query inside must pass
 * `{ transaction: t }`; a query without it would wait for the connection the transaction holds.
 */
export function inTransaction<T>(fn: (t: Transaction) => Promise<T>): Promise<T> {
  return db().transaction(fn);
}

export async function closeDb(): Promise<void> {
  if (g.__sequelize) await g.__sequelize.close();
  g.__sequelize = undefined;
}
