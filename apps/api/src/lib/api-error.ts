/**
 * Unwrap Drizzle/postgres errors so the API returns the underlying cause.
 * Drizzle wraps DB errors in DrizzleQueryError with message "Failed query: ...";
 * the real error (e.g. prepared statement, connection) is in .cause.
 */
export function getApiErrorMessage(e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = (err as Error & { cause?: Error & { code?: string; name?: string } }).cause;
  const causeWithCode = cause as Error & { code?: string } | undefined;

  // Some Postgres providers return this exact message when URL/credentials are invalid.
  // Return an actionable message so setup problems are obvious from the UI.
  if (
    cause instanceof Error &&
    cause.name === "PostgresError" &&
    cause.message === "Tenant or user not found"
  ) {
    return "Database connection failed: invalid DATABASE_URL credentials or host (tenant/user not found). For Neon, copy the connection string from your Neon branch and verify user, password, and host.";
  }

  // Postgres 42P01 = undefined_table (schema not migrated yet).
  if (
    causeWithCode?.code === "42P01" ||
    (cause instanceof Error && cause.message.includes('relation "users" does not exist'))
  ) {
    return "Database schema is missing tables. Run `npm run db:migrate -w api` to create them.";
  }

  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message;
  }

  return err.message.trim().length > 0 ? err.message : "Unknown server error";
}
