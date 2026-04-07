/**
 * Circuit breaker + exponential-backoff retry utilities.
 *
 * CircuitBreaker wraps an async function and tracks failures:
 *   CLOSED  → normal operation
 *   OPEN    → short-circuits after threshold consecutive failures
 *   HALF-OPEN → allows one probe request after resetMs; closes on success
 *
 * Usage:
 *   const gmailBreaker = new CircuitBreaker({ threshold: 5, resetMs: 30_000 });
 *   const result = await gmailBreaker.execute(() => callGmailApi());
 */

export class CircuitBreaker {
  constructor({ threshold = 5, resetMs = 30_000, name = 'circuit' } = {}) {
    this.threshold = threshold;
    this.resetMs   = resetMs;
    this.name      = name;
    this.failures  = 0;
    this.state     = 'closed'; // 'closed' | 'open' | 'half-open'
    this.openedAt  = null;
  }

  async execute(fn) {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.resetMs) {
        this.state = 'half-open';
      } else {
        throw new Error(`circuit_open: ${this.name} is unavailable, retrying soon`);
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state    = 'closed';
        this.failures = 0;
      }
      return result;
    } catch (err) {
      this.failures++;
      if (this.state === 'half-open' || this.failures >= this.threshold) {
        this.state    = 'open';
        this.openedAt = Date.now();
        this.failures = this.threshold; // cap so it doesn't grow unbounded
      }
      throw err;
    }
  }

  get isOpen()     { return this.state === 'open'; }
  get isClosed()   { return this.state === 'closed'; }
  get isHalfOpen() { return this.state === 'half-open'; }

  reset() {
    this.state    = 'closed';
    this.failures = 0;
    this.openedAt = null;
  }
}

/**
 * Retry a function with exponential backoff.
 *
 * @param {Function} fn         - Async function to execute
 * @param {Object}   opts
 * @param {number}   opts.maxAttempts  - Max attempts (default 3)
 * @param {number}   opts.baseDelayMs  - Delay before 2nd attempt (default 1000ms)
 * @param {Function} opts.shouldRetry  - Optional predicate: (err) => boolean
 */
export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000, shouldRetry } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (shouldRetry && !shouldRetry(err)) throw err;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
