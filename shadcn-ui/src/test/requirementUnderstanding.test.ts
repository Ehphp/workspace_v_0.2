/**
 * Requirement Understanding — Schema Validation & Persistence Tests
 *
 * Covers:
 *  1. Zod schema accepts valid RequirementUnderstanding (happy path)
 *  2. Zod schema rejects various invalid payloads
 *  3. API client client-side validation (description length bounds)
 *  4. Persistence functions (save + get) via mocked Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 1. Schema validation ──────────────────────────────────────────

import {
    RequirementUnderstandingSchema,
    RequirementActorSchema,
    StateTransitionSchema,
    ComplexityAssessmentSchema,
} from '@/types/requirement-understanding';

const VALID_UNDERSTANDING = {
    businessObjective: 'Permettere agli utenti di registrarsi con email e password',
    expectedOutput: 'Pagina di registrazione con validazione, salvataggio su DB, email di conferma',
    functionalPerimeter: [
        'Form di registrazione con email e password',
        'Validazione server-side dei dati',
        'Invio email di conferma',
    ],
    exclusions: ['SSO / login social', 'Autenticazione a due fattori'],
    actors: [
        { role: 'Utente finale', interaction: 'Compila il form di registrazione' },
        { role: 'Sistema email', interaction: 'Invia email di conferma' },
    ],
    stateTransition: {
        initialState: 'Nessun account utente presente nel sistema',
        finalState: 'Account utente creato e confermato via email',
    },
    preconditions: ['Server SMTP configurato', 'Database utenti disponibile'],
    assumptions: [
        'Il flusso di conferma email è sincrono (non richiede code OTP)',
        "L'interfaccia segue il design system esistente",
    ],
    complexityAssessment: {
        level: 'MEDIUM' as const,
        rationale: 'Logica condizionale nella validazione e integrazione SMTP',
    },
    confidence: 0.85,
    metadata: {
        generatedAt: '2026-03-06T10:00:00.000Z',
        model: 'gpt-4o-mini',
        techCategory: 'BACKEND',
        inputDescriptionLength: 120,
    },
};

describe('RequirementUnderstandingSchema', () => {
    it('accepts a fully valid understanding', () => {
        const result = RequirementUnderstandingSchema.safeParse(VALID_UNDERSTANDING);
        expect(result.success).toBe(true);
    });

    it('accepts empty exclusions array', () => {
        const data = { ...VALID_UNDERSTANDING, exclusions: [] };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(true);
    });

    it('accepts empty preconditions array', () => {
        const data = { ...VALID_UNDERSTANDING, preconditions: [] };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(true);
    });

    it('accepts confidence at boundary 0', () => {
        const data = { ...VALID_UNDERSTANDING, confidence: 0 };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(true);
    });

    it('accepts confidence at boundary 1', () => {
        const data = { ...VALID_UNDERSTANDING, confidence: 1 };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(true);
    });

    it('rejects confidence > 1', () => {
        const data = { ...VALID_UNDERSTANDING, confidence: 1.1 };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects confidence < 0', () => {
        const data = { ...VALID_UNDERSTANDING, confidence: -0.1 };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects empty businessObjective', () => {
        const data = { ...VALID_UNDERSTANDING, businessObjective: '' };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects empty functionalPerimeter', () => {
        const data = { ...VALID_UNDERSTANDING, functionalPerimeter: [] };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects functionalPerimeter with > 8 items', () => {
        const data = {
            ...VALID_UNDERSTANDING,
            functionalPerimeter: Array.from({ length: 9 }, (_, i) => `item ${i}`),
        };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects actors with > 5 entries', () => {
        const data = {
            ...VALID_UNDERSTANDING,
            actors: Array.from({ length: 6 }, (_, i) => ({
                role: `Actor ${i}`,
                interaction: `Does something ${i}`,
            })),
        };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects empty actors', () => {
        const data = { ...VALID_UNDERSTANDING, actors: [] };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects invalid complexity level', () => {
        const data = {
            ...VALID_UNDERSTANDING,
            complexityAssessment: { level: 'EXTREME', rationale: 'test' },
        };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects missing stateTransition fields', () => {
        const data = {
            ...VALID_UNDERSTANDING,
            stateTransition: { initialState: 'before' },
        };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });

    it('rejects exclusions > 5 items', () => {
        const data = {
            ...VALID_UNDERSTANDING,
            exclusions: Array.from({ length: 6 }, (_, i) => `exclusion ${i}`),
        };
        expect(RequirementUnderstandingSchema.safeParse(data).success).toBe(false);
    });
});

describe('RequirementActorSchema', () => {
    it('accepts valid actor', () => {
        expect(RequirementActorSchema.safeParse({ role: 'Admin', interaction: 'Manages users' }).success).toBe(true);
    });

    it('rejects empty role', () => {
        expect(RequirementActorSchema.safeParse({ role: '', interaction: 'x' }).success).toBe(false);
    });

    it('rejects empty interaction', () => {
        expect(RequirementActorSchema.safeParse({ role: 'Admin', interaction: '' }).success).toBe(false);
    });
});

describe('StateTransitionSchema', () => {
    it('accepts valid transition', () => {
        const result = StateTransitionSchema.safeParse({
            initialState: 'No account',
            finalState: 'Account created',
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing finalState', () => {
        expect(StateTransitionSchema.safeParse({ initialState: 'before' }).success).toBe(false);
    });
});

describe('ComplexityAssessmentSchema', () => {
    it.each(['LOW', 'MEDIUM', 'HIGH'] as const)('accepts level %s', (level) => {
        const result = ComplexityAssessmentSchema.safeParse({ level, rationale: 'reason' });
        expect(result.success).toBe(true);
    });

    it('rejects unknown level', () => {
        expect(ComplexityAssessmentSchema.safeParse({ level: 'CRITICAL', rationale: 'r' }).success).toBe(false);
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

import { generateRequirementUnderstanding } from '@/lib/requirement-understanding-api';

describe('generateRequirementUnderstanding client validation', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Re-mock supabase auth for each test
        const { supabase } = require('@/lib/supabase');
        supabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'test-token' } },
        });
    });

    it('rejects description shorter than 15 chars', async () => {
        const result = await generateRequirementUnderstanding({
            description: 'short desc',
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('15');
    });

    it('rejects description exceeding 2000 chars', async () => {
        const longDesc = 'a'.repeat(2001);
        const result = await generateRequirementUnderstanding({
            description: longDesc,
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('2000');
    });
});

// ── 3. Persistence helpers ────────────────────────────────────────

import { supabase } from '@/lib/supabase';
import {
    saveRequirementUnderstanding,
    getLatestRequirementUnderstanding,
} from '@/lib/api';

describe('saveRequirementUnderstanding', () => {
    beforeEach(() => {
        vi.restoreAllMocks();

        const sub = supabase as any;
        sub.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
        });
    });

    it('inserts understanding and returns row', async () => {
        const mockRow = {
            id: 'row-1',
            requirement_id: 'req-1',
            understanding: VALID_UNDERSTANDING,
            input_description: 'test desc',
            input_tech_category: 'BACKEND',
            user_id: 'user-123',
            version: 1,
            created_at: '2026-03-06T10:00:00.000Z',
        };

        const sub = supabase as any;

        // Chain: from().select().eq().order().limit()
        const limitSelect = vi.fn().mockResolvedValue({ data: [], error: null });
        const orderSelect = vi.fn().mockReturnValue({ limit: limitSelect });
        const eqSelect = vi.fn().mockReturnValue({ order: orderSelect });
        const selectVersion = vi.fn().mockReturnValue({ eq: eqSelect });

        // Chain: from().insert().select().single()
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

        const result = await saveRequirementUnderstanding({
            requirementId: 'req-1',
            understanding: VALID_UNDERSTANDING as Record<string, unknown>,
            inputDescription: 'test desc',
            inputTechCategory: 'BACKEND',
        });

        expect(result.id).toBe('row-1');
        expect(result.version).toBe(1);
    });
});

describe('getLatestRequirementUnderstanding', () => {
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

        const result = await getLatestRequirementUnderstanding('req-nonexistent');
        expect(result).toBeNull();
    });

    it('returns the latest row when it exists', async () => {
        const mockRow = {
            id: 'row-1',
            requirement_id: 'req-1',
            understanding: VALID_UNDERSTANDING,
            input_description: 'desc',
            input_tech_category: null,
            user_id: 'user-123',
            version: 2,
            created_at: '2026-03-06T12:00:00.000Z',
        };

        const sub = supabase as any;
        const limitFn = vi.fn().mockResolvedValue({ data: [mockRow], error: null });
        const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
        const eqFn = vi.fn().mockReturnValue({ order: orderFn });
        const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
        sub.from.mockReturnValue({ select: selectFn });

        const result = await getLatestRequirementUnderstanding('req-1');
        expect(result).not.toBeNull();
        expect(result!.id).toBe('row-1');
        expect(result!.version).toBe(2);
    });
});
