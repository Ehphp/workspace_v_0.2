/**
 * Netlify Function: AI Requirement Interview — Information-Gain Planner
 *
 * Replaces the previous "always generate 4-6 questions" approach with an
 * **information-gain** strategy:
 *
 *   Round 0 (this endpoint — single LLM call):
 *     - Pre-estimate the requirement (minHours / maxHours / confidence)
 *     - Decide ASK or SKIP (is the interview worth the user's time?)
 *     - If ASK: produce 1-3 high-impact questions with per-option impact scores
 *
 *   Round 1 (ai-estimate-from-interview, unchanged):
 *     - After the user answers, generate the final detailed estimate.
 *
 * This gives:
 *   • Simple requirements → 1 LLM call total (SKIP path)
 *   • Complex requirements → 2 LLM calls total (ASK + estimate)
 *
 * Backward compatible: response still includes questions[], reasoning,
 * estimatedComplexity, suggestedActivities.  New consumers also get
 * decision, preEstimate, and per-question impact data.
 *
 * POST /.netlify/functions/ai-requirement-interview
 */

import { createAIHandler } from './lib/handler';
import { getDefaultProvider } from './lib/ai/openai-client';
import {
    fetchActivitiesServerSide,
    formatActivitiesSummary,
} from './lib/activities';
import {
    mapBlueprintToActivities,
    isBlueprintMappable,
    blueprintToNormalizedSignals,
    type BlueprintMappingResult,
} from './lib/blueprint-activity-mapper';
import {
    extractImpactMapSignals,
    impactMapToNormalizedSignals,
} from './lib/impact-map-signal-extractor';
import {
    extractUnderstandingSignals,
    understandingToNormalizedSignals,
} from './lib/understanding-signal-extractor';
import { keywordToNormalizedSignals } from './lib/domain/pipeline/keyword-signal-adapter';
import {
    synthesizeCandidates,
    computeCandidateLimit,
    type SynthesizedCandidateSet,
} from './lib/domain/pipeline/candidate-synthesizer';
import type { SignalSet } from './lib/domain/pipeline/signal-types';
import { retrieveRAGContext, getRAGSystemPromptAddition } from './lib/ai/rag';
import { isVectorSearchEnabled } from './lib/ai/vector-search';
import { formatProjectContextBlock } from './lib/ai/prompt-builder';
import { evaluateProjectContextRules } from './lib/domain/estimation/project-context-rules';
import { evaluateProjectTechnicalBlueprintRules } from './lib/domain/estimation/blueprint-rules';
import { mergeProjectAndBlueprintRules } from './lib/domain/estimation/blueprint-context-integration';
import type { ProjectTechnicalBlueprint } from './lib/domain/project/project-technical-blueprint.types';
import type { EstimationContext } from './lib/domain/types/estimation';
import { formatProjectTechnicalBlueprintBlock } from './lib/ai/formatters/project-blueprint-formatter';
import { computeAggregateConfidence } from './lib/domain/estimation/canonical-profile.service';
import { computePipelineConfig } from './lib/domain/pipeline/pipeline-config';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (tunable via env)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum confidence to allow skipping the interview */
const SKIP_CONFIDENCE_THRESHOLD = Number(process.env.AI_INTERVIEW_SKIP_CONFIDENCE ?? 0.90);

/** Maximum range (hours) to allow skipping — even if confidence is high,
 *  a wide range suggests the model is uncertain and should ASK. */
const SKIP_MAX_RANGE_HOURS = Number(process.env.AI_INTERVIEW_SKIP_RANGE ?? 16);

/** Minimum expectedRangeReductionPct for a question to be worth asking */
const MIN_IMPACT_PCT = Number(process.env.AI_INTERVIEW_MIN_IMPACT ?? 15);

/** Maximum questions to include in the planner output */
const MAX_QUESTIONS = 3;

/** Minimum similarity to inject historical examples into the planner prompt */
const RAG_MIN_SIMILARITY = Number(process.env.AI_INTERVIEW_RAG_MIN_SIMILARITY ?? 0.60);

/** Similarity threshold to force SKIP (very close historical match) */
const RAG_AUTO_SKIP_SIMILARITY = Number(process.env.AI_INTERVIEW_RAG_SKIP_SIMILARITY ?? 0.85);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
    projectType?: string;
    domain?: string;
    scope?: string;
    teamSize?: number;
    deadlinePressure?: string;
    methodology?: string;
}

interface RequestBody {
    description: string;
    techPresetId: string;
    techCategory: string;
    projectContext?: ProjectContext;
    /** Optional structured understanding from Requirement Understanding step */
    requirementUnderstanding?: Record<string, unknown>;
    /** Optional impact map from Impact Map step */
    impactMap?: Record<string, unknown>;
    /** Optional estimation blueprint — structured technical work model */
    estimationBlueprint?: Record<string, unknown>;
    /** Optional project technical blueprint — architectural baseline from project creation */
    projectTechnicalBlueprint?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt (Information-Gain Planner)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un Tech Lead esperto specializzato in {TECH_CATEGORY}.
Devi analizzare un requisito software e decidere se servono domande chiarificatrici
per produrre una stima accurata oppure se puoi già stimare con sufficiente confidenza.

STACK TECNOLOGICO: {TECH_CATEGORY}

{TECH_SPECIFIC_QUESTIONS}

HAI A DISPOSIZIONE IL CATALOGO ATTIVITÀ (codice, nome, ore base).
Usalo per ancorare la tua pre-stima a ore realistiche.

═══════════════════════════════════════════════════
FASE 1 — PRE-STIMA (obbligatoria)
═══════════════════════════════════════════════════
Analizza il requisito + il catalogo attività e produci:
- minHours: stima ottimistica (caso migliore ragionevole)
- maxHours: stima pessimistica (caso peggiore ragionevole)
- confidence: 0.0-1.0 — quanto sei sicuro che il range copra la realtà

═══════════════════════════════════════════════════
FASE 2 — DECISIONE (ASK o SKIP)
═══════════════════════════════════════════════════
Decidi "SKIP" (vai direttamente alla stima finale) SE:
- confidence >= 0.90 E
- (maxHours - minHours) <= 16
Oppure se sono presenti ESEMPI STORICI con similarità >= 85%
(il requisito è già stato stimato in passato con risultati simili).
Altrimenti decidi "ASK".

═══════════════════════════════════════════════════
FASE 3 — DOMANDE con INFORMATION GAIN (solo se ASK)
═══════════════════════════════════════════════════
Proponi domande SOLO SE riducono significativamente l'incertezza della stima.

Per ogni domanda:
1. Stima quanto la risposta restringerebbe o sposterebbe il range della pre-stima
2. Calcola expectedRangeReductionPct (percentuale attesa di riduzione del range)
3. Assegna importance: "high" (>= 30%), "medium" (15-29%), "low" (< 15%)
4. Includi la domanda SOLO se expectedRangeReductionPct >= 15

REGOLE DOMANDE:
- Massimo 3 domande (le più impattanti sulla stima)
- Domande DA TECNICO A TECNICO — terminologia specifica di {TECH_CATEGORY}
- ⛔ NO type "text" — solo single-choice, multiple-choice, range
- Ogni opzione deve riflettere scelte implementative reali
- Per single-choice: 2-5 opzioni. Per multiple-choice: 3+ opzioni
- Per campi non usati (es. min/max per single-choice), usa null
- Ordina le domande per expectedRangeReductionPct decrescente`;

// ─────────────────────────────────────────────────────────────────────────────
// Technology-specific guidance
// ─────────────────────────────────────────────────────────────────────────────

const TECH_SPECIFIC_PROMPTS: Record<string, string> = {
    'POWER_PLATFORM': `
AREE TIPICHE DI INCERTEZZA PER POWER PLATFORM:
- Dataverse: numero tabelle/entità, campi custom, relazioni, migrazione dati, row-level security
- Power Apps: Canvas vs Model-Driven, numero schermate/form, componenti custom (PCF)
- Power Automate: numero flussi, trigger vs scheduled, connettori esterni, approval workflow
- Business Rules: Plugin/Custom Actions, JavaScript form scripting
- Deploy: numero ambienti, solution managed/unmanaged`,

    'BACKEND': `
AREE TIPICHE DI INCERTEZZA PER BACKEND (.NET/API):
- API Design: numero endpoint, REST/GraphQL/gRPC, autenticazione (JWT/OAuth2)
- Database: nuove tabelle/migrazioni EF Core, stored procedures, caching (Redis)
- Integration: servizi esterni, message queue, event-driven, circuit breaker
- Business Logic: CRUD semplice vs orchestrazione complessa, background jobs
- Deploy: Azure/AWS/on-premise, container, CI/CD`,

    'FRONTEND': `
AREE TIPICHE DI INCERTEZZA PER FRONTEND (React/Vue/Angular):
- UI: numero pagine/viste, complessità form, design system, responsive, WCAG
- State: store globale (Redux/Zustand), caching client-side, optimistic updates
- API: numero integrazioni, real-time (WebSocket/SSE), error handling
- Testing: unit test componenti, E2E (Cypress/Playwright), visual regression
- Build: SSR, CDN, bundle optimization`,

    'MULTI': `
AREE TIPICHE DI INCERTEZZA PER PROGETTI MULTI-STACK:
- Architettura: numero layer/componenti, comunicazione sync/async, API gateway
- Coordinamento: team coinvolti, contratti API, dipendenze tra componenti
- Testing: E2E cross-system, environment di integrazione`,
};

function getTechSpecificPrompt(techCategory: string): string {
    return TECH_SPECIFIC_PROMPTS[techCategory] || TECH_SPECIFIC_PROMPTS['MULTI'];
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema for Structured Output (OpenAI strict mode)
// ─────────────────────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'interview_plan_response',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                decision: {
                    type: 'string',
                    enum: ['ASK', 'SKIP'],
                },
                preEstimate: {
                    type: 'object',
                    properties: {
                        minHours: { type: 'number' },
                        maxHours: { type: 'number' },
                        confidence: { type: 'number' },
                    },
                    required: ['minHours', 'maxHours', 'confidence'],
                    additionalProperties: false,
                },
                questions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            type: {
                                type: 'string',
                                enum: ['single-choice', 'multiple-choice', 'range'],
                            },
                            category: {
                                type: 'string',
                                enum: [
                                    'INTEGRATION', 'DATA', 'SECURITY', 'PERFORMANCE',
                                    'UI_UX', 'ARCHITECTURE', 'TESTING', 'DEPLOYMENT',
                                ],
                            },
                            question: { type: 'string' },
                            technicalContext: { type: 'string' },
                            impactOnEstimate: { type: 'string' },
                            options: {
                                type: ['array', 'null'],
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        label: { type: 'string' },
                                        description: { type: 'string' },
                                    },
                                    required: ['id', 'label', 'description'],
                                    additionalProperties: false,
                                },
                            },
                            required: { type: 'boolean' },
                            min: { type: ['number', 'null'] },
                            max: { type: ['number', 'null'] },
                            step: { type: ['number', 'null'] },
                            unit: { type: ['string', 'null'] },
                            impact: {
                                type: 'object',
                                properties: {
                                    expectedRangeReductionPct: { type: 'number' },
                                    importance: {
                                        type: 'string',
                                        enum: ['high', 'medium', 'low'],
                                    },
                                },
                                required: ['expectedRangeReductionPct', 'importance'],
                                additionalProperties: false,
                            },
                        },
                        required: [
                            'id', 'type', 'category', 'question', 'technicalContext',
                            'impactOnEstimate', 'required', 'options',
                            'min', 'max', 'step', 'unit', 'impact',
                        ],
                        additionalProperties: false,
                    },
                },
                reasoning: { type: 'string' },
                estimatedComplexity: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH'],
                },
                suggestedActivities: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
            required: [
                'decision', 'preEstimate', 'questions',
                'reasoning', 'estimatedComplexity', 'suggestedActivities',
            ],
            additionalProperties: false,
        },
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Tech Category Descriptions
// ─────────────────────────────────────────────────────────────────────────────

function getTechCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        'BACKEND': 'Backend .NET/API (C#, ASP.NET Core, Entity Framework)',
        'BACKEND_API': 'Backend API (REST/GraphQL services)',
        'FRONTEND': 'Frontend Web (React, TypeScript, CSS)',
        'FRONTEND_WEB': 'Frontend Web (React, Vue, Angular)',
        'FRONTEND_MOBILE': 'Mobile App (React Native, Flutter, Native)',
        'FULLSTACK': 'Full Stack (Frontend + Backend)',
        'DATA_PIPELINE': 'Data Pipeline (ETL, Data Processing)',
        'INFRASTRUCTURE': 'Infrastructure (DevOps, Cloud)',
        'POWER_PLATFORM': 'Microsoft Power Platform (Power Apps, Power Automate, Dataverse)',
        'POWERPLATFORM': 'Microsoft Power Platform (Power Apps, Power Automate, Dataverse)',
        'DYNAMICS365': 'Microsoft Dynamics 365',
        'SHAREPOINT': 'SharePoint / Microsoft 365',
        'MULTI': 'Multi-technology / Cross-platform',
    };
    return descriptions[category] || category;
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Understanding → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatUnderstandingBlock(ru: Record<string, unknown> | undefined): string {
    if (!ru || typeof ru !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nCOMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall\'utente — usala per ridurre ambiguità, NON ignorare descrizione originale):');
        if (ru.businessObjective) lines.push(`- Obiettivo: ${ru.businessObjective}`);
        if (ru.expectedOutput) lines.push(`- Output atteso: ${ru.expectedOutput}`);
        if (Array.isArray(ru.functionalPerimeter) && ru.functionalPerimeter.length > 0) {
            lines.push(`- Perimetro: ${ru.functionalPerimeter.join('; ')}`);
        }
        if (Array.isArray(ru.exclusions) && ru.exclusions.length > 0) {
            lines.push(`- Esclusioni: ${ru.exclusions.join('; ')}`);
        }
        if (Array.isArray(ru.actors) && ru.actors.length > 0) {
            const actorStr = ru.actors.map((a: any) => {
                const tag = a.type === 'system' ? '[SYSTEM]' : '[HUMAN]';
                const mode = a.interactionMode ? ` (${a.interactionMode})` : '';
                return `${tag} ${a.role}${mode} — ${a.interaction}`;
            }).join('; ');
            lines.push(`- Attori: ${actorStr}`);
        }
        const st = ru.stateTransition as any;
        if (st?.initialState && st?.finalState) {
            lines.push(`- Transizione: da "${st.initialState}" a "${st.finalState}"`);
        }
        if (Array.isArray(ru.preconditions) && ru.preconditions.length > 0) {
            lines.push(`- Precondizioni: ${ru.preconditions.join('; ')}`);
        }
        if (Array.isArray(ru.assumptions) && ru.assumptions.length > 0) {
            lines.push(`- Assunzioni: ${ru.assumptions.join('; ')}`);
        }
        const ca = ru.complexityAssessment as any;
        if (ca?.level) {
            lines.push(`- Complessità stimata: ${ca.level}${ca.rationale ? ` — ${ca.rationale}` : ''}`);
        }
        if (typeof ru.confidence === 'number') {
            lines.push(`- Confidenza comprensione: ${Math.round((ru.confidence as number) * 100)}%`);
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact Map → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatImpactMapBlock(im: Record<string, unknown> | undefined): string {
    if (!im || typeof im !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nMAPPA IMPATTO ARCHITETTURALE (validata dall\'utente — usala per focalizzare domande sui layer a bassa confidenza, NON sostituisce descrizione o comprensione):');
        if (im.summary) lines.push(`Sintesi: ${im.summary}`);
        if (typeof im.overallConfidence === 'number') {
            lines.push(`Confidenza complessiva: ${Math.round((im.overallConfidence as number) * 100)}%`);
        }
        if (Array.isArray(im.impacts) && im.impacts.length > 0) {
            lines.push('Impatti:');
            for (const item of im.impacts) {
                if (!item || typeof item !== 'object') continue;
                const layer = item.layer || '?';
                const action = item.action || '?';
                const components = Array.isArray(item.components) ? item.components.join(', ') : '';
                const reason = item.reason || '';
                const conf = typeof item.confidence === 'number' ? ` (${Math.round(item.confidence * 100)}%)` : '';
                lines.push(`- ${layer} [${action}]: ${components} — ${reason}${conf}`);
            }
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation Blueprint → compact prompt block (optional enrichment)
// ─────────────────────────────────────────────────────────────────────────────

function formatBlueprintBlock(bp: Record<string, unknown> | undefined): string {
    if (!bp || typeof bp !== 'object') return '';
    try {
        const lines: string[] = [];
        lines.push('\nBLUEPRINT TECNICO (modello strutturale validato dall\'utente — usalo per focalizzare domande sui componenti a più alta complessità, NON sostituisce descrizione):');
        if (bp.summary) lines.push(`Sintesi: ${bp.summary}`);
        if (typeof bp.overallConfidence === 'number') {
            lines.push(`Confidenza complessiva: ${Math.round((bp.overallConfidence as number) * 100)}%`);
        }
        if (Array.isArray(bp.components) && bp.components.length > 0) {
            lines.push('Componenti:');
            for (const c of bp.components) {
                if (!c || typeof c !== 'object') continue;
                const name = c.name || '?';
                const layer = c.layer || '?';
                const intervention = c.interventionType || '?';
                const complexity = c.complexity || '?';
                lines.push(`- ${name} [${layer}/${intervention}] complessità: ${complexity}`);
            }
        }
        if (Array.isArray(bp.integrations) && bp.integrations.length > 0) {
            lines.push('Integrazioni: ' + bp.integrations.map((i: any) => `${i.systemName || '?'} (${i.direction || '?'})`).join(', '));
        }
        if (Array.isArray(bp.uncertainties) && bp.uncertainties.length > 0) {
            lines.push('Incertezze: ' + bp.uncertainties.join('; '));
        }
        return lines.length > 1 ? lines.join('\n') : '';
    } catch {
        return '';
    }
}

// formatProjectTechnicalBlueprintBlock — imported from lib/ai/formatters/project-blueprint-formatter

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-requirement-interview',
    requireAuth: false, // Allow unauthenticated for Quick Estimate demo
    requireLLM: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'Missing or invalid description field';
        }
        // techCategory is optional — projects may have no technology selected
        // Defaults to 'MULTI' in handler if missing
        return null;
    },

    handler: async (body, ctx) => {
        const pipelineStart = Date.now();
        const sanitizedDescription = ctx.sanitize(body.description);

        if (sanitizedDescription.length < 15) {
            throw new Error('La descrizione deve contenere almeno 15 caratteri.');
        }
        if (sanitizedDescription.length > 2000) {
            throw new Error('La descrizione è troppo lunga (max 2000 caratteri).');
        }

        const techCat = body.techCategory || 'MULTI';
        const techCategoryDescription = getTechCategoryDescription(techCat);
        const techSpecificPrompt = getTechSpecificPrompt(techCat);

        // ─── Fetch activities server-side (needed for pre-estimate) ─────────
        const fetchResult = await fetchActivitiesServerSide(
            techCat,
            body.techPresetId,
        );

        // ─── Project Context Rules (deterministic, pre-AI) ──────────
        const interviewEstCtx: EstimationContext = {
            technologyId: body.techPresetId ?? null,
            techCategory: techCat ?? null,
            project: body.projectContext ? {
                name: body.projectContext.name,
                description: body.projectContext.description,
                owner: body.projectContext.owner,
                projectType: body.projectContext.projectType as any,
                domain: body.projectContext.domain,
                scope: body.projectContext.scope as any,
                teamSize: body.projectContext.teamSize,
                deadlinePressure: body.projectContext.deadlinePressure as any,
                methodology: body.projectContext.methodology as any,
            } : null,
        };
        const interviewContextRules = evaluateProjectContextRules(interviewEstCtx);

        // ─── Blueprint deterministic rules ─────────────────────────────
        const blueprintRules = evaluateProjectTechnicalBlueprintRules(
            body.projectTechnicalBlueprint as unknown as ProjectTechnicalBlueprint | undefined,
        );
        const mergedRules = mergeProjectAndBlueprintRules(interviewContextRules, blueprintRules);
        if (mergedRules.notes.length > 0) {
            console.log('[ai-requirement-interview] Merged context+blueprint rules:', mergedRules.notes);
        }

        // ─── Candidate generation: CandidateSynthesizer (multi-signal) ──

        // Step 1: Run extractors
        const blueprintMappingResult: BlueprintMappingResult | undefined =
            body.estimationBlueprint && isBlueprintMappable(body.estimationBlueprint)
                ? mapBlueprintToActivities(body.estimationBlueprint, fetchResult.activities, techCat)
                : undefined;

        const impactMapResult = body.impactMap && (body.impactMap as any).impacts?.length > 0
            ? extractImpactMapSignals(body.impactMap as any, fetchResult.activities, techCat)
            : undefined;

        const understandingResult = body.requirementUnderstanding
            ? extractUnderstandingSignals(body.requirementUnderstanding as any, fetchResult.activities, techCat)
            : undefined;

        // Step 2: Normalize to SignalSets
        const signalSets: SignalSet[] = [];
        if (blueprintMappingResult) signalSets.push(blueprintToNormalizedSignals(blueprintMappingResult));
        if (impactMapResult) signalSets.push(impactMapToNormalizedSignals(impactMapResult));
        if (understandingResult) signalSets.push(understandingToNormalizedSignals(understandingResult));
        signalSets.push(keywordToNormalizedSignals({
            activities: fetchResult.activities,
            description: sanitizedDescription,
            answers: undefined, // no answers at interview planner stage
            topN: 30,
            blueprint: body.estimationBlueprint,
            activityBiases: mergedRules.activityBiases,
        }));

        // Step 3: Synthesize candidates
        const aggregateConfidence = computeAggregateConfidence(
            body.requirementUnderstanding as Record<string, unknown> | null,
            body.impactMap as Record<string, unknown> | null,
            (body.estimationBlueprint ?? {}) as Record<string, unknown>,
            false,
        );
        const candidateLimit = computeCandidateLimit(aggregateConfidence);
        const pipelineConfig = computePipelineConfig(aggregateConfidence);
        console.log(`[ai-requirement-interview] Dynamic candidate sizing: confidence=${aggregateConfidence}, limit=${candidateLimit}`);
        console.log(`[ai-requirement-interview] PipelineConfig: skipInterview=${pipelineConfig.skipInterview}, skipReflection=${pipelineConfig.skipReflection}, aggressiveExpansion=${pipelineConfig.aggressiveExpansion}`);

        const candidateResult: SynthesizedCandidateSet = synthesizeCandidates({
            signalSets,
            catalog: fetchResult.activities,
            techCategory: techCat,
            config: { maxCandidates: candidateLimit },
        });

        const rankedActivities = candidateResult.candidates.map(c => c.activity);
        if (blueprintMappingResult?.warnings && blueprintMappingResult.warnings.length > 0) {
            console.log(`[ai-requirement-interview] Blueprint warnings: ${blueprintMappingResult.warnings.map(w => `[${w.code}] ${w.message}`).join('; ')}`);
        }

        const activitiesSummary = rankedActivities.length > 0
            ? formatActivitiesSummary(rankedActivities)
            : '(nessuna attività disponibile — stima senza catalogo)';

        // ─── RAG: search for similar historical requirements ────────────
        let ragFragment = '';
        let ragTopSimilarity = 0;
        let ragExampleCount = 0;
        let ragMs = 0;

        if (isVectorSearchEnabled()) {
            try {
                const ragContext = await retrieveRAGContext(sanitizedDescription, ctx.userId);
                ragMs = ragContext.searchLatencyMs;
                ragExampleCount = ragContext.examples.length;
                if (ragContext.hasExamples) {
                    ragTopSimilarity = Math.max(...ragContext.examples.map(e => e.similarity));
                    // Only include examples above the planner threshold
                    const relevant = ragContext.examples.filter(e => e.similarity >= RAG_MIN_SIMILARITY);
                    if (relevant.length > 0) {
                        ragFragment = ragContext.promptFragment;
                        console.log(`[ai-requirement-interview] RAG: ${relevant.length} historical examples (top similarity: ${Math.round(ragTopSimilarity * 100)}%)`);
                    }
                }
            } catch (ragErr) {
                console.warn('[ai-requirement-interview] RAG search failed (non-blocking):', ragErr instanceof Error ? ragErr.message : ragErr);
            }
        }

        console.log('[ai-requirement-interview] Planner starting:', {
            descriptionLength: sanitizedDescription.length,
            techCategory: techCat,
            techPresetId: body.techPresetId,
            hasProjectContext: !!body.projectContext,
            hasRequirementUnderstanding: !!body.requirementUnderstanding,
            hasImpactMap: !!body.impactMap,
            activitiesFetched: fetchResult.activities.length,
            activitiesRanked: rankedActivities.length,
            activitiesSource: fetchResult.source,
            fetchMs: fetchResult.fetchMs,
            ragExamples: ragExampleCount,
            ragTopSimilarity: Math.round(ragTopSimilarity * 100),
            ragMs,
        });

        // ─── Build prompts ──────────────────────────────────────────────────
        let systemPromptFull = SYSTEM_PROMPT
            .replace(/{TECH_CATEGORY}/g, techCategoryDescription)
            .replace('{TECH_SPECIFIC_QUESTIONS}', techSpecificPrompt);

        // Append RAG learning instructions if we have historical examples
        if (ragFragment) {
            systemPromptFull += '\n' + getRAGSystemPromptAddition();
        }

        let projectContextSection = '';
        if (body.projectContext) {
            projectContextSection = formatProjectContextBlock(body.projectContext) +
                '\n(informazioni già note, NON chiedere domande su questi aspetti)\n';
        }

        const userPrompt = `${projectContextSection}${formatUnderstandingBlock(body.requirementUnderstanding)}${formatImpactMapBlock(body.impactMap)}${formatBlueprintBlock(body.estimationBlueprint)}${formatProjectTechnicalBlueprintBlock(body.projectTechnicalBlueprint)}
STACK: ${techCategoryDescription}

CATALOGO ATTIVITÀ DISPONIBILI (per ancorare la pre-stima):
${activitiesSummary}
${ragFragment ? `\n${ragFragment}` : ''}
REQUISITO DA STIMARE:
${sanitizedDescription}

Analizza il requisito, produci una pre-stima (minHours/maxHours/confidence), decidi ASK o SKIP, e se ASK genera max ${MAX_QUESTIONS} domande ad alto impatto informativo.${ragTopSimilarity >= RAG_AUTO_SKIP_SIMILARITY ? '\n\nNOTA: Esistono esempi storici molto simili (>85%). Considera fortemente SKIP se il requisito è sostanzialmente equivalente.' : ''}`;

        // ─── Call LLM ───────────────────────────────────────────────────────
        const provider = getDefaultProvider();
        const startTime = Date.now();

        const responseContent = await provider.generateContent({
            model: 'gpt-4o',
            temperature: 0,
            maxTokens: 4500, // More room for preEstimate + impact per question
            options: { timeout: 55000 },
            systemPrompt: systemPromptFull,
            userPrompt: userPrompt,
            responseFormat: RESPONSE_SCHEMA as any,
        });

        const llmMs = Date.now() - startTime;
        console.log(`[ai-requirement-interview] LLM responded in ${llmMs}ms`);

        if (!responseContent) {
            throw new Error('Empty response from LLM');
        }

        const result = JSON.parse(responseContent);

        // ─── Server-side decision enforcement ───────────────────────────────
        // Apply conservative stop rule server-side regardless of model output:
        //   SKIP only if confidence >= threshold AND range <= max allowed
        const range = result.preEstimate.maxHours - result.preEstimate.minHours;
        const modelDecision: string = result.decision;
        let enforcedDecision: 'ASK' | 'SKIP' = modelDecision as 'ASK' | 'SKIP';

        if (modelDecision === 'SKIP') {
            // Allow SKIP if RAG found a very close historical match, even if
            // the model's confidence/range wouldn't normally pass the threshold.
            const ragBoost = ragTopSimilarity >= RAG_AUTO_SKIP_SIMILARITY;
            if (!ragBoost && (result.preEstimate.confidence < SKIP_CONFIDENCE_THRESHOLD || range > SKIP_MAX_RANGE_HOURS)) {
                console.log(
                    '[ai-requirement-interview] Overriding SKIP→ASK (confidence=%s, range=%sh, ragBoost=%s)',
                    result.preEstimate.confidence.toFixed(2), range, ragBoost,
                );
                enforcedDecision = 'ASK';
            } else if (ragBoost) {
                console.log(
                    '[ai-requirement-interview] SKIP preserved (RAG boost: top similarity=%s%%)',
                    Math.round(ragTopSimilarity * 100),
                );
            }
        }

        // Server-side auto-SKIP: if RAG found a very close match AND the model said ASK,
        // but the pre-estimate confidence is still decent (>= 0.75), override to SKIP.
        if (enforcedDecision === 'ASK' && ragTopSimilarity >= RAG_AUTO_SKIP_SIMILARITY && result.preEstimate.confidence >= 0.75) {
            console.log(
                '[ai-requirement-interview] RAG auto-SKIP override (ASK→SKIP, similarity=%s%%, confidence=%s)',
                Math.round(ragTopSimilarity * 100), result.preEstimate.confidence.toFixed(2),
            );
            enforcedDecision = 'SKIP';
        }

        // Pipeline-config driven SKIP: if aggregate artifact confidence is high
        // enough, skip the interview even if the model said ASK.
        if (enforcedDecision === 'ASK' && pipelineConfig.skipInterview) {
            console.log(
                '[ai-requirement-interview] PipelineConfig auto-SKIP (aggregateConfidence=%s > 0.75)',
                aggregateConfidence.toFixed(2),
            );
            enforcedDecision = 'SKIP';
        }

        // If decision flipped to ASK but model produced no questions,
        // fall back to SKIP rather than leaving the user stuck.
        if (enforcedDecision === 'ASK' && (!result.questions || result.questions.length === 0)) {
            console.warn('[ai-requirement-interview] ASK but no questions — falling back to SKIP');
            enforcedDecision = 'SKIP';
        }

        // Filter questions by MIN_IMPACT_PCT (server-side guard)
        let filteredQuestions = (result.questions || []).filter(
            (q: any) => q.impact?.expectedRangeReductionPct >= MIN_IMPACT_PCT,
        );

        // Cap at MAX_QUESTIONS
        filteredQuestions = filteredQuestions.slice(0, MAX_QUESTIONS);

        // If ASK but all questions were filtered out, flip to SKIP
        if (enforcedDecision === 'ASK' && filteredQuestions.length === 0) {
            console.log('[ai-requirement-interview] All questions below impact threshold → SKIP');
            enforcedDecision = 'SKIP';
        }

        const totalMs = Date.now() - pipelineStart;

        console.log('[ai-requirement-interview] Planner result:', {
            decision: enforcedDecision,
            modelDecision,
            preEstimate: result.preEstimate,
            range,
            questionCount: filteredQuestions.length,
            categories: [...new Set(filteredQuestions.map((q: any) => q.category))],
            complexity: result.estimatedComplexity,
            totalMs,
            llmMs,
            activitiesFetchMs: fetchResult.fetchMs,
            ragExamples: ragExampleCount,
            ragTopSimilarity: Math.round(ragTopSimilarity * 100),
            ragMs,
        });

        // ─── Response ───────────────────────────────────────────────────────
        // Backward-compatible: still has questions[], reasoning, etc.
        // New fields: decision, preEstimate, per-question impact, metrics
        return {
            success: true,
            // — New information-gain fields —
            decision: enforcedDecision,
            preEstimate: result.preEstimate,
            // — Questions (empty if SKIP) —
            questions: enforcedDecision === 'SKIP' ? [] : filteredQuestions,
            // — Backward-compatible fields —
            reasoning: result.reasoning,
            estimatedComplexity: result.estimatedComplexity,
            suggestedActivities: result.suggestedActivities || [],
            // — Metrics —
            metrics: {
                totalMs,
                llmMs,
                activitiesFetchMs: fetchResult.fetchMs,
                activitiesCatalogSize: fetchResult.activities.length,
                activitiesRanked: rankedActivities.length,
                activitiesSource: fetchResult.source,
                questionCountRaw: (result.questions || []).length,
                questionCountFiltered: filteredQuestions.length,
                decisionOverridden: modelDecision !== enforcedDecision,
                ragExamples: ragExampleCount,
                ragTopSimilarity: Math.round(ragTopSimilarity * 100),
                ragMs,
                ragBoostApplied: ragTopSimilarity >= RAG_AUTO_SKIP_SIMILARITY,
            },
        };
    },
});
