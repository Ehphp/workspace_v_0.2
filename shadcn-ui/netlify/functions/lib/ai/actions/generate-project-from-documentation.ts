/**
 * AI Action: Generate Project from Documentation
 *
 * Two-pass pipeline using gpt-4o-mini:
 *   Pass 1 → Extract project draft metadata
 *   Pass 2 → Extract technical blueprint (using sourceText + pass 1 output)
 *
 * Follows the same pattern as generate-impact-map.ts and generate-understanding.ts.
 * Does NOT persist anything — returns structured output for user review.
 */

import { z } from 'zod';
import { getDefaultProvider } from '../openai-client';
import {
    PROJECT_DRAFT_SYSTEM_PROMPT,
    TECHNICAL_BLUEPRINT_SYSTEM_PROMPT,
    createProjectDraftResponseSchema,
    createTechnicalBlueprintResponseSchema,
} from '../prompts/project-from-documentation';
import {
    normalizeProjectTechnicalBlueprint,
} from '../post-processing/normalize-blueprint';
import type {
    ProjectDraftBlueprint,
    BlueprintComponentType,
    IntegrationDirection,
} from '../../domain/project/project-technical-blueprint.types';

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateProjectFromDocRequest {
    sourceText: string;
    testMode?: boolean;
}

export interface GenerateProjectFromDocResponse {
    projectDraft: ProjectDraftBlueprint;
    technicalBlueprint: {
        sourceText?: string;
        summary?: string;
        components: Array<{
            name: string;
            type: BlueprintComponentType;
            description?: string;
            confidence?: number;
        }>;
        dataDomains: Array<{
            name: string;
            description?: string;
            confidence?: number;
        }>;
        integrations: Array<{
            systemName: string;
            direction?: IntegrationDirection;
            description?: string;
            confidence?: number;
        }>;
        architecturalNotes: string[];
        assumptions: string[];
        missingInformation: string[];
        confidence?: number;
    };
    metrics: {
        pass1Ms: number;
        pass2Ms: number;
        totalMs: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const ProjectDraftSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    owner: z.string().nullable().optional(),
    technologyId: z.string().nullable().optional(),
    projectType: z.enum(['NEW_DEVELOPMENT', 'MAINTENANCE', 'MIGRATION', 'INTEGRATION', 'REFACTORING']).nullable().optional(),
    domain: z.string().nullable().optional(),
    scope: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).nullable().optional(),
    teamSize: z.number().int().min(1).max(100).nullable().optional(),
    deadlinePressure: z.enum(['RELAXED', 'NORMAL', 'TIGHT', 'CRITICAL']).nullable().optional(),
    methodology: z.enum(['AGILE', 'WATERFALL', 'HYBRID']).nullable().optional(),
    confidence: z.number().min(0).max(1),
    assumptions: z.array(z.string()),
    missingFields: z.array(z.string()),
    reasoning: z.string().nullable().optional(),
});

const ComponentTypeEnum = z.enum([
    'frontend', 'backend', 'database', 'integration', 'workflow',
    'reporting', 'security', 'infrastructure', 'external_system', 'other',
]);

const DirectionEnum = z.enum(['inbound', 'outbound', 'bidirectional', 'unknown']).nullable().optional();

const TechnicalBlueprintSchema = z.object({
    summary: z.string().nullable().optional(),
    components: z.array(z.object({
        name: z.string().min(1).max(200),
        type: ComponentTypeEnum,
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
    })).max(10),
    dataDomains: z.array(z.object({
        name: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
    })).max(20),
    integrations: z.array(z.object({
        systemName: z.string().min(1).max(200),
        direction: DirectionEnum,
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
    })).max(15),
    architecturalNotes: z.array(z.string()),
    assumptions: z.array(z.string()),
    missingInformation: z.array(z.string()),
    confidence: z.number().min(0).max(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function generateProjectFromDocumentation(
    request: GenerateProjectFromDocRequest,
): Promise<GenerateProjectFromDocResponse> {
    const { sourceText } = request;
    const totalStart = Date.now();
    const provider = getDefaultProvider();

    console.log('[generate-project-from-doc] Starting, source text length:', sourceText.length);

    // ── Pass 1: Project Draft Extraction ────────────────────────────
    const pass1Start = Date.now();

    const pass1UserPrompt = `DOCUMENTAZIONE PROGETTUALE:\n\n${sourceText}`;
    const pass1Schema = createProjectDraftResponseSchema();

    const pass1Raw = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: pass1Schema as any,
        systemPrompt: PROJECT_DRAFT_SYSTEM_PROMPT,
        userPrompt: pass1UserPrompt,
    });

    const pass1Ms = Date.now() - pass1Start;
    console.log('[generate-project-from-doc] Pass 1 completed in', pass1Ms, 'ms');

    if (!pass1Raw) {
        throw new Error('No response from LLM for project draft extraction');
    }

    let pass1Parsed: unknown;
    try {
        pass1Parsed = JSON.parse(pass1Raw);
    } catch {
        console.error('[generate-project-from-doc] Invalid JSON from Pass 1');
        throw new Error('LLM returned invalid JSON for project draft extraction');
    }

    const pass1Validation = ProjectDraftSchema.safeParse(pass1Parsed);
    if (!pass1Validation.success) {
        console.error('[generate-project-from-doc] Pass 1 validation failed:', pass1Validation.error.issues);
        throw new Error('LLM output failed schema validation for project draft');
    }

    const projectDraft = pass1Validation.data as ProjectDraftBlueprint;

    // ── Pass 2: Technical Blueprint Extraction ──────────────────────
    const pass2Start = Date.now();

    const pass2UserPrompt = [
        `DOCUMENTAZIONE PROGETTUALE:\n\n${sourceText}`,
        `\nMETADATI PROGETTO ESTRATTI (dal pass precedente):`,
        `- Nome: ${projectDraft.name}`,
        `- Descrizione: ${projectDraft.description}`,
        projectDraft.projectType ? `- Tipo: ${projectDraft.projectType}` : null,
        projectDraft.domain ? `- Dominio: ${projectDraft.domain}` : null,
        projectDraft.scope ? `- Scope: ${projectDraft.scope}` : null,
        projectDraft.methodology ? `- Metodologia: ${projectDraft.methodology}` : null,
    ].filter(Boolean).join('\n');

    const pass2Schema = createTechnicalBlueprintResponseSchema();

    const pass2Raw = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 3000,
        responseFormat: pass2Schema as any,
        systemPrompt: TECHNICAL_BLUEPRINT_SYSTEM_PROMPT,
        userPrompt: pass2UserPrompt,
    });

    const pass2Ms = Date.now() - pass2Start;
    console.log('[generate-project-from-doc] Pass 2 completed in', pass2Ms, 'ms');

    if (!pass2Raw) {
        throw new Error('No response from LLM for technical blueprint extraction');
    }

    let pass2Parsed: unknown;
    try {
        pass2Parsed = JSON.parse(pass2Raw);
    } catch {
        console.error('[generate-project-from-doc] Invalid JSON from Pass 2');
        throw new Error('LLM returned invalid JSON for technical blueprint extraction');
    }

    const pass2Validation = TechnicalBlueprintSchema.safeParse(pass2Parsed);
    if (!pass2Validation.success) {
        console.error('[generate-project-from-doc] Pass 2 validation failed:', pass2Validation.error.issues);
        throw new Error('LLM output failed schema validation for technical blueprint');
    }

    const blueprintData = pass2Validation.data;

    // ── Post-processing: normalize blueprint for 3-column graph ─────
    const { blueprint: normalizedBlueprint, warnings: normWarnings } =
        normalizeProjectTechnicalBlueprint({
            summary: blueprintData.summary ?? undefined,
            components: blueprintData.components.map((c) => ({
                name: c.name,
                type: c.type as BlueprintComponentType,
                description: c.description ?? undefined,
                confidence: c.confidence ?? undefined,
            })),
            dataDomains: blueprintData.dataDomains.map((d) => ({
                name: d.name,
                description: d.description ?? undefined,
                confidence: d.confidence ?? undefined,
            })),
            integrations: blueprintData.integrations.map((i) => ({
                systemName: i.systemName,
                direction: (i.direction ?? undefined) as IntegrationDirection | undefined,
                description: i.description ?? undefined,
                confidence: i.confidence ?? undefined,
            })),
            architecturalNotes: blueprintData.architecturalNotes,
            assumptions: blueprintData.assumptions,
            missingInformation: blueprintData.missingInformation,
            confidence: blueprintData.confidence,
        });

    // ── FASE 7: Debug validation logs ───────────────────────────────
    if (normWarnings.length > 0) {
        console.log('[generate-project-from-doc] Blueprint normalization warnings:');
        for (const w of normWarnings) {
            console.log(`  → ${w}`);
        }
    }
    console.log(
        '[generate-project-from-doc] Blueprint structure:',
        `${normalizedBlueprint.components.length} components,`,
        `${normalizedBlueprint.dataDomains.length} dataDomains,`,
        `${normalizedBlueprint.integrations.length} integrations`,
    );

    const totalMs = Date.now() - totalStart;
    console.log('[generate-project-from-doc] Complete in', totalMs, 'ms');

    return {
        projectDraft,
        technicalBlueprint: {
            sourceText,
            summary: normalizedBlueprint.summary ?? undefined,
            components: normalizedBlueprint.components,
            dataDomains: normalizedBlueprint.dataDomains,
            integrations: normalizedBlueprint.integrations,
            architecturalNotes: normalizedBlueprint.architecturalNotes,
            assumptions: normalizedBlueprint.assumptions,
            missingInformation: normalizedBlueprint.missingInformation,
            confidence: normalizedBlueprint.confidence,
        },
        metrics: { pass1Ms, pass2Ms, totalMs },
    };
}
