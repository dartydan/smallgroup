#!/usr/bin/env node
/* eslint-disable no-console */
const { resolve } = require("path");
const { config } = require("dotenv");
const postgres = require("postgres");

config({ path: resolve(__dirname, "../.env.local") });

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  "";

if (!connectionString) {
  console.error(
    "Missing database URL. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING)."
  );
  process.exit(1);
}

const isTransactionPooler = (() => {
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
})();

const client = postgres(connectionString, {
  max: 1,
  connect_timeout: 8,
  prepare: !isTransactionPooler,
});

async function main() {
  try {
    const [row] = await client`
      select current_database() as database, now() as now
    `;
    const [schemaRow] = await client`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'users'
      ) as users_table_exists
    `;
    const host = (() => {
      try {
        return new URL(connectionString).hostname;
      } catch {
        return "unknown-host";
      }
    })();
    console.log("Database connection OK");
    console.log(`Host: ${host}`);
    console.log(`Database: ${row.database}`);
    console.log(`Server time: ${row.now}`);
    if (!schemaRow.users_table_exists) {
      console.error("Database is reachable, but schema is not initialized (missing `users` table).");
      console.error("Run: npm run db:migrate -w api");
      process.exitCode = 1;
    }
  } catch (error) {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    const withCode = errorObject;
    const message =
      errorObject.message?.trim() ||
      (typeof withCode.code === "string" ? withCode.code : "") ||
      "Unknown database error";
    if (message === "Tenant or user not found") {
      console.error(
        "Database auth failed: tenant/user not found. Replace DATABASE_URL with a valid Neon Postgres connection string."
      );
    } else {
      console.error(`Database connection failed: ${message}`);
    }
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 1 });
  }
}

main();
