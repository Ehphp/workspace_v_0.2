import { tryGetRedisClient } from '../security/redis-client';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface JobRecord {
    id: string;
    status: JobStatus;
    result?: any;
    error?: string;
    createdAt: string;
    updatedAt: string;
    // ── S4-4: Granular progress tracking ────────────────
    progress?: {
        total: number;          // total requirements
        completed: number;      // requirements completed
        failed: number;         // requirements failed
        currentItem?: string;   // title or ID of current requirement
        partialResults?: any[]; // partial results already available
    };
}

// ── In-memory fallback when Redis is unavailable ────────────────
const memoryStore = new Map<string, { data: string; expiresAt: number }>();
const JOB_TTL_MS = 3600 * 1000;          // 1 hour
const BULK_JOB_TTL_MS = 7200 * 1000;     // 2 hours

function memSet(key: string, value: string, ttlMs: number): void {
    memoryStore.set(key, { data: value, expiresAt: Date.now() + ttlMs });
}

function memGet(key: string): string | null {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryStore.delete(key);
        return null;
    }
    return entry.data;
}

let redisAvailable: boolean | null = null; // null = not tested yet

/**
 * Try Redis first; on failure fall back to in-memory for the rest
 * of this process lifetime.
 */
async function withStore<T>(ops: {
    redis: (client: Awaited<ReturnType<typeof tryGetRedisClient>> & {}) => Promise<T>;
    memory: () => T;
}): Promise<T> {
    if (redisAvailable !== false) {
        try {
            const client = await tryGetRedisClient();
            if (client) {
                const result = await ops.redis(client);
                redisAvailable = true;
                return result;
            }
        } catch (err) {
            if (redisAvailable === null) {
                console.warn('[job-manager] Redis unavailable – using in-memory store', (err as Error).message);
            }
            redisAvailable = false;
        }
    }
    return ops.memory();
}

export async function createJob(jobId: string): Promise<void> {
    const record: JobRecord = {
        id: jobId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const json = JSON.stringify(record);

    await withStore({
        redis: async (r) => { await r.setEx(`job:${jobId}`, 3600, json); },
        memory: () => { memSet(`job:${jobId}`, json, JOB_TTL_MS); }
    });
}

export async function updateJob(jobId: string, status: JobStatus, result?: any, error?: string): Promise<void> {
    await withStore({
        redis: async (r) => {
            const currentStr = await r.get(`job:${jobId}`);
            let record: JobRecord = currentStr
                ? JSON.parse(currentStr)
                : { id: jobId, status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            record.status = status;
            if (result !== undefined) record.result = result;
            if (error !== undefined) record.error = error;
            record.updatedAt = new Date().toISOString();
            await r.setEx(`job:${jobId}`, 3600, JSON.stringify(record));
        },
        memory: () => {
            const currentStr = memGet(`job:${jobId}`);
            let record: JobRecord = currentStr
                ? JSON.parse(currentStr)
                : { id: jobId, status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            record.status = status;
            if (result !== undefined) record.result = result;
            if (error !== undefined) record.error = error;
            record.updatedAt = new Date().toISOString();
            memSet(`job:${jobId}`, JSON.stringify(record), JOB_TTL_MS);
        }
    });
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
    return withStore({
        redis: async (r) => {
            const str = await r.get(`job:${jobId}`);
            return str ? JSON.parse(str) : null;
        },
        memory: () => {
            const str = memGet(`job:${jobId}`);
            return str ? JSON.parse(str) : null;
        }
    });
}

/**
 * S4-4: Update job progress without overwriting the full job result.
 * Called from bulk estimate loop to report per-requirement progress.
 */
export async function updateJobProgress(
    jobId: string,
    progress: JobRecord['progress']
): Promise<void> {
    await withStore({
        redis: async (r) => {
            const raw = await r.get(`job:${jobId}`);
            if (!raw) return;
            const job: JobRecord = JSON.parse(raw);
            job.progress = progress;
            job.status = 'PROCESSING';
            job.updatedAt = new Date().toISOString();
            await r.setEx(`job:${jobId}`, 7200, JSON.stringify(job));
        },
        memory: () => {
            const raw = memGet(`job:${jobId}`);
            if (!raw) return;
            const job: JobRecord = JSON.parse(raw);
            job.progress = progress;
            job.status = 'PROCESSING';
            job.updatedAt = new Date().toISOString();
            memSet(`job:${jobId}`, JSON.stringify(job), BULK_JOB_TTL_MS);
        }
    });
}
