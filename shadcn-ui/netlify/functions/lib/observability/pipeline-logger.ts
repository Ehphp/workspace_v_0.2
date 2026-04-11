/**
 * pipeline-logger.ts — Structured observability for the estimation pipeline
 *
 * Accumulates structured log entries per request, then emits them as a
 * single JSON array. Each entry corresponds to a pipeline step with
 * associated metrics.
 *
 * Usage:
 *   const logger = createPipelineLogger(requestId);
 *   logger.log('candidate-sizing', { confidence: 0.72, candidateLimit: 25 });
 *   logger.log('agent-pipeline', { durationMs: 5200, toolCalls: 3 });
 *   logger.flush();  // emits full trace to console
 *
 * @module pipeline-logger
 */

export interface PipelineLogEntry {
    /** Pipeline step name */
    step: string;
    /** Timestamp of the log entry */
    timestamp: string;
    /** Arbitrary structured payload for the step */
    data: Record<string, unknown>;
}

export interface PipelineLogger {
    /** Add a structured log entry for a pipeline step */
    log(step: string, data: Record<string, unknown>): void;
    /** Emit all accumulated entries as structured JSON */
    flush(): PipelineLogEntry[];
    /** Get all entries without flushing */
    entries(): PipelineLogEntry[];
}

/**
 * Create a new pipeline logger scoped to a request.
 *
 * @param requestId Unique identifier for the pipeline run (e.g., execution ID)
 */
export function createPipelineLogger(requestId: string): PipelineLogger {
    const logs: PipelineLogEntry[] = [];

    return {
        log(step: string, data: Record<string, unknown>): void {
            logs.push({
                step,
                timestamp: new Date().toISOString(),
                data: { ...data, requestId },
            });
        },

        flush(): PipelineLogEntry[] {
            if (logs.length > 0) {
                console.log(`[pipeline-trace] requestId=${requestId} entries=${logs.length}`);
                console.log(JSON.stringify(logs, null, 0));
            }
            return logs;
        },

        entries(): PipelineLogEntry[] {
            return [...logs];
        },
    };
}
