/**
 * Unwrap Drizzle/postgres errors so the API returns the underlying cause.
 * Drizzle wraps DB errors in DrizzleQueryError with message "Failed query: ...";
 * the real error (e.g. prepared statement, connection) is in .cause.
 */
export function getApiErrorMessage(e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = (err as Error & { cause?: Error }).cause;
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return err.message;
}
