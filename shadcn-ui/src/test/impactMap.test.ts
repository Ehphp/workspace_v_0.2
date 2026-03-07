/**
 * Impact Map — Schema Validation & Persistence Tests
 *
 * Covers:
 *  1. Zod schema accepts valid ImpactMap (happy path)
 *  2. Zod schema rejects various invalid payloads
 *  3. API client client-side validation (description length bounds)
 *  4. Persistence functions (save + get) via mocked Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 1. Schema validation ──────────────────────────────────────────

import {
    ImpactMapSchema,
    ImpactItemSchema,
    ImpactLayerSchema,
    ImpactActionSchema,
} from '@/types/impact-map';

const VALID_IMPACT_MAP = {
    summary: 'Il requisito impatta il layer frontend per la UI di approvazione, il layer logic per le regole di validazione e il layer data per la persistenza delle entità ordine.',
    impacts: [
        {
            layer: 'frontend' as const,
            action: 'create' as const,
            components: ['approval dashboard', 'order detail page'],
            reason: 'Nuova interfaccia di approvazione richiesta dal requisito per gestire gli ordini in attesa',
            confidence: 0.9,
        },
        {
            layer: 'logic' as const,
            action: 'modify' as const,
            components: ['validation service'],
            reason: 'Le regole di validazione ordine devono essere aggiornate per supportare il nuovo flusso di approvazione',
            confidence: 0.85,
        },
        {
            layer: 'data' as const,
            action: 'modify' as const,
            components: ['order entity', 'approval status view'],
            reason: 'Nuovi campi stato approvazione e relazione con entità utente approvatore',
            confidence: 0.8,
        },
    ],
    overallConfidence: 0.85,
};

describe('ImpactMapSchema', () => {
    it('accepts a fully valid impact map', () => {
        const result = ImpactMapSchema.safeParse(VALID_IMPACT_MAP);
        expect(result.success).toBe(true);
    });

    it('accepts overallConfidence at boundary 0', () => {
        const data = { ...VALID_IMPACT_MAP, overallConfidence: 0 };
        expect(ImpactMapSchema.safeParse(data).success).toBe(true);
    });

    it('accepts overallConfidence at boundary 1', () => {
        const data = { ...VALID_IMPACT_MAP, overallConfidence: 1 };
        expect(ImpactMapSchema.safeParse(data).success).toBe(true);
    });

    it('rejects overallConfidence > 1', () => {
        const data = { ...VALID_IMPACT_MAP, overallConfidence: 1.1 };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('rejects overallConfidence < 0', () => {
        const data = { ...VALID_IMPACT_MAP, overallConfidence: -0.1 };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('rejects summary shorter than 20 chars', () => {
        const data = { ...VALID_IMPACT_MAP, summary: 'Too short.' };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('rejects summary exceeding 1000 chars', () => {
        const data = { ...VALID_IMPACT_MAP, summary: 'a'.repeat(1001) };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('rejects empty impacts array', () => {
        const data = { ...VALID_IMPACT_MAP, impacts: [] };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('rejects impacts with > 15 items', () => {
        const data = {
            ...VALID_IMPACT_MAP,
            impacts: Array.from({ length: 16 }, (_, i) => ({
                layer: 'frontend',
                action: 'create',
                components: [`component ${i}`],
                reason: `Reason for impact item number ${i} which is long enough`,
                confidence: 0.8,
            })),
        };
        expect(ImpactMapSchema.safeParse(data).success).toBe(false);
    });

    it('accepts impacts at max boundary (15)', () => {
        const data = {
            ...VALID_IMPACT_MAP,
            impacts: Array.from({ length: 15 }, (_, i) => ({
                layer: 'frontend',
                action: 'create',
                components: [`component ${i}`],
                reason: `Reason for impact item number ${i} which is long enough`,
                confidence: 0.8,
            })),
        };
        expect(ImpactMapSchema.safeParse(data).success).toBe(true);
    });
});

describe('ImpactItemSchema', () => {
    const VALID_ITEM = VALID_IMPACT_MAP.impacts[0];

    it('accepts a valid impact item', () => {
        expect(ImpactItemSchema.safeParse(VALID_ITEM).success).toBe(true);
    });

    it('rejects invalid layer value', () => {
        const data = { ...VALID_ITEM, layer: 'network' };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects invalid action value', () => {
        const data = { ...VALID_ITEM, action: 'delete' };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects empty components array', () => {
        const data = { ...VALID_ITEM, components: [] };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects components with > 10 items', () => {
        const data = {
            ...VALID_ITEM,
            components: Array.from({ length: 11 }, (_, i) => `comp ${i}`),
        };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects reason shorter than 10 chars', () => {
        const data = { ...VALID_ITEM, reason: 'Too short' };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects reason exceeding 500 chars', () => {
        const data = { ...VALID_ITEM, reason: 'a'.repeat(501) };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects confidence > 1', () => {
        const data = { ...VALID_ITEM, confidence: 1.01 };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('rejects confidence < 0', () => {
        const data = { ...VALID_ITEM, confidence: -0.01 };
        expect(ImpactItemSchema.safeParse(data).success).toBe(false);
    });

    it('accepts confidence at boundary 0', () => {
        const data = { ...VALID_ITEM, confidence: 0 };
        expect(ImpactItemSchema.safeParse(data).success).toBe(true);
    });

    it('accepts confidence at boundary 1', () => {
        const data = { ...VALID_ITEM, confidence: 1 };
        expect(ImpactItemSchema.safeParse(data).success).toBe(true);
    });
});

describe('ImpactLayerSchema', () => {
    it.each([
        'frontend', 'logic', 'data', 'integration',
        'automation', 'configuration', 'ai_pipeline',
    ] as const)('accepts layer %s', (layer) => {
        expect(ImpactLayerSchema.safeParse(layer).success).toBe(true);
    });

    it('rejects unknown layer', () => {
        expect(ImpactLayerSchema.safeParse('network').success).toBe(false);
    });
});

describe('ImpactActionSchema', () => {
    it.each(['read', 'modify', 'create', 'configure'] as const)('accepts action %s', (action) => {
        expect(ImpactActionSchema.safeParse(action).success).toBe(true);
    });

    it('rejects unknown action', () => {
        expect(ImpactActionSchema.safeParse('delete').success).toBe(false);
    });
});

// ── 2. API client-side validation ─────────────────────────────────

// Mock supabase before importing the api module
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
        },
        from: vi.fn(),
    },
}));

// Mock netlify url builder
vi.mock('@/lib/netlify', () => ({
    buildFunctionUrl: vi.fn((name: string) => `/.netlify/functions/${name}`),
}));

import { generateImpactMap } from '@/lib/impact-map-api';

describe('generateImpactMap client validation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        const { supabase } = require('@/lib/supabase');
        supabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'test-token' } },
        });
    });

    it('rejects description shorter than 15 chars', async () => {
        const result = await generateImpactMap({
            description: 'short desc',
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('15');
    });

    it('rejects description exceeding 2000 chars', async () => {
        const longDesc = 'a'.repeat(2001);
        const result = await generateImpactMap({
            description: longDesc,
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('2000');
    });
});

// ── 3. Persistence helpers ────────────────────────────────────────

import { supabase } from '@/lib/supabase';
import {
    saveImpactMap,
    getLatestImpactMap,
} from '@/lib/api';

describe('saveImpactMap', () => {
    beforeEach(() => {
        vi.restoreAllMocks();

        const sub = supabase as any;
        sub.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
        });
    });

    it('inserts impact map and returns row', async () => {
        const mockRow = {
            id: 'row-1',
            requirement_id: 'req-1',
            impact_map: VALID_IMPACT_MAP,
            input_description: 'test desc',
            input_tech_category: 'BACKEND',
            has_requirement_understanding: true,
            user_id: 'user-123',
            version: 1,
            created_at: '2026-03-08T10:00:00.000Z',
        };

        const sub = supabase as any;

        // Chain: from().select().eq().order().limit() — version lookup
        const limitSelect = vi.fn().mockResolvedValue({ data: [], error: null });
        const orderSelect = vi.fn().mockReturnValue({ limit: limitSelect });
        const eqSelect = vi.fn().mockReturnValue({ order: orderSelect });
        const selectVersion = vi.fn().mockReturnValue({ eq: eqSelect });

        // Chain: from().insert().select().single() — insert
        const singleInsert = vi.fn().mockResolvedValue({ data: mockRow, error: null });
        const selectInsert = vi.fn().mockReturnValue({ single: singleInsert });
        const insertFn = vi.fn().mockReturnValue({ select: selectInsert });

        let callCount = 0;
        sub.from.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // version lookup
                return { select: selectVersion };
            }
            // insert
            return { insert: insertFn };
        });

        const result = await saveImpactMap({
            requirementId: 'req-1',
            impactMap: VALID_IMPACT_MAP as Record<string, unknown>,
            inputDescription: 'test desc',
            inputTechCategory: 'BACKEND',
            hasRequirementUnderstanding: true,
        });

        expect(result.id).toBe('row-1');
        expect(result.version).toBe(1);
    });
});

describe('getLatestImpactMap', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null when no rows exist', async () => {
        const sub = supabase as any;
        const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
        const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
        const eqFn = vi.fn().mockReturnValue({ order: orderFn });
        const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
        sub.from.mockReturnValue({ select: selectFn });

        const result = await getLatestImpactMap('req-nonexistent');
        expect(result).toBeNull();
    });

    it('returns the latest row when it exists', async () => {
        const mockRow = {
            id: 'row-1',
            requirement_id: 'req-1',
            impact_map: VALID_IMPACT_MAP,
            input_description: 'desc',
            input_tech_category: null,
            has_requirement_understanding: false,
            user_id: 'user-123',
            version: 2,
            created_at: '2026-03-08T12:00:00.000Z',
        };

        const sub = supabase as any;
        const limitFn = vi.fn().mockResolvedValue({ data: [mockRow], error: null });
        const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
        const eqFn = vi.fn().mockReturnValue({ order: orderFn });
        const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
        sub.from.mockReturnValue({ select: selectFn });

        const result = await getLatestImpactMap('req-1');
        expect(result).not.toBeNull();
        expect(result!.id).toBe('row-1');
        expect(result!.version).toBe(2);
    });
});
