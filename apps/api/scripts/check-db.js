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

const isSupabasePooler = (() => {
  try {
    const url = new URL(connectionString);
    return (
      url.hostname.includes("pooler.supabase.com") ||
      url.port === "6543"
    );
  } catch {
    return false;
  }
})();

const client = postgres(connectionString, {
  max: 1,
  connect_timeout: 8,
  prepare: !isSupabasePooler,
});

async function main() {
  try {
    const [row] = await client`
      select current_database() as database, now() as now
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (message === "Tenant or user not found") {
      console.error(
        "Database auth failed: tenant/user not found. Replace DATABASE_URL with a valid Postgres URL (Neon/Vercel Postgres recommended)."
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
