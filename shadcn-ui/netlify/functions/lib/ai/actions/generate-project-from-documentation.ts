/**
 * AI Action: Generate Project from Documentation
 *
 * Three-pass pipeline:
 *   Pass 1 (gpt-5-mini) → Extract project draft metadata
 *   Pass 2 (gpt-5)      → Extract technical blueprint (using sourceText + pass 1 output)
 *   Pass 3 (gpt-5-mini) → Generate custom project activities from blueprint + catalog
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
    PROJECT_ACTIVITIES_SYSTEM_PROMPT,
    createProjectActivitiesResponseSchema,
} from '../prompts/project-activities-generation';
import type { GeneratedProjectActivity } from '../../domain/project/project-activity.types';
import {
    normalizeProjectTechnicalBlueprint,
} from '../post-processing/normalize-blueprint';
import type {
    ProjectDraftBlueprint,
    BlueprintComponentType,
    IntegrationDirection,
    EvidenceRef,
    BlueprintRelation,
    StructuredDocumentDigest,
} from '../../domain/project/project-technical-blueprint.types';
import { splitDocumentIntoChunks, CHUNKED_THRESHOLD } from '../chunking/document-chunker';
import { generatePartialSDD } from './generate-partial-sdd';
import { consolidatePartialSDDs } from './consolidate-sdd';
import { trimSDDForBudget, trimContextForBudget } from '../prompt-budget-guard';

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response types
// ─────────────────────────────────────────────────────────────────────────────

export interface TechnologyCatalogEntry {
    id: string;
    code: string;
    name: string;
}

export interface ActivityCatalogEntry {
    code: string;
    name: string;
    group: string;
    base_hours?: number;
}

export interface GenerateProjectFromDocRequest {
    sourceText: string;
    technologyCatalog?: TechnologyCatalogEntry[];
    activityCatalog?: ActivityCatalogEntry[];
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
            evidence?: EvidenceRef[];
        }>;
        dataDomains: Array<{
            name: string;
            description?: string;
            confidence?: number;
            evidence?: EvidenceRef[];
        }>;
        integrations: Array<{
            systemName: string;
            direction?: IntegrationDirection;
            description?: string;
            confidence?: number;
            evidence?: EvidenceRef[];
        }>;
        relations?: BlueprintRelation[];
        coverage?: number;
        qualityFlags?: string[];
        architecturalNotes: string[];
        assumptions: string[];
        missingInformation: string[];
        confidence?: number;
    };
    projectActivities: GeneratedProjectActivity[];
    structuredDigest?: StructuredDocumentDigest;
    metrics: {
        pass1Ms: number;
        pass2Ms: number;
        pass3Ms: number;
        totalMs: number;
        /** Present only when chunked SDD pipeline was used */
        chunkCount?: number;
        partialSuccessCount?: number;
        consolidationMs?: number;
        consolidationWarnings?: string[];
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const StructuredDocumentDigestSchema = z.object({
    functionalAreas: z.array(z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        keyPassages: z.array(z.string().max(300)).max(5),
    })).min(1).max(10),
    businessEntities: z.array(z.object({
        name: z.string().min(1).max(200),
        role: z.string().min(1).max(300),
    })).max(20),
    externalSystems: z.array(z.object({
        name: z.string().min(1).max(200),
        interactionDescription: z.string().min(1).max(300),
    })).max(15),
    technicalConstraints: z.array(z.string().max(500)).max(10),
    nonFunctionalRequirements: z.array(z.string().max(500)).max(10),
    keyPassages: z.array(z.object({
        label: z.string().min(1).max(100),
        text: z.string().min(1).max(300),
    })).min(3).max(20),
    ambiguities: z.array(z.string().max(500)).max(10),
    documentQuality: z.enum(['high', 'medium', 'low']),
});

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
    structuredDigest: StructuredDocumentDigestSchema,
});

const ComponentTypeEnum = z.enum([
    // Generic types
    'frontend', 'backend', 'database', 'integration', 'workflow',
    'reporting', 'security', 'infrastructure', 'external_system', 'other',
    // Power Platform specific
    'canvas_app', 'model_driven_app', 'dataverse_table', 'custom_connector',
    'cloud_flow', 'power_automate_desktop', 'pcf_control',
    // Backend specific
    'api_controller', 'service_layer', 'repository', 'middleware',
    'queue_processor', 'scheduled_job',
    // Frontend specific
    'page', 'component_library', 'state_manager', 'form', 'data_grid',
]);

const DirectionEnum = z.enum(['inbound', 'outbound', 'bidirectional', 'unknown']).nullable().optional();

// ── Pass 3 Zod schema ───────────────────────────────────────────────────────

const GeneratedActivitySchema = z.object({
    code: z.string().min(1).max(80).regex(/^PRJ_/),
    name: z.string().min(1).max(255),
    description: z.string().min(1).max(1000),
    group: z.enum(['ANALYSIS', 'DEV', 'TEST', 'OPS', 'GOVERNANCE']),
    baseHours: z.number().min(0.125).max(40),
    interventionType: z.enum(['NEW', 'MODIFY', 'CONFIGURE', 'MIGRATE']),
    effortModifier: z.number().min(0.1).max(2.0),
    sourceActivityCode: z.string().nullable(),
    blueprintNodeName: z.string().nullable(),
    blueprintNodeType: z.enum(['component', 'dataDomain', 'integration']).nullable(),
    aiRationale: z.string().min(1).max(500),
    confidence: z.number().min(0).max(1),
});

const ProjectActivitiesResponseSchema = z.object({
    activities: z.array(GeneratedActivitySchema).min(1).max(30),
});

const EvidenceRefSchema = z.object({
    sourceType: z.literal('source_text'),
    snippet: z.string().max(500),
}).optional();

const EvidenceArraySchema = z.array(
    z.object({ sourceType: z.literal('source_text'), snippet: z.string().max(500) }),
).optional().default([]);

const RelationSchema = z.object({
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
    type: z.enum(['reads', 'writes', 'orchestrates', 'syncs', 'owns', 'depends_on']),
    confidence: z.number().min(0).max(1).nullable().optional(),
    evidence: z.array(
        z.object({ sourceType: z.literal('source_text'), snippet: z.string().max(500) }),
    ).optional().default([]),
});

const TechnicalBlueprintSchema = z.object({
    summary: z.string().nullable().optional(),
    components: z.array(z.object({
        name: z.string().min(1).max(200),
        type: ComponentTypeEnum,
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
        evidence: EvidenceArraySchema,
    })).max(10),
    dataDomains: z.array(z.object({
        name: z.string().min(1).max(200),
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
        evidence: EvidenceArraySchema,
    })).max(20),
    integrations: z.array(z.object({
        systemName: z.string().min(1).max(200),
        direction: DirectionEnum,
        description: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
        evidence: EvidenceArraySchema,
    })).max(15),
    relations: z.array(RelationSchema).max(20).optional().default([]),
    coverage: z.number().min(0).max(1).optional(),
    qualityFlags: z.array(z.string()).optional().default([]),
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
    const { sourceText, technologyCatalog, activityCatalog } = request;
    const totalStart = Date.now();
    const provider = getDefaultProvider();

    console.log('[generate-project-from-doc] Starting, source text length:', sourceText.length,
        'technologies:', technologyCatalog?.length ?? 0,
        'activities:', activityCatalog?.length ?? 0);

    // ── Pass 1: Project Draft Extraction ────────────────────────────
    const pass1Start = Date.now();

    // Build user prompt with optional technology catalog
    const techCatalogBlock = technologyCatalog && technologyCatalog.length > 0
        ? `\n\nCATALOGO TECNOLOGIE DISPONIBILI (usa l'id corrispondente per technologyId):\n${technologyCatalog.map(t => `- id: "${t.id}" | code: "${t.code}" | name: "${t.name}"`).join('\n')}\n`
        : '';

    // Pass1 now digests the full document (up to 20K chars) to produce metadata + SDD
    const pass1SourceText = sourceText.length > 20000
        ? sourceText.slice(0, 20000) + '\n[... documento troncato per limiti di contesto ...]'
        : sourceText;
    const pass1UserPrompt = `DOCUMENTAZIONE PROGETTUALE:\n\n${pass1SourceText}${techCatalogBlock}`;
    const pass1Schema = createProjectDraftResponseSchema();

    const pass1Raw = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 4000,
        responseFormat: pass1Schema as any,
        systemPrompt: PROJECT_DRAFT_SYSTEM_PROMPT,
        userPrompt: pass1UserPrompt,
        reasoningEffort: 'low',
        options: { timeout: 120_000, maxRetries: 0 },
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

    let { structuredDigest, ...projectDraftFields } = pass1Validation.data;
    const projectDraft = projectDraftFields as ProjectDraftBlueprint;

    console.log('[generate-project-from-doc] SDD extracted:',
        structuredDigest?.functionalAreas?.length ?? 0, 'functional areas,',
        structuredDigest?.keyPassages?.length ?? 0, 'key passages,',
        'quality:', structuredDigest?.documentQuality ?? 'N/A');

    // ── Chunked SDD pipeline (large documents) ─────────────────────
    const chunkedEnabled = process.env.AI_CHUNKED_SDD_ENABLED === 'true';
    let chunkedMetrics: { chunkCount?: number; partialSuccessCount?: number; consolidationMs?: number; consolidationWarnings?: string[] } = {};

    if (chunkedEnabled && sourceText.length > CHUNKED_THRESHOLD) {
        console.log(`[generate-project-from-doc] Chunked SDD path: document ${sourceText.length} chars > ${CHUNKED_THRESHOLD} threshold`);
        const chunkStart = Date.now();

        try {
            // 1. Split document into chunks
            const chunks = splitDocumentIntoChunks(sourceText);
            console.log(`[generate-project-from-doc] Split into ${chunks.length} chunks`);
            chunkedMetrics.chunkCount = chunks.length;

            // 2. Generate partial SDDs with concurrency=2
            const partialResults = await generateAllPartialSDDs(chunks, provider);
            const successfulPartials = partialResults.filter(r => r !== null);
            chunkedMetrics.partialSuccessCount = successfulPartials.length;

            console.log(`[generate-project-from-doc] Partial SDDs: ${successfulPartials.length}/${chunks.length} succeeded`);

            // 3. Check minimum success threshold (50%)
            const successRate = successfulPartials.length / chunks.length;
            if (successRate < 0.5) {
                console.warn(`[generate-project-from-doc] Partial SDD success rate ${(successRate * 100).toFixed(0)}% below 50% threshold — keeping Pass 1 SDD`);
            } else {
                // 4. Consolidate partial SDDs into final SDD
                const consolidationResult = await consolidatePartialSDDs(successfulPartials, provider);
                chunkedMetrics.consolidationMs = Date.now() - chunkStart;
                chunkedMetrics.consolidationWarnings = consolidationResult.warnings;

                // Replace Pass 1 SDD with consolidated SDD
                structuredDigest = consolidationResult.sdd;

                console.log(`[generate-project-from-doc] Consolidated SDD replaces Pass 1 SDD (${chunkedMetrics.consolidationMs}ms, ${consolidationResult.warnings.length} warnings)`);
                if (consolidationResult.warnings.length > 0) {
                    console.log('[generate-project-from-doc] Consolidation warnings:', consolidationResult.warnings);
                }
            }
        } catch (chunkErr) {
            // Consolidation failure = pipeline failure (locked decision)
            console.error('[generate-project-from-doc] Chunked SDD pipeline failed:', chunkErr);
            throw new Error(`Chunked SDD pipeline failed: ${chunkErr instanceof Error ? chunkErr.message : String(chunkErr)}`);
        }
    }

    // ── Pass 2: Technical Blueprint Extraction ──────────────────────
    const pass2Start = Date.now();

    // Resolve technology name from Pass1 technologyId
    const resolvedTechName = projectDraft.technologyId && technologyCatalog
        ? technologyCatalog.find(t => t.id === projectDraft.technologyId)?.name ?? null
        : null;

    const pass2SourceText = structuredDigest
        ? trimSDDForBudget(JSON.stringify(structuredDigest, null, 2))
        : (sourceText.length > 12000
            ? sourceText.slice(0, 12000) + '\n[... documento troncato per limiti di contesto ...]'
            : sourceText);

    const pass2UserPrompt = structuredDigest
        ? [
            `DIGEST STRUTTURATO DEL DOCUMENTO:\n\n${pass2SourceText}`,
            `\nMETADATI PROGETTO ESTRATTI (dal pass precedente):`,
            `- Nome: ${projectDraft.name}`,
            `- Descrizione: ${projectDraft.description}`,
            projectDraft.projectType ? `- Tipo: ${projectDraft.projectType}` : null,
            projectDraft.domain ? `- Dominio: ${projectDraft.domain}` : null,
            projectDraft.scope ? `- Scope: ${projectDraft.scope}` : null,
            projectDraft.methodology ? `- Metodologia: ${projectDraft.methodology}` : null,
            resolvedTechName ? `- Tecnologia primaria: ${resolvedTechName}` : null,
        ].filter(Boolean).join('\n')
        : [
            `DOCUMENTAZIONE PROGETTUALE:\n\n${pass2SourceText}`,
            `\nMETADATI PROGETTO ESTRATTI (dal pass precedente):`,
            `- Nome: ${projectDraft.name}`,
            `- Descrizione: ${projectDraft.description}`,
            projectDraft.projectType ? `- Tipo: ${projectDraft.projectType}` : null,
            projectDraft.domain ? `- Dominio: ${projectDraft.domain}` : null,
            projectDraft.scope ? `- Scope: ${projectDraft.scope}` : null,
            projectDraft.methodology ? `- Metodologia: ${projectDraft.methodology}` : null,
            resolvedTechName ? `- Tecnologia primaria: ${resolvedTechName}` : null,
        ].filter(Boolean).join('\n');

    const pass2Schema = createTechnicalBlueprintResponseSchema();

    const pass2Raw = await provider.generateContent({
        model: 'gpt-5',
        temperature: 0.2,
        maxTokens: 8000,
        responseFormat: pass2Schema as any,
        systemPrompt: TECHNICAL_BLUEPRINT_SYSTEM_PROMPT,
        userPrompt: pass2UserPrompt,
        reasoningEffort: 'low',
        options: { timeout: 150_000, maxRetries: 0 },
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
                evidence: c.evidence ?? [],
            })),
            dataDomains: blueprintData.dataDomains.map((d) => ({
                name: d.name,
                description: d.description ?? undefined,
                confidence: d.confidence ?? undefined,
                evidence: d.evidence ?? [],
            })),
            integrations: blueprintData.integrations.map((i) => ({
                systemName: i.systemName,
                direction: (i.direction ?? undefined) as IntegrationDirection | undefined,
                description: i.description ?? undefined,
                confidence: i.confidence ?? undefined,
                evidence: i.evidence ?? [],
            })),
            relations: (blueprintData.relations ?? []).map((r) => ({
                id: '', // normalizer will generate deterministic IDs
                fromNodeId: r.fromNodeId,
                toNodeId: r.toNodeId,
                type: r.type,
                confidence: r.confidence ?? undefined,
                evidence: r.evidence ?? [],
            })),
            coverage: blueprintData.coverage,
            qualityFlags: blueprintData.qualityFlags ?? [],
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

    // ── Pass 3: Project Activities Generation ───────────────────
    const pass3Start = Date.now();

    // Build grouped activity catalog block for effort calibration (compact: code + base_hours only)
    let catalogBlock = '';
    if (activityCatalog && activityCatalog.length > 0) {
        const grouped = new Map<string, string[]>();
        for (const a of activityCatalog) {
            const group = a.group || 'OTHER';
            if (!grouped.has(group)) grouped.set(group, []);
            grouped.get(group)!.push(`${a.code} (${a.base_hours ?? '?'}h)`);
        }
        catalogBlock = Array.from(grouped.entries())
            .map(([group, items]) => `${group}: ${items.join(', ')}`)
            .join('\n');
    }

    // Build blueprint summary for Pass 3 (compact)
    const blueprintSummaryLines = [
        'COMPONENTS:',
        ...normalizedBlueprint.components.map(c => `  - ${c.name} (${c.type})`),
        'DATA DOMAINS:',
        ...normalizedBlueprint.dataDomains.map(d => `  - ${d.name}`),
        'INTEGRATIONS:',
        ...normalizedBlueprint.integrations.map(i => `  - ${i.systemName} (${i.direction ?? '?'})`),
    ];

    // Build digest summary for Pass 3 (compact text from SDD or fallback to truncated source)
    let pass3ContextBlock: string;
    if (structuredDigest) {
        const areaLines = (structuredDigest.functionalAreas ?? [])
            .map(a => `  - ${a.title}: ${a.description}`).join('\n');
        const entityLines = (structuredDigest.businessEntities ?? [])
            .map(e => `  - ${e.name}: ${e.role}`).join('\n');
        const extLines = (structuredDigest.externalSystems ?? [])
            .map(s => `  - ${s.name}: ${s.interactionDescription}`).join('\n');
        pass3ContextBlock = [
            `CONTESTO DOCUMENTO (dal digest strutturato):`,
            areaLines ? `\nAREE FUNZIONALI:\n${areaLines}` : null,
            entityLines ? `\nENTITÀ DI BUSINESS:\n${entityLines}` : null,
            extLines ? `\nSISTEMI ESTERNI:\n${extLines}` : null,
            structuredDigest.technicalConstraints?.length
                ? `\nVINCOLI TECNICI: ${structuredDigest.technicalConstraints.join('; ')}` : null,
            structuredDigest.nonFunctionalRequirements?.length
                ? `\nREQUISITI NON FUNZIONALI: ${structuredDigest.nonFunctionalRequirements.join('; ')}` : null,
        ].filter(Boolean).join('\n');
    } else {
        const pass3SourceText = sourceText.length > 2000
            ? sourceText.slice(0, 2000) + '\n[... troncato ...]'
            : sourceText;
        pass3ContextBlock = `DOCUMENTAZIONE PROGETTUALE (estratto):\n\n${pass3SourceText}`;
    }

    pass3ContextBlock = trimContextForBudget(pass3ContextBlock);

    const pass3UserPrompt = [
        pass3ContextBlock,
        `\nMETADATI PROGETTO:`,
        `- Nome: ${projectDraft.name}`,
        `- Descrizione: ${projectDraft.description}`,
        projectDraft.projectType ? `- Tipo progetto: ${projectDraft.projectType}` : null,
        projectDraft.domain ? `- Dominio: ${projectDraft.domain}` : null,
        projectDraft.scope ? `- Scope: ${projectDraft.scope}` : null,
        projectDraft.methodology ? `- Metodologia: ${projectDraft.methodology}` : null,
        resolvedTechName ? `- Tecnologia: ${resolvedTechName}` : null,
        `\nBLUEPRINT TECNICO:\n${blueprintSummaryLines.join('\n')}`,
        catalogBlock ? `\nCATALOGO ATTIVITÀ STANDARD (riferimento scala effort):\n${catalogBlock}` : null,
    ].filter(Boolean).join('\n');

    const pass3Schema = createProjectActivitiesResponseSchema();

    let projectActivities: GeneratedProjectActivity[] = [];
    try {
        const pass3Raw = await provider.generateContent({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            maxTokens: 3000,
            responseFormat: pass3Schema as any,
            systemPrompt: PROJECT_ACTIVITIES_SYSTEM_PROMPT,
            userPrompt: pass3UserPrompt,
            options: { timeout: 60000, maxRetries: 0 },
        });

        if (pass3Raw) {
            const pass3Parsed = JSON.parse(pass3Raw);
            const pass3Validation = ProjectActivitiesResponseSchema.safeParse(pass3Parsed);
            if (pass3Validation.success) {
                // Deduplicate codes — keep first occurrence
                const seenCodes = new Set<string>();
                projectActivities = pass3Validation.data.activities.filter(a => {
                    if (seenCodes.has(a.code)) return false;
                    seenCodes.add(a.code);
                    return true;
                });
            } else {
                console.warn('[generate-project-from-doc] Pass 3 validation failed:', pass3Validation.error.issues);
            }
        }
    } catch (pass3Err) {
        console.warn('[generate-project-from-doc] Pass 3 failed (non-blocking):', pass3Err);
    }

    const pass3Ms = Date.now() - pass3Start;
    console.log('[generate-project-from-doc] Pass 3 completed in', pass3Ms, 'ms,', projectActivities.length, 'activities');

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
            relations: normalizedBlueprint.relations ?? [],
            coverage: normalizedBlueprint.coverage,
            qualityFlags: normalizedBlueprint.qualityFlags ?? [],
            architecturalNotes: normalizedBlueprint.architecturalNotes,
            assumptions: normalizedBlueprint.assumptions,
            missingInformation: normalizedBlueprint.missingInformation,
            confidence: normalizedBlueprint.confidence,
        },
        structuredDigest: structuredDigest ?? undefined,
        projectActivities,
        metrics: {
            pass1Ms, pass2Ms, pass3Ms, totalMs,
            ...(chunkedMetrics.chunkCount != null ? {
                chunkCount: chunkedMetrics.chunkCount,
                partialSuccessCount: chunkedMetrics.partialSuccessCount,
                consolidationMs: chunkedMetrics.consolidationMs,
                consolidationWarnings: chunkedMetrics.consolidationWarnings,
            } : {}),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunked pipeline helpers
// ─────────────────────────────────────────────────────────────────────────────

import type { DocumentChunk } from '../chunking/document-chunker';
import type { PartialSDD } from './generate-partial-sdd';

/**
 * Generate partial SDDs for all chunks with concurrency=2.
 * Returns array with null for failed chunks.
 */
async function generateAllPartialSDDs(
    chunks: DocumentChunk[],
    provider: ReturnType<typeof getDefaultProvider>,
): Promise<PartialSDD[]> {
    const results: (PartialSDD | null)[] = new Array(chunks.length).fill(null);
    const CONCURRENCY = 2;

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
            batch.map((chunk, idx) =>
                generatePartialSDD(chunk, provider)
                    .then(result => { results[i + idx] = result; })
            ),
        );

        for (let j = 0; j < batchResults.length; j++) {
            if (batchResults[j].status === 'rejected') {
                console.warn(`[generate-project-from-doc] Chunk ${i + j + 1}/${chunks.length} failed:`,
                    (batchResults[j] as PromiseRejectedResult).reason);
            }
        }
    }

    return results.filter((r): r is PartialSDD => r !== null);
}
