import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  );
}

function isTransactionPoolerConnection(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const host = url.hostname.toLowerCase();
    return (
      host.includes("pooler.") ||
      host.includes("-pooler.") ||
      url.port === "6543"
    );
  } catch {
    return false;
  }
}

const connectionString = getDatabaseUrl();
if (!connectionString) {
  throw new Error(
    "Missing database URL. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING)."
  );
}

const client = postgres(connectionString, {
  max: 10,
  // Transaction poolers (including Neon pooler endpoints) may reject prepared statements.
  prepare: !isTransactionPoolerConnection(connectionString),
});

export const db = drizzle(client, { schema });
export * from "./schema";
