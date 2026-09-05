export interface RateLimiterOptions {
  cleanupIntervalMs?: number;
}

/**
 * Sliding-window in-memory RateLimiter for WebSocket messages, chat flood, and room creation.
 */
export class RateLimiter {
  private readonly windows = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimiterOptions = {}) {
    const interval = options.cleanupIntervalMs ?? 60_000;
    if (typeof setInterval !== 'undefined' && interval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), interval);
      if (typeof this.cleanupTimer === 'object' && this.cleanupTimer !== null && 'unref' in this.cleanupTimer) {
        (this.cleanupTimer as { unref: () => void }).unref();
      }
    }
  }

  /**
   * Consumes a token from the rate limiter window for `key`.
   * Returns true if allowed, or false if the limit is exceeded.
   */
  consume(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const cutoff = now - windowMs;
    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }
    // Remove expired entries
    while (timestamps.length > 0 && timestamps[0]! <= cutoff) {
      timestamps.shift();
    }
    if (timestamps.length >= limit) {
      return false;
    }
    timestamps.push(now);
    return true;
  }

  /**
   * Checks if a token is available without consuming it.
   */
  check(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const cutoff = now - windowMs;
    const timestamps = this.windows.get(key);
    if (!timestamps) return true;
    let count = 0;
    for (let i = timestamps.length - 1; i >= 0; i -= 1) {
      if (timestamps[i]! > cutoff) count += 1;
      else break;
    }
    return count < limit;
  }

  /**
   * Returns the number of tokens remaining in the window for `key`.
   */
  getRemaining(key: string, limit: number, windowMs: number, now = Date.now()): number {
    const cutoff = now - windowMs;
    const timestamps = this.windows.get(key);
    if (!timestamps) return limit;
    let count = 0;
    for (let i = timestamps.length - 1; i >= 0; i -= 1) {
      if (timestamps[i]! > cutoff) count += 1;
      else break;
    }
    return Math.max(0, limit - count);
  }

  /**
   * Periodically cleans up keys whose timestamps have all expired.
   */
  cleanup(now = Date.now(), maxAgeMs = 120_000): void {
    const cutoff = now - maxAgeMs;
    for (const [key, timestamps] of this.windows) {
      while (timestamps.length > 0 && timestamps[0]! <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }

  /**
   * Resets limits for a specific key, or clears all keys.
   */
  reset(key?: string): void {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }

  /**
   * Shuts down internal timer and clears memory.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.windows.clear();
  }
}
