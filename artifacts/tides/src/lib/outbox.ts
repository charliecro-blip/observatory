// A write that survives being offline.
//
// The journal used to report "saved on this device only — will retry" and then
// never retry: the flag was set, no timer was scheduled, and the only thing
// that ever tried again was the user typing another character. Write an entry
// on a train, close the tab, and the text sat in localStorage for good while
// the server never heard about it — and the hydration path only reads from the
// server when there is NO local copy, so it looked fine forever.
//
// Telling someone their work is safe when it isn't is worse than telling them
// it failed. This is the machinery that makes the sentence true.
//
// Deliberately not React: the claim worth pinning is "it actually retries, and
// it gives up honestly", and that is only testable if timers and the send
// itself are injected. The component just renders `state`.

export type OutboxState = "clean" | "pending" | "syncing" | "failed";

/**
 * Backoff for a small text write. Short at first — most failures are a tunnel
 * or a sleeping laptop, not an outage — then long enough not to hammer a
 * server that is genuinely down.
 */
export const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000];

export interface OutboxDeps {
  /** Resolves on success; throws or resolves false to mean "not saved". */
  send: (payload: string) => Promise<boolean | void>;
  onState: (state: OutboxState) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
  /** Debounce before the first attempt, so typing doesn't post per keystroke. */
  debounceMs?: number;
}

export class Outbox {
  private deps: OutboxDeps;
  private payload: string | null = null;
  private timer: unknown = null;
  private attempt = 0;
  private inFlight = false;
  state: OutboxState = "clean";

  constructor(deps: OutboxDeps) {
    this.deps = deps;
  }

  private set(state: OutboxState) {
    this.state = state;
    this.deps.onState(state);
  }

  private arm(ms: number) {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = this.deps.setTimer(() => { this.timer = null; void this.flush(); }, ms);
  }

  /** Queue new content. Supersedes anything not yet sent. */
  queue(payload: string) {
    this.payload = payload;
    this.attempt = 0;              // new content deserves a fresh fast attempt
    this.set("pending");
    this.arm(this.deps.debounceMs ?? 900);
  }

  /**
   * Adopt content already on disk from a previous session — the case the old
   * code had no answer for at all. Same as queue() but sends promptly.
   */
  restore(payload: string) {
    this.payload = payload;
    this.attempt = 0;
    this.set("pending");
    this.arm(0);
  }

  /** A manual Retry, or a regained connection. */
  retryNow() {
    if (this.payload === null) return;
    this.attempt = 0;
    this.set("pending");
    this.arm(0);
  }

  async flush(): Promise<void> {
    if (this.payload === null || this.inFlight) return;
    const sending = this.payload;
    this.inFlight = true;
    this.set("syncing");
    let ok = false;
    try {
      ok = (await this.deps.send(sending)) !== false;
    } catch {
      ok = false;
    }
    this.inFlight = false;

    // Superseded while in flight: the newer text is what matters, and the
    // older result must not clear it.
    if (this.payload !== sending) { void this.flush(); return; }

    if (ok) {
      this.payload = null;
      this.attempt = 0;
      this.set("clean");
      return;
    }
    const delay = RETRY_DELAYS_MS[this.attempt];
    this.attempt++;
    this.set("failed");
    // Out of scheduled attempts: stay "failed" with the text still queued, so
    // a manual Retry or a reconnect can still pick it up. Never silently drop.
    if (delay !== undefined) this.arm(delay);
  }

  /** True when there is unsent content — for an "are you sure" on unload. */
  get hasPending(): boolean {
    return this.payload !== null;
  }

  dispose() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }
}
