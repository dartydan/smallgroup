#!/usr/bin/env node
/* eslint-disable no-console */
const { resolve } = require("path");
const { config } = require("dotenv");
const postgres = require("postgres");

config({ path: resolve(__dirname, "../.env.local") });

const APPLY_FLAG = "--apply";
const HELP_FLAGS = new Set(["--help", "-h"]);
const args = process.argv.slice(2);
const unknownArgs = args.filter(
  (arg) => arg !== APPLY_FLAG && !HELP_FLAGS.has(arg),
);

if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  console.error(`Use ${APPLY_FLAG} to write recoverable missing names.`);
  process.exit(1);
}

if (args.some((arg) => HELP_FLAGS.has(arg))) {
  console.log("Audit user names against Clerk and report duplicate normalized emails.");
  console.log("");
  console.log("Dry run (default):");
  console.log("  npm run db:names:audit -w api");
  console.log("");
  console.log("Apply missing-name backfills:");
  console.log(`  npm run db:names:audit -w api -- ${APPLY_FLAG}`);
  process.exit(0);
}

const shouldApply = args.includes(APPLY_FLAG);
const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY?.trim() ?? "";

if (!connectionString) {
  console.error(
    "Missing database URL. Set DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING).",
  );
  process.exit(1);
}

if (!clerkSecretKey) {
  console.error("Missing CLERK_SECRET_KEY. The audit must compare database users with Clerk.");
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

function normalizeStoredName(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function hasLettersAndNumbers(value) {
  return /[a-z]/i.test(value) && /[0-9]/.test(value);
}

function isIdLikeName(value) {
  const normalized = value.trim().toLowerCase();
  const prefixedToken = normalized.match(
    /^(user|org|sess|session|client|sms|email|inv|invite|acct|account|clerk)[\s._:-]+([a-z0-9]+)$/,
  );
  if (prefixedToken) {
    const token = prefixedToken[2];
    if (token.length >= 16) return true;
    if (token.length >= 6 && hasLettersAndNumbers(token)) return true;
  }
  if (/^[a-f0-9]{16,}$/.test(normalized)) return true;

  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => token.length >= 18 && hasLettersAndNumbers(token))) {
    return true;
  }

  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return compact.length >= 20 && hasLettersAndNumbers(compact);
}

function sanitizeClerkName(value) {
  const normalized = normalizeStoredName(value);
  if (!normalized || normalized.toLowerCase() === "member") return null;
  return isIdLikeName(normalized) ? null : normalized;
}

function formatUserRef(user) {
  return `${user.email} [db=${user.id}, clerk=${user.auth_id}]`;
}

async function fetchClerkUser(authId, attempt = 0) {
  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(authId)}`,
    {
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        Accept: "application/json",
      },
    },
  );

  if (response.status === 429 && attempt < 2) {
    const retryAfterSeconds = Number.parseInt(
      response.headers.get("retry-after") ?? "1",
      10,
    );
    const waitMilliseconds =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds, 5) * 1000
        : 1000;
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, waitMilliseconds),
    );
    return fetchClerkUser(authId, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Clerk returned HTTP ${response.status}`);
  }

  return response.json();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(items.length, 1)) },
      () => worker(),
    ),
  );
  return results;
}

function printSection(title, rows, formatter) {
  console.log("");
  console.log(`${title}: ${rows.length}`);
  for (const row of rows) {
    console.log(`  - ${formatter(row)}`);
  }
}

async function assertNameColumnsExist() {
  const rows = await client`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name in ('first_name', 'last_name')
  `;
  const columns = new Set(rows.map((row) => row.column_name));
  const missing = ["first_name", "last_name"].filter(
    (column) => !columns.has(column),
  );
  if (missing.length > 0) {
    throw new Error(
      `The users table is missing ${missing.join(", ")}. Run npm run db:migrate -w api first.`,
    );
  }
}

async function main() {
  console.log(
    shouldApply
      ? "Mode: APPLY (missing names may be written)"
      : "Mode: DRY RUN (no database writes)",
  );

  try {
    await assertNameColumnsExist();

    const userRows = await client`
      select
        id::text as id,
        auth_id,
        email,
        display_name,
        first_name,
        last_name
      from users
      order by lower(btrim(email)), created_at, id
    `;
    const duplicateEmailRows = await client`
      select
        lower(btrim(email)) as normalized_email,
        count(*)::integer as user_count,
        array_agg(id::text order by created_at, id) as user_ids
      from users
      group by lower(btrim(email))
      having count(*) > 1
      order by lower(btrim(email))
    `;

    const clerkResults = await mapWithConcurrency(
      userRows,
      5,
      async (user) => {
        try {
          const clerkUser = await fetchClerkUser(user.auth_id);
          return {
            user,
            clerkFirstName: sanitizeClerkName(clerkUser.first_name),
            clerkLastName: sanitizeClerkName(clerkUser.last_name),
            error: null,
          };
        } catch (error) {
          return {
            user,
            clerkFirstName: null,
            clerkLastName: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );

    const missingNameRows = [];
    const unresolvedRows = [];
    const mismatchRows = [];
    const backfillRows = [];
    const clerkErrorRows = [];
    const oneTokenDisplayNameRows = [];

    for (const result of clerkResults) {
      const { user, clerkFirstName, clerkLastName, error } = result;
      const databaseFirstName = normalizeStoredName(user.first_name);
      const databaseLastName = normalizeStoredName(user.last_name);
      const missingFirstName = !databaseFirstName;
      const missingLastName = !databaseLastName;

      if (missingFirstName || missingLastName) {
        missingNameRows.push({
          user,
          missingFirstName,
          missingLastName,
        });
      }

      const displayName = normalizeStoredName(user.display_name);
      if (displayName && !/\s/.test(displayName)) {
        oneTokenDisplayNameRows.push({ user, displayName });
      }

      if (error) {
        clerkErrorRows.push({ user, error });
      }

      if (
        databaseFirstName &&
        clerkFirstName &&
        databaseFirstName !== clerkFirstName
      ) {
        mismatchRows.push({
          user,
          field: "first_name",
          databaseValue: databaseFirstName,
          clerkValue: clerkFirstName,
        });
      }
      if (
        databaseLastName &&
        clerkLastName &&
        databaseLastName !== clerkLastName
      ) {
        mismatchRows.push({
          user,
          field: "last_name",
          databaseValue: databaseLastName,
          clerkValue: clerkLastName,
        });
      }

      const firstNameBackfill = missingFirstName ? clerkFirstName : null;
      const lastNameBackfill = missingLastName ? clerkLastName : null;
      if (firstNameBackfill || lastNameBackfill) {
        backfillRows.push({
          user,
          firstName: firstNameBackfill,
          lastName: lastNameBackfill,
        });
      }

      if (
        (missingFirstName && !firstNameBackfill) ||
        (missingLastName && !lastNameBackfill)
      ) {
        unresolvedRows.push({
          user,
          missingFirstName: missingFirstName && !firstNameBackfill,
          missingLastName: missingLastName && !lastNameBackfill,
        });
      }
    }

    console.log(`Users audited: ${userRows.length}`);
    printSection(
      "Duplicate normalized emails",
      duplicateEmailRows,
      (row) =>
        `${row.normalized_email} (${row.user_count} rows: ${row.user_ids.join(", ")})`,
    );
    printSection(
      "Users missing database name fields",
      missingNameRows,
      (row) =>
        `${formatUserRef(row.user)} missing=${[
          row.missingFirstName ? "first_name" : null,
          row.missingLastName ? "last_name" : null,
        ]
          .filter(Boolean)
          .join(",")}`,
    );
    printSection(
      "One-token display names (review only)",
      oneTokenDisplayNameRows,
      (row) => `${formatUserRef(row.user)} display_name="${row.displayName}"`,
    );
    printSection(
      "Database/Clerk name mismatches (review only)",
      mismatchRows,
      (row) =>
        `${formatUserRef(row.user)} ${row.field}: db="${row.databaseValue}" clerk="${row.clerkValue}"`,
    );
    printSection(
      "Clerk lookup errors",
      clerkErrorRows,
      (row) => `${formatUserRef(row.user)} error="${row.error}"`,
    );
    printSection(
      "Recoverable missing-name backfills",
      backfillRows,
      (row) =>
        `${formatUserRef(row.user)} ${[
          row.firstName ? `first_name="${row.firstName}"` : null,
          row.lastName ? `last_name="${row.lastName}"` : null,
        ]
          .filter(Boolean)
          .join(" ")}`,
    );
    printSection(
      "Unresolved missing names",
      unresolvedRows,
      (row) =>
        `${formatUserRef(row.user)} missing=${[
          row.missingFirstName ? "first_name" : null,
          row.missingLastName ? "last_name" : null,
        ]
          .filter(Boolean)
          .join(",")}`,
    );

    if (!shouldApply) {
      console.log("");
      console.log("Dry run complete. No database rows were changed.");
      if (backfillRows.length > 0) {
        console.log(
          `Review the report, then apply with: npm run db:names:audit -w api -- ${APPLY_FLAG}`,
        );
      }
      return;
    }

    if (backfillRows.length === 0) {
      console.log("");
      console.log("No recoverable missing names to apply.");
      return;
    }

    await client.begin(async (transaction) => {
      for (const row of backfillRows) {
        await transaction`
          update users
          set
            first_name = case
              when first_name is null or btrim(first_name) = ''
                then coalesce(${row.firstName}, first_name)
              else first_name
            end,
            last_name = case
              when last_name is null or btrim(last_name) = ''
                then coalesce(${row.lastName}, last_name)
              else last_name
            end,
            updated_at = now()
          where id = ${row.user.id}::uuid
        `;
      }
    });

    console.log("");
    console.log(`Applied missing-name backfills to ${backfillRows.length} user row(s).`);
    if (unresolvedRows.length > 0) {
      console.log(
        `${unresolvedRows.length} user row(s) still require profile completion or manual review.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Name audit failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 1 });
  }
}

main();
