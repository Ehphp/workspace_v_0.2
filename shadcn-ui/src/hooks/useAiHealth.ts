import { useState, useEffect, useCallback, useRef } from 'react';
import { buildFunctionUrl } from '@/lib/netlify';

export type AiHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface AiHealthData {
    status: AiHealthStatus;
    timestamp: string;
    openai: {
        configured: boolean;
        circuitBreaker: {
            state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
            failures: number;
            successes: number;
            lastFailureAt: string | null;
            lastSuccessAt: string | null;
            openedAt: string | null;
        };
    };
    database: {
        connected: boolean;
        pgvectorExtension: boolean | null;
        latencyMs: number;
    };
    redis: {
        connected: boolean;
        latencyMs: number | null;
    };
    recommendations: string[];
}

/**
 * Polls the consolidated `ai-health` endpoint every `intervalMs`
 * milliseconds while the browser tab is visible.
 *
 * Exposes:
 * - `aiStatus` — high-level status
 * - `isAiAvailable` — `true` when healthy or degraded (AI can still
 *    be attempted)
 * - `circuitBreakerOpen` — shortcut for CB state === OPEN
 * - `health` — full response data (nullable until first fetch)
 * - `refresh()` — force an immediate re-fetch
 *
 * @since Sprint 3 (S3-4b)
 */
export function useAiHealth(intervalMs = 60_000) {
    const [health, setHealth] = useState<AiHealthData | null>(null);
    const [aiStatus, setAiStatus] = useState<AiHealthStatus>('unknown');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchHealth = useCallback(async () => {
        try {
            const url = buildFunctionUrl('ai-health');
            const res = await fetch(url, { method: 'GET' });
            if (!res.ok) {
                setAiStatus('unknown');
                return;
            }
            const data: AiHealthData = await res.json();
            setHealth(data);
            setAiStatus(data.status);
        } catch {
            setAiStatus('unknown');
        }
    }, []);

    // Initial fetch + polling
    useEffect(() => {
        fetchHealth();

        timerRef.current = setInterval(fetchHealth, intervalMs);

        // Pause polling when the tab is hidden to save resources
        const handleVisibility = () => {
            if (document.hidden) {
                if (timerRef.current) clearInterval(timerRef.current);
            } else {
                fetchHealth();
                timerRef.current = setInterval(fetchHealth, intervalMs);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchHealth, intervalMs]);

    const isAiAvailable = aiStatus === 'healthy' || aiStatus === 'degraded';
    const circuitBreakerOpen =
        health?.openai?.circuitBreaker?.state === 'OPEN';

    return {
        aiStatus,
        isAiAvailable,
        circuitBreakerOpen,
        health,
        refresh: fetchHealth,
    };
}
