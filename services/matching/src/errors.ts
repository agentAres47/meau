// undici (Node's fetch) reports every transport-level failure as the same
// opaque "TypeError: fetch failed" and hides the real reason -- DNS, refused
// connection, TLS -- on the `cause` chain. Logging only `.message` cost us a
// multi-day outage that was invisible in the logs: the matching service lost
// its route to Supabase and every log line said nothing but "fetch failed".
// Always log through this so the next one is diagnosable in a single glance.
// supabase-js catches transport failures and hands back its own plain
// `{ message: "TypeError: fetch failed" }`, discarding `cause` before any of
// our code sees it -- so wrapping the RPC call is too late to learn anything.
// This wraps fetch itself, which is the last place the real reason still
// exists. Rate-limited because the drainer and autopool loops run every few
// seconds and would otherwise bury the log in identical lines.
export function loggingFetch(label: string, minGapMs = 30_000): typeof fetch {
  let lastLoggedAt = 0;
  return async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    try {
      return await fetch(input, init);
    } catch (e) {
      const now = Date.now();
      if (now - lastLoggedAt >= minGapMs) {
        lastLoggedAt = now;
        const url = typeof input === 'string' ? input : ((input as Request).url ?? String(input));
        const host = (() => {
          try {
            return new URL(url).host;
          } catch {
            return url;
          }
        })();
        console.error(`${label} transport failure -> ${host}:`, errDetail(e));
      }
      throw e;
    }
  };
}

export function errDetail(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();

  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof Error) {
      // Node puts the useful bits (ENOTFOUND, ECONNREFUSED, EAI_AGAIN) on
      // non-standard fields, so surface them alongside the message.
      const sys = cur as Error & { code?: string; errno?: number; syscall?: string; hostname?: string };
      const extras = [sys.code, sys.syscall, sys.hostname].filter(Boolean).join(' ');
      parts.push(extras ? `${cur.name}: ${cur.message} [${extras}]` : `${cur.name}: ${cur.message}`);
      cur = (cur as { cause?: unknown }).cause;
    } else if (cur && typeof cur === 'object') {
      // supabase-js returns PostgrestError-shaped plain objects, not Errors --
      // String() on those yields a useless "[object Object]".
      const o = cur as { message?: string; details?: string; hint?: string; code?: string };
      const fields = [o.message, o.code && `code=${o.code}`, o.details, o.hint].filter(Boolean);
      parts.push(fields.length ? fields.join(' | ') : JSON.stringify(cur));
      break;
    } else {
      parts.push(String(cur));
      break;
    }
  }

  return parts.join(' <- caused by ') || String(e);
}
