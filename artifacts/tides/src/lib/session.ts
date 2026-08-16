/**
 * The client's half of the session model (BACKLOG §2's last open item).
 *
 * The tester id is the public identity; the session token is the authority.
 * It arrives exactly once — from signup's first sync, from claiming a
 * pre-sessions account, or from a recovery-code restore — and lives in
 * localStorage under the `obs_` namespace so account deletion's purge sweeps
 * it with everything else.
 *
 * ONE interceptor attaches it to every same-origin /api request. The
 * alternative was editing the several dozen call sites that build their own
 * header objects, every one of which would be a chance to miss one — and a
 * missed one here is not a bug report, it is a 401 on a random surface. The
 * interceptor is installed from main.tsx before anything can fetch.
 */

const KEY_SESSION_TOKEN = "obs_session_token";

export function loadSessionToken(): string | null {
  try { return localStorage.getItem(KEY_SESSION_TOKEN); } catch { return null; }
}

export function saveSessionToken(token: string): void {
  try { localStorage.setItem(KEY_SESSION_TOKEN, token); } catch { /* private mode */ }
}

export function clearSessionToken(): void {
  try { localStorage.removeItem(KEY_SESSION_TOKEN); } catch { /* private mode */ }
}

/** Fired by the interceptor when the server rejects the session, so the one
 *  listener (tester-context) can attempt a silent recovery-code restore. */
export const SESSION_INVALID_EVENT = "compass:session-invalid";

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);
}

export function installSessionInterceptor(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiRequest(input)) return original(input, init);

    const token = loadSessionToken();
    let req: RequestInfo | URL = input;
    let opts = init;
    if (token) {
      if (input instanceof Request) {
        // The rare Request-object path: clone with the header added.
        const headers = new Headers(input.headers);
        headers.set("x-session-token", token);
        req = new Request(input, { headers });
      } else {
        const headers = new Headers(init?.headers);
        headers.set("x-session-token", token);
        opts = { ...init, headers };
      }
    }

    const res = await original(req, opts);
    if (res.status === 401) {
      // Peek without consuming the caller's body.
      try {
        const body = await res.clone().json();
        if (body?.error === "session_required") {
          window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT));
        }
      } catch { /* not JSON — someone else's 401 */ }
    }
    return res;
  };
}
