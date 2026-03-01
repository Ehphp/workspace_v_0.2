/**
 * In-memory Circuit Breaker for external API calls (OpenAI).
 *
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * - CLOSED: all requests pass through normally.
 * - OPEN: requests are rejected immediately (fast-fail).
 * - HALF_OPEN: one probe request is allowed; if it succeeds,
 *   circuit closes; if it fails, circuit re-opens.
 *
 * NOTE: In-memory state is per-function-instance on Netlify.
 * Warm instances share state; cold starts reset to CLOSED.
 * This is acceptable because:
 * 1. Most traffic hits warm instances (where CB is effective)
 * 2. Cold starts are infrequent ≈ 1/min under moderate load
 * 3. A Redis-backed CB would add latency to every call
 *
 * @module circuit-breaker
 * @since Sprint 3 (S3-1)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
    /** Consecutive failures before opening (default: 3) */
    failureThreshold?: number;
    /** Milliseconds to stay OPEN before allowing a probe (default: 30000) */
    resetTimeoutMs?: number;
    /** Name for logging */
    name?: string;
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
    openedAt: string | null;
}

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private lastFailureAt: number | null = null;
    private lastSuccessAt: number | null = null;
    private openedAt: number | null = null;

    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;
    private readonly name: string;

    constructor(options: CircuitBreakerOptions = {}) {
        this.failureThreshold = options.failureThreshold ?? 3;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
        this.name = options.name ?? 'circuit-breaker';
    }

    /**
     * Execute a function through the circuit breaker.
     * Throws CircuitOpenError if the circuit is OPEN and the reset
     * timeout has not yet elapsed.
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (this.shouldProbe()) {
                this.state = 'HALF_OPEN';
                console.log(`[${this.name}] OPEN → HALF_OPEN (probing)`);
            } else {
                const waitMs = this.resetTimeoutMs - (Date.now() - (this.openedAt || 0));
                throw new CircuitOpenError(
                    `Circuit breaker "${this.name}" is OPEN (${this.failures} consecutive failures). Retry in ~${Math.ceil(waitMs / 1000)}s.`,
                    Math.ceil(waitMs / 1000),
                );
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /** Check if enough time has passed for a half-open probe */
    private shouldProbe(): boolean {
        if (!this.openedAt) return true;
        return Date.now() - this.openedAt >= this.resetTimeoutMs;
    }

    private onSuccess(): void {
        this.failures = 0;
        this.successes++;
        this.lastSuccessAt = Date.now();
        if (this.state === 'HALF_OPEN') {
            console.log(`[${this.name}] HALF_OPEN → CLOSED (probe succeeded)`);
            this.state = 'CLOSED';
            this.openedAt = null;
        }
    }

    private onFailure(_error: unknown): void {
        this.failures++;
        this.lastFailureAt = Date.now();
        if (this.state === 'HALF_OPEN') {
            console.log(`[${this.name}] HALF_OPEN → OPEN (probe failed)`);
            this.state = 'OPEN';
            this.openedAt = Date.now();
        } else if (this.failures >= this.failureThreshold) {
            console.warn(
                `[${this.name}] CLOSED → OPEN (${this.failures} consecutive failures)`,
            );
            this.state = 'OPEN';
            this.openedAt = Date.now();
        }
    }

    /** Return a snapshot of the breaker's current statistics */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureAt: this.lastFailureAt
                ? new Date(this.lastFailureAt).toISOString()
                : null,
            lastSuccessAt: this.lastSuccessAt
                ? new Date(this.lastSuccessAt).toISOString()
                : null,
            openedAt: this.openedAt
                ? new Date(this.openedAt).toISOString()
                : null,
        };
    }

    /** Force-reset circuit to CLOSED (for testing / admin) */
    reset(): void {
        this.state = 'CLOSED';
        this.failures = 0;
        this.openedAt = null;
    }
}

/**
 * Custom error thrown when the circuit breaker is OPEN and the
 * reset timeout has not yet elapsed.
 */
export class CircuitOpenError extends Error {
    readonly retryAfterSeconds: number;

    constructor(message: string, retryAfterSeconds: number) {
        super(message);
        this.name = 'CircuitOpenError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
