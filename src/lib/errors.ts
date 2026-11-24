// Turns raw errors (network failures, Supabase/Postgres exceptions, etc.)
// into short, friendly text that is always safe to show a player — never a
// raw "TypeError: Failed to fetch" or a Postgres error string.
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const msg = err.message
    // Network-level failures (offline, dropped connection, CORS, aborted
    // request) surface as generic browser errors like "Failed to fetch" or
    // "NetworkError when attempting to fetch resource." — never show these
    // verbatim.
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
      return 'Connection problem. Check your internet and try again.'
    }
    // Messages we deliberately raise ourselves (GameApiError wrapping a
    // Postgres RAISE EXCEPTION, or our own guard text) are already written
    // for a human, so pass them through.
    if (msg.length > 0 && msg.length < 200) {
      return msg
    }
  }
  return fallback
}
