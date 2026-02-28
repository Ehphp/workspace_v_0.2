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
