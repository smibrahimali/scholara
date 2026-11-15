/**
 * Cloud Supabase needs SSL; local `supabase start` Postgres does not.
 */
export function postgresSslOption(
  databaseUrl: string,
): false | { rejectUnauthorized: false } {
  try {
    const normalized = databaseUrl.replace(/^postgresql:/i, 'http:');
    const host = new URL(normalized).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return false;
    }
  } catch {
    /* keep SSL for opaque / unexpected URLs */
  }
  return { rejectUnauthorized: false };
}
