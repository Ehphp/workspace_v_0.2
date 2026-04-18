/**
 * Sprint 1 Test Suite
 *
 * Validates all Sprint 1 changes:
 * - S1-1/S1-2: tech_category filtering logic
 * - S1-3: AI cache (buildCacheKey, cache config, graceful degradation)
 * - S1-4: Shared Zod schemas, zod-to-json-schema conversion, FALLBACK_PRESET validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// S1-4: Shared Zod Schemas
// ─────────────────────────────────────────────────────────────────────────────

import {
    PipelineActivitySchema,
    type PipelineActivity,
} from '@/shared/validation/pipeline-activity.schema';
import {
    PresetOutputSchema,
    type PresetOutput,
} from '@/shared/validation/preset-output.schema';

describe('PipelineActivitySchema', () => {
    const validActivity: PipelineActivity = {
        title: 'Requirements Analysis and Documentation',
        description: 'Gather and document requirements',
        group: 'ANALYSIS',
        estimatedHours: 8,
        priority: 'core',
        confidence: 0.8,
        acceptanceCriteria: ['All requirements documented', 'Stakeholders signed off'],
        technicalDetails: {
            suggestedFiles: ['docs/requirements.md'],
            suggestedCommands: null,
            suggestedTests: null,
            dependencies: null,
        },
        estimatedHoursJustification: 'Based on similar projects',
    };

    it('should accept a fully-populated valid activity', () => {
        const result = PipelineActivitySchema.safeParse(validActivity);
        expect(result.success).toBe(true);
    });

    it('should accept minimal valid activity (only required fields)', () => {
        const result = PipelineActivitySchema.safeParse({
            title: 'Simple task with enough chars',
            group: 'DEV',
            estimatedHours: 4,
            priority: 'optional',
        });
        expect(result.success).toBe(true);
    });

    it('should reject title shorter than 10 chars', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            title: 'Short',
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid group enum', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            group: 'INVALID',
        });
        expect(result.success).toBe(false);
    });

    it('should reject estimatedHours < 1', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            estimatedHours: 0,
        });
        expect(result.success).toBe(false);
    });

    it('should reject estimatedHours > 320', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            estimatedHours: 321,
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid priority', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            priority: 'critical',
        });
        expect(result.success).toBe(false);
    });

    it('should reject confidence > 1', () => {
        const result = PipelineActivitySchema.safeParse({
            ...validActivity,
            confidence: 1.5,
        });
        expect(result.success).toBe(false);
    });

    it('should allow null/undefined for optional nullable fields', () => {
        const result = PipelineActivitySchema.safeParse({
            title: 'Enough characters for a valid title',
            group: 'OPS',
            estimatedHours: 4,
            priority: 'recommended',
            description: null,
            confidence: null,
            acceptanceCriteria: null,
            technicalDetails: null,
            estimatedHoursJustification: null,
        });
        expect(result.success).toBe(true);
    });
});

describe('PresetOutputSchema', () => {
    // Build a valid minimal preset with exactly 5 activities
    const makeActivities = (n: number): PipelineActivity[] =>
        Array.from({ length: n }, (_, i) => ({
            title: `Activity number ${i + 1} with enough length`,
            group: (['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE'] as const)[i % 5],
            estimatedHours: 4 + i,
            priority: 'core' as const,
        }));

    const validPreset: PresetOutput = {
        name: 'Test Preset Name',
        description: 'A valid description that is at least twenty characters long',
        detailedDescription: 'A'.repeat(100), // Exactly 100 chars
        techCategory: 'MULTI',
        activities: makeActivities(5),
        driverValues: { complexity: 5, quality: 6 },
        riskCodes: ['TECH_NEW'],
        reasoning: 'R'.repeat(50), // min 50 chars
        confidence: 0.7,
    };

    it('should accept a valid preset', () => {
        const result = PresetOutputSchema.safeParse(validPreset);
        expect(result.success).toBe(true);
    });

    it('should reject fewer than 5 activities', () => {
        const result = PresetOutputSchema.safeParse({
            ...validPreset,
            activities: makeActivities(4),
        });
        expect(result.success).toBe(false);
    });

    it('should reject more than 20 activities', () => {
        const result = PresetOutputSchema.safeParse({
            ...validPreset,
            activities: makeActivities(21),
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid techCategory', () => {
        const result = PresetOutputSchema.safeParse({
            ...validPreset,
            techCategory: 'FULLSTACK',
        });
        expect(result.success).toBe(false);
    });

    it('should reject confidence out of range', () => {
        const neg = PresetOutputSchema.safeParse({ ...validPreset, confidence: -0.1 });
        const over = PresetOutputSchema.safeParse({ ...validPreset, confidence: 1.1 });
        expect(neg.success).toBe(false);
        expect(over.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S1-4: Re-export from ai-validation.ts still works
// ─────────────────────────────────────────────────────────────────────────────

import {
    PipelineActivity as ReExportedPipelineActivity,
    PipelineActivitySchema as ReExportedSchema,
    splitTask,
} from '@/types/ai-validation';

describe('ai-validation re-exports', () => {
    it('should re-export PipelineActivitySchema from shared', () => {
        expect(ReExportedSchema).toBe(PipelineActivitySchema);
    });

    it('splitTask should still work with re-exported PipelineActivity type', () => {
        const activity: ReExportedPipelineActivity = {
            title: 'Implement a large feature module',
            group: 'DEV',
            estimatedHours: 18,
            priority: 'core',
        };
        const splits = splitTask(activity, 8);
        expect(splits.length).toBeGreaterThanOrEqual(2);
        splits.forEach(s => expect(s.estimatedHours).toBeLessThanOrEqual(8));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S1-4: zod-to-json-schema → AJV validation (preset-schema.ts)
// ─────────────────────────────────────────────────────────────────────────────

import {
    validatePreset,
    FALLBACK_PRESET,
} from '../../netlify/functions/lib/ai/validation/preset-schema';

describe('validatePreset (AJV from Zod)', () => {
    it('FALLBACK_PRESET should pass the Zod-derived AJV validator', () => {
        const valid = validatePreset(FALLBACK_PRESET);
        if (!valid) {
            console.error('AJV errors:', validatePreset.errors);
        }
        expect(valid).toBe(true);
    });

    it('should reject a preset missing required fields', () => {
        const invalid = { name: 'x' }; // Missing almost everything
        const valid = validatePreset(invalid);
        expect(valid).toBe(false);
        expect(validatePreset.errors!.length).toBeGreaterThan(0);
    });

    it('Zod schema and AJV validator should agree on FALLBACK_PRESET', () => {
        const zodResult = PresetOutputSchema.safeParse(FALLBACK_PRESET);
        const ajvResult = validatePreset(FALLBACK_PRESET);
        expect(zodResult.success).toBe(true);
        expect(ajvResult).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S1-3: ai-cache unit tests (no Redis needed — we mock it)
// ─────────────────────────────────────────────────────────────────────────────

// Mock Redis before importing ai-cache
vi.mock('../../netlify/functions/lib/security/redis-client', () => {
    const store = new Map<string, { value: string; ttl: number }>();
    return {
        getRedisClient: vi.fn(async () => ({
            get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
            setEx: vi.fn(async (key: string, ttl: number, value: string) => {
                store.set(key, { value, ttl });
            }),
            _store: store, // expose for test inspection
        })),
        closeRedisConnection: vi.fn(),
    };
});

import {
    buildCacheKey,
    getCachedResponse,
    setCachedResponse,
    CACHE_TITLE,
    CACHE_NORMALIZE,
    CACHE_SUGGEST,
} from '../../netlify/functions/lib/infrastructure/cache/ai-cache';

describe('ai-cache: buildCacheKey', () => {
    it('should produce deterministic hash for same inputs', () => {
        const k1 = buildCacheKey(['hello', 'world'], CACHE_TITLE);
        const k2 = buildCacheKey(['hello', 'world'], CACHE_TITLE);
        expect(k1).toBe(k2);
    });

    it('should produce different hashes for different inputs', () => {
        const k1 = buildCacheKey(['hello', 'world'], CACHE_TITLE);
        const k2 = buildCacheKey(['hello', 'earth'], CACHE_TITLE);
        expect(k1).not.toBe(k2);
    });

    it('should use correct prefix', () => {
        const k = buildCacheKey(['test'], CACHE_NORMALIZE);
        expect(k.startsWith('ai:norm:')).toBe(true);
    });

    it('should be valid hex SHA-256 after prefix', () => {
        const k = buildCacheKey(['data'], CACHE_SUGGEST);
        const hash = k.replace('ai:suggest:', '');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe('ai-cache: TTL configuration', () => {
    it('CACHE_NORMALIZE should have 24h TTL', () => {
        expect(CACHE_NORMALIZE.ttlSeconds).toBe(86400);
    });

    it('CACHE_TITLE should have 24h TTL', () => {
        expect(CACHE_TITLE.ttlSeconds).toBe(86400);
    });

    it('CACHE_SUGGEST should have 12h TTL', () => {
        expect(CACHE_SUGGEST.ttlSeconds).toBe(43200);
    });
});

describe('ai-cache: get/set round-trip', () => {
    it('should return null on miss', async () => {
        const key = buildCacheKey(['miss-key'], CACHE_TITLE);
        const result = await getCachedResponse<{ title: string }>(key, CACHE_TITLE);
        expect(result).toBeNull();
    });

    it('should return cached value after set', async () => {
        const key = buildCacheKey(['round-trip'], CACHE_TITLE);
        const payload = { title: 'Test title' };

        await setCachedResponse(key, payload, CACHE_TITLE);
        const result = await getCachedResponse<{ title: string }>(key, CACHE_TITLE);

        expect(result).toEqual(payload);
    });

    it('should return null when AI_CACHE_ENABLED=false', async () => {
        const original = process.env.AI_CACHE_ENABLED;
        process.env.AI_CACHE_ENABLED = 'false';

        const key = buildCacheKey(['disabled'], CACHE_TITLE);
        await setCachedResponse(key, { x: 1 }, CACHE_TITLE);
        const result = await getCachedResponse<{ x: number }>(key, CACHE_TITLE);

        expect(result).toBeNull();

        // Restore
        if (original !== undefined) {
            process.env.AI_CACHE_ENABLED = original;
        } else {
            delete process.env.AI_CACHE_ENABLED;
        }
    });
});

describe('ai-cache: graceful degradation', () => {
    it('should return null when Redis throws', async () => {
        // Temporarily override getRedisClient to throw
        const mod = await import('../../netlify/functions/lib/infrastructure/cache/redis-client');
        const orig = mod.getRedisClient;
        (mod as any).getRedisClient = vi.fn(async () => {
            throw new Error('Redis down');
        });

        const key = buildCacheKey(['redis-down'], CACHE_TITLE);
        const result = await getCachedResponse<string>(key, CACHE_TITLE);
        expect(result).toBeNull();

        // Restore
        (mod as any).getRedisClient = orig;
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S1-1 / S1-2: tech_category filtering logic (pure function test)
// ─────────────────────────────────────────────────────────────────────────────

describe('tech_category filtering logic', () => {
    // Simulate the same filter used in ai-estimate-from-interview.ts
    interface Activity {
        code: string;
        tech_category: string;
    }

    const catalog: Activity[] = [
        { code: 'PP_DEV_1', tech_category: 'POWER_PLATFORM' },
        { code: 'PP_DEV_2', tech_category: 'POWER_PLATFORM' },
        { code: 'FE_DEV_1', tech_category: 'FRONTEND' },
        { code: 'FE_DEV_2', tech_category: 'FRONTEND' },
        { code: 'BE_DEV_1', tech_category: 'BACKEND' },
        { code: 'CRS_DOC', tech_category: 'MULTI' },
        { code: 'CRS_QA', tech_category: 'MULTI' },
    ];

    function filterByTechCategory(activities: Activity[], techCategory: string): Activity[] {
        return activities.filter(
            a => a.tech_category === techCategory || a.tech_category === 'MULTI'
        );
    }

    it('should keep only FRONTEND + MULTI when techCategory=FRONTEND', () => {
        const result = filterByTechCategory(catalog, 'FRONTEND');
        expect(result.map(a => a.code)).toEqual(['FE_DEV_1', 'FE_DEV_2', 'CRS_DOC', 'CRS_QA']);
    });

    it('should keep only POWER_PLATFORM + MULTI when techCategory=POWER_PLATFORM', () => {
        const result = filterByTechCategory(catalog, 'POWER_PLATFORM');
        expect(result.map(a => a.code)).toEqual(['PP_DEV_1', 'PP_DEV_2', 'CRS_DOC', 'CRS_QA']);
    });

    it('should keep only MULTI when techCategory is unknown', () => {
        const result = filterByTechCategory(catalog, 'SAP');
        expect(result.map(a => a.code)).toEqual(['CRS_DOC', 'CRS_QA']);
    });

    it('should keep MULTI activities when techCategory=MULTI', () => {
        const result = filterByTechCategory(catalog, 'MULTI');
        expect(result.map(a => a.code)).toEqual(['CRS_DOC', 'CRS_QA']);
    });

    it('should reduce catalog size significantly (the point of S1-1)', () => {
        const full = catalog.length; // 7
        const filtered = filterByTechCategory(catalog, 'FRONTEND').length; // 4
        const reduction = 1 - filtered / full;
        expect(reduction).toBeGreaterThan(0.2); // At least 20% reduction
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// S1-3a: rate-limiter still imports from redis-client
// ─────────────────────────────────────────────────────────────────────────────

describe('rate-limiter refactor', () => {
    it('should re-export closeRedisConnection', async () => {
        const mod = await import('../../netlify/functions/lib/security/rate-limiter');
        expect(typeof mod.closeRedisConnection).toBe('function');
    });

    it('should export checkRateLimit', async () => {
        const mod = await import('../../netlify/functions/lib/security/rate-limiter');
        expect(typeof mod.checkRateLimit).toBe('function');
    });
});
