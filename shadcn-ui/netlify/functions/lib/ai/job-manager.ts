import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    redisClient = createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => {
                if (retries > 3) return new Error('Redis connection failed');
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('error', (err) => {
        console.error('[job-manager] Redis error:', err);
    });

    await redisClient.connect();
    return redisClient;
}

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

export async function createJob(jobId: string): Promise<void> {
    const redis = await getRedisClient();
    const record: JobRecord = {
        id: jobId,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await redis.setEx(`job:${jobId}`, 3600, JSON.stringify(record));
}

export async function updateJob(jobId: string, status: JobStatus, result?: any, error?: string): Promise<void> {
    const redis = await getRedisClient();
    const currentStr = await redis.get(`job:${jobId}`);
    let record: JobRecord;

    if (currentStr) {
        record = JSON.parse(currentStr);
    } else {
        record = {
            id: jobId,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    record.status = status;
    if (result !== undefined) record.result = result;
    if (error !== undefined) record.error = error;
    record.updatedAt = new Date().toISOString();

    await redis.setEx(`job:${jobId}`, 3600, JSON.stringify(record));
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
    const redis = await getRedisClient();
    const str = await redis.get(`job:${jobId}`);
    return str ? JSON.parse(str) : null;
}

/**
 * S4-4: Update job progress without overwriting the full job result.
 * Called from bulk estimate loop to report per-requirement progress.
 */
export async function updateJobProgress(
    jobId: string,
    progress: JobRecord['progress']
): Promise<void> {
    const redis = await getRedisClient();
    const raw = await redis.get(`job:${jobId}`);
    if (!raw) return;

    const job: JobRecord = JSON.parse(raw);
    job.progress = progress;
    job.status = 'PROCESSING';
    job.updatedAt = new Date().toISOString();

    // Extended TTL for long bulk operations (2 hours)
    await redis.setEx(`job:${jobId}`, 7200, JSON.stringify(job));
}
