/**
 * Agent Orchestrator — Phase 3: Agentic Evolution
 * 
 * Manages the agentic estimation pipeline through a state machine:
 * 
 *   INIT → DRAFT → REFLECT → (REFINE|APPROVE) → VALIDATE → COMPLETE
 * 
 * Key behaviors:
 * 1. DRAFT uses OpenAI function calling to let the model request tools
 *    (search_catalog, query_history, validate_estimation, get_activity_details)
 *    instead of pre-fetching all context upfront.
 * 
 * 2. REFLECT runs the reflection engine (lightweight consultant analysis)
 *    on the draft. If issues are found (high severity or 2+ medium), 
 *    a REFINE pass is triggered with correction instructions.
 * 
 * 3. VALIDATE ensures the final estimation passes through the deterministic
 *    EstimationEngine formula: Total Days = (Base/8) × Drivers × (1+Contingency)
 * 
 * 4. The reflection loop is capped at `maxReflectionIterations` (default: 2)
 *    to bound latency.
 * 
 * Feature flags allow disabling reflection or tool-use for A/B testing.
 */

import { randomUUID } from 'crypto';
import { ILLMProvider, LLM_PRESETS, getDefaultProvider } from '../openai-client';
import { getPrompt } from '../prompt-registry';
import { retrieveRAGContext, getRAGSystemPromptAddition } from '../rag';
import { searchSimilarActivities, isVectorSearchEnabled } from '../vector-search';
import { sanitizePromptInput } from '../../../../../src/types/ai-validation';

import type {
    AgentContext,
    AgentInput,
    AgentOutput,
    AgentState,
    AgentFlags,
    AgentMetadata,
    DraftEstimation,
    SelectedActivityResult,
    SuggestedDriver,
    StateTransition,
    ToolCallRecord,
    EngineValidationResult,
} from './agent-types';
import { DEFAULT_AGENT_FLAGS } from './agent-types';
import { AGENT_TOOL_DEFINITIONS, executeTool, ToolExecutionContext } from './agent-tools';
import { reflectOnDraft, buildRefinementPrompt } from './reflection-engine';
import { formatProjectContextBlock } from '../prompt-builder';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum tool-call iterations per DRAFT/REFINE pass (prevents infinite loops) */
const MAX_TOOL_ITERATIONS = 3;

/** Model for estimation generation (supports function calling) */
const ESTIMATION_MODEL = process.env.AI_ESTIMATION_MODEL || 'gpt-4o';

/** Timeout for the entire orchestration.
 *  Local dev uses --timeout 120 (lambda-local); production Netlify
 *  Background Functions allow up to 15 min, standard up to 26s.
 *  We budget 55s for the full pipeline, and reserve a safety margin
 *  before each heavy LLM step so we can return a partial result. */
const ORCHESTRATION_TIMEOUT_MS = 55000;

/** Minimum remaining ms before starting a REFINE pass.
 *  Tightened from 18s to 12s to reduce unnecessary skip-refine. */
const REFINE_TIME_BUDGET_MS = 12000;

/** Per-iteration time guard: if less than this remains, exit the tool loop
 *  and force a structured final answer to avoid timeout. */
const TOOL_ITERATION_BUDGET_MS = 8000;

/** Max tokens for LLM calls. 4096 is sufficient for the structured JSON output.
 *  Reasoning models (o-series, gpt-5) get higher budget for internal reasoning. */
function getMaxTokens(): number {
    const m = ESTIMATION_MODEL;
    if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
        return 8192;
    }
    return 4096;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Machine Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createContext(input: AgentInput): AgentContext {
    const flags: AgentFlags = {
        ...DEFAULT_AGENT_FLAGS,
        ...(input.flags || {}),
    };

    return {
        executionId: randomUUID(),
        state: 'INIT',
        iteration: 0,
        maxIterations: flags.maxReflectionIterations,
        transitions: [],
        toolCalls: [],
        startedAt: Date.now(),
        flags,
    };
}

function transition(ctx: AgentContext, to: AgentState, reason: string): void {
    const from = ctx.state;
    const now = Date.now();
    const durationMs = ctx.transitions.length > 0
        ? now - (ctx.transitions[ctx.transitions.length - 1] as any)?._ts || ctx.startedAt
        : now - ctx.startedAt;

    ctx.transitions.push({
        from,
        to,
        reason,
        timestamp: new Date().toISOString(),
        durationMs
    });

    // Store internal timestamp for duration calculation
    (ctx.transitions[ctx.transitions.length - 1] as any)._ts = now;

    ctx.state = to;
    console.log(`[agent] ${from} → ${to}: ${reason}`);
}

function isTimedOut(ctx: AgentContext): boolean {
    return (Date.now() - ctx.startedAt) > ORCHESTRATION_TIMEOUT_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `Sei un Tech Lead esperto con capacità agentiche. Devi generare una stima per un requisito software.

HAI A DISPOSIZIONE STRUMENTI (tools) che puoi chiamare quando necessario:
1. **search_catalog**: Cerca attività nel catalogo usando similarità semantica
2. **query_history**: Consulta stime storiche simili per calibrare la tua risposta
3. **validate_estimation**: Valida la tua stima con il motore di calcolo deterministico
4. **get_activity_details**: Ottieni dettagli completi su specifici codici attività

STRATEGIA DI LAVORO:
1. Analizza il requisito e le risposte all'interview
2. Se necessario, usa search_catalog per trovare attività specifiche
3. Se necessario, usa query_history per confrontare con stime passate simili
4. Seleziona le attività necessarie dal catalogo
5. Usa validate_estimation per verificare che i totali siano ragionevoli
6. Fornisci la stima finale con reasoning dettagliato

⚠️ REGOLE DETERMINISTICHE PER RIDURRE VARIANZA ⚠️

SELEZIONE ATTIVITÀ OBBLIGATORIE (se il requisito le richiede):
1. Se menziona "email", "notifica", "flusso automatico" → INCLUDI attività FLOW
2. Se menziona "form", "schermata", "interfaccia", "UI" → INCLUDI attività FORM
3. Se menziona "dati", "campi", "tabella", "entità" → INCLUDI attività DATA
4. Se menziona "test", "validazione", "UAT" → INCLUDI attività TEST
5. Se menziona "deploy", "rilascio", "ambiente" → INCLUDI attività DEPLOY

SCELTA VARIANTE _SM vs _LG (BASATA SULLE RISPOSTE):
- Risposta "semplice", "pochi", "1-2" → variante _SM
- Risposta "complesso", "molti", "5+" → variante _LG
- Risposta neutra → variante BASE

CONFIDENCE SCORE (DETERMINISTICO):
- 0.90: Tutte le domande hanno risposta chiara
- 0.80: 80%+ domande con risposta chiara
- 0.70: 60-80% domande con risposta
- 0.60: Meno del 60% domande con risposta

FORMATO OUTPUT (JSON):
{
  "generatedTitle": "Titolo sintetico del requisito (max 60 char, italiano)",
  "activities": [
    {
      "code": "ACTIVITY_CODE",
      "name": "Nome attività",
      "baseHours": 8,
      "reason": "Perché questa attività è necessaria",
      "fromAnswer": "Valore risposta trigger o null",
      "fromQuestionId": "question_id o null"
    }
  ],
  "totalBaseDays": 5.5,
  "reasoning": "Spiegazione complessiva della stima",
  "confidenceScore": 0.85,
  "suggestedDrivers": [
    {
      "code": "DRIVER_CODE",
      "suggestedValue": "HIGH",
      "reason": "Motivazione",
      "fromQuestionId": "question_id o null"
    }
  ],
  "suggestedRisks": ["RISK_CODE_1"]
}

⚠️ IMPORTANTE: Rispondi ESCLUSIVAMENTE con JSON valido. NON usare markdown, NON aggiungere commenti, blocchi \`\`\`json o testo prima/dopo il JSON. La risposta DEVE iniziare con { e terminare con }.`;

// ─────────────────────────────────────────────────────────────────────────────
// Build User Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(input: AgentInput, refinementPrompt?: string): string {
    // Format answers
    let answersStr = 'Nessuna risposta fornita.';
    if (input.answers && Object.keys(input.answers).length > 0) {
        answersStr = Object.entries(input.answers)
            .map(([key, val]) => {
                if (typeof val === 'object' && val !== null && 'value' in val) {
                    const answer = val as { category?: string; value: any; questionId?: string };
                    const valueStr = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value);
                    return `[${answer.category || 'general'}] ${key}: ${valueStr}`;
                }
                return `${key}: ${String(val)}`;
            })
            .join('\n');
    }

    // Format project context
    let projectCtxStr = '';
    if (input.projectContext) {
        projectCtxStr = formatProjectContextBlock(input.projectContext);
    }

    // Format activities catalog (first 40 for context window)
    const catalogStr = input.activities
        .slice(0, 40)
        .map(a => `- ${a.code}: ${a.name} (${a.base_hours}h)[${a.group} | ${a.tech_category}]`)
        .join('\n');

    let prompt = `REQUISITO:
${input.description}
${projectCtxStr}
        TECNOLOGIA: ${input.technologyName || input.techCategory}

RISPOSTE INTERVIEW TECNICA:
${answersStr}

CATALOGO ATTIVITÀ DISPONIBILI(usa SOLO questi codici):
${catalogStr}
${input.activities.length > 40 ? `\n... e altre ${input.activities.length - 40} attività (usa search_catalog per cercare quelle specifiche)` : ''}

        IMPORTANTE: Puoi usare ESCLUSIVAMENTE i codici attività elencati sopra o trovati tramite search_catalog.

Analizza le risposte e seleziona le attività necessarie.Se hai bisogno di più informazioni su specifiche attività o vuoi calibrare con stime storiche, usa gli strumenti disponibili.`;

    // Append refinement instructions if this is a REFINE pass
    if (refinementPrompt) {
        prompt += '\n' + refinementPrompt;
    }

    return prompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Response Schema (for final structured output)
// ─────────────────────────────────────────────────────────────────────────────

function buildResponseSchema(validActivityCodes: string[]) {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'estimation_from_interview_response',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    generatedTitle: { type: 'string' },
                    activities: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                code: { type: 'string', enum: validActivityCodes },
                                name: { type: 'string' },
                                baseHours: { type: 'number' },
                                reason: { type: 'string' },
                                fromAnswer: { type: ['string', 'null'] },
                                fromQuestionId: { type: ['string', 'null'] }
                            },
                            required: ['code', 'name', 'baseHours', 'reason', 'fromAnswer', 'fromQuestionId'],
                            additionalProperties: false
                        }
                    },
                    totalBaseDays: { type: 'number' },
                    reasoning: { type: 'string' },
                    confidenceScore: { type: 'number' },
                    suggestedDrivers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                code: { type: 'string' },
                                suggestedValue: { type: 'string' },
                                reason: { type: 'string' },
                                fromQuestionId: { type: ['string', 'null'] }
                            },
                            required: ['code', 'suggestedValue', 'reason', 'fromQuestionId'],
                            additionalProperties: false
                        }
                    },
                    suggestedRisks: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                },
                required: ['generatedTitle', 'activities', 'totalBaseDays', 'reasoning', 'confidenceScore', 'suggestedDrivers', 'suggestedRisks'],
                additionalProperties: false
            }
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Call with Tool Use
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single LLM call that supports tool use (function calling).
 * Handles the iterative tool-call loop where the model can request tools
 * multiple times before producing a final answer.
 */
async function llmWithTools(
    provider: ILLMProvider,
    systemPrompt: string,
    userPrompt: string,
    initialValidCodes: string[],
    toolCtx: ToolExecutionContext,
    ctx: AgentContext
): Promise<{ draft: DraftEstimation; toolCalls: ToolCallRecord[]; expandedCodes: string[] }> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 50000,
        maxRetries: 0,
    });

    // B1: mutable copy — search_catalog discoveries are merged here
    const validActivityCodes = [...initialValidCodes];

    const toolCallRecords: ToolCallRecord[] = [];

    // Build messages array
    const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Tool-call loop: model can request tools iteratively
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        console.log(`\n[agent] ── Tool Iteration ${iteration + 1}/${MAX_TOOL_ITERATIONS} ──`);
        console.log(`[agent]    Elapsed: ${Date.now() - ctx.startedAt}ms, Messages: ${messages.length}`);

        if (isTimedOut(ctx)) {
            console.warn(`[agent] TIMEOUT raggiunto durante tool loop (${Date.now() - ctx.startedAt}ms >= ${ORCHESTRATION_TIMEOUT_MS}ms), forzando risposta finale`);
            break;
        }

        // Per-iteration time guard: bail out early if insufficient time remains
        const remainingMs = ORCHESTRATION_TIMEOUT_MS - (Date.now() - ctx.startedAt);
        if (remainingMs < TOOL_ITERATION_BUDGET_MS) {
            console.warn(`[agent] Tempo insufficiente per altra iterazione (${remainingMs}ms < ${TOOL_ITERATION_BUDGET_MS}ms budget), forzando risposta finale`);
            break;
        }

        // Determine if this should be a tool-use or final-answer call
        const useTools = ctx.flags.toolUseEnabled && iteration < MAX_TOOL_ITERATIONS - 1;

        const maxTokens = getMaxTokens();

        let response: any;
        try {
            if (useTools) {
                // Call with tools available
                response = await client.chat.completions.create({
                    model: ESTIMATION_MODEL,
                    messages,
                    tools: AGENT_TOOL_DEFINITIONS as any,
                    tool_choice: iteration === 0 ? 'auto' : 'auto',
                    temperature: 0.1, // Low temp for determinism
                    max_tokens: maxTokens,
                });
            } else {
                // Final call: force structured output, no tools
                const responseSchema = buildResponseSchema(validActivityCodes);
                response = await client.chat.completions.create({
                    model: ESTIMATION_MODEL,
                    messages,
                    temperature: 0.1,
                    max_tokens: maxTokens,
                    response_format: responseSchema as any,
                });
            }
        } catch (error: any) {
            console.error(`[agent] LLM call failed (iteration ${iteration}):`, error?.message);
            throw error;
        }

        const choice = response.choices[0];

        // Check if model wants to call tools
        if (choice.finish_reason === 'tool_calls' || choice.message?.tool_calls?.length > 0) {
            const toolCalls = choice.message.tool_calls;
            console.log(`[agent] Il modello ha richiesto ${toolCalls.length} tool call(s):`);

            // Add assistant message with tool calls
            messages.push(choice.message);

            // Execute each tool call
            for (const tc of toolCalls) {
                const toolName = tc.function.name;
                let toolArgs: Record<string, any>;

                try {
                    toolArgs = JSON.parse(tc.function.arguments);
                } catch {
                    toolArgs = {};
                }

                console.log(`[agent] Esecuzione tool: ${toolName}`);
                console.log(`[agent]   Args: ${JSON.stringify(toolArgs).substring(0, 300)}`);
                const toolStartMs = Date.now();
                const { result, record } = await executeTool(toolName, toolArgs, toolCtx);
                console.log(`[agent]   Risultato: ${JSON.stringify(record.result).substring(0, 300)} (${Date.now() - toolStartMs}ms)`);
                toolCallRecords.push(record);
                ctx.toolCalls.push(record);

                // Add tool result to messages
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify(result)
                });

                // B1: merge discovered codes from search_catalog
                if (toolName === 'search_catalog' && result?.activities && Array.isArray(result.activities)) {
                    const existingCodes = new Set(validActivityCodes);
                    const newActivities = result.activities.filter(
                        (a: any) => a.code && !existingCodes.has(a.code)
                    );
                    if (newActivities.length > 0) {
                        for (const a of newActivities) {
                            validActivityCodes.push(a.code);
                        }
                        const catalogCodes = new Set(toolCtx.activitiesCatalog.map(x => x.code));
                        for (const a of newActivities) {
                            if (!catalogCodes.has(a.code)) {
                                toolCtx.activitiesCatalog.push({
                                    code: a.code,
                                    name: a.name,
                                    description: a.description || '',
                                    base_hours: a.baseHours,
                                    group: a.group || 'UNKNOWN',
                                    tech_category: a.techCategory,
                                });
                            }
                        }
                        console.log(`[agent] search_catalog expansion: +${newActivities.length} codes → validActivityCodes now ${validActivityCodes.length}`);
                    }
                }
            }

            // Continue loop — model will process tool results
            console.log('[agent] Tool results aggiunti al contesto, continuo il loop...');
            continue;
        }

        // Model produced a final answer (no tool calls)
        console.log(`[agent] Il modello ha prodotto la risposta finale (finish_reason: ${choice.finish_reason})`);
        const content = choice.message?.content;
        if (!content) {
            throw new Error('Empty response from model');
        }
        console.log(`[agent] Risposta: ${content.length} chars`);
        console.log(`[agent] Anteprima risposta: "${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"`);

        // Try to parse as JSON. If model returned non-JSON (e.g. Markdown),
        // do a recovery call with forced response_format.
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (parseErr) {
            console.warn(`[agent] RECOVERY: la risposta NON è JSON valido, eseguo chiamata di conversione strutturata...`);
            console.warn(`[agent] Parse error: ${parseErr instanceof Error ? parseErr.message : parseErr}`);

            // Add the model's free-text response to messages and re-call with structured output
            messages.push({ role: 'assistant', content });
            messages.push({
                role: 'user',
                content: 'La tua risposta precedente non era in formato JSON valido. Rispondi ESCLUSIVAMENTE con il JSON strutturato richiesto, senza markdown, senza spiegazioni testuali. Solo il JSON.'
            });

            const recoverySchema = buildResponseSchema(validActivityCodes);
            const recoveryResponse = await client.chat.completions.create({
                model: ESTIMATION_MODEL,
                messages,
                temperature: 0.0,
                max_tokens: getMaxTokens(),
                response_format: recoverySchema as any,
            });

            const recoveryContent = recoveryResponse.choices[0]?.message?.content;
            if (!recoveryContent) {
                throw new Error('Empty recovery response from model');
            }
            console.log(`[agent] Recovery response: ${recoveryContent.length} chars`);
            console.log(`[agent] Recovery anteprima: "${recoveryContent.substring(0, 200)}..."`);
            parsed = JSON.parse(recoveryContent);
            console.log('[agent] Recovery JSON parse OK');
        }

        const draft: DraftEstimation = {
            generatedTitle: parsed.generatedTitle || '',
            activities: (parsed.activities || []).map((a: any) => ({
                code: a.code,
                name: a.name,
                baseHours: a.baseHours,
                reason: a.reason,
                fromAnswer: a.fromAnswer || null,
                fromQuestionId: a.fromQuestionId || null,
            })),
            totalBaseDays: parsed.totalBaseDays || 0,
            reasoning: parsed.reasoning || '',
            confidenceScore: parsed.confidenceScore || 0.7,
            suggestedDrivers: (parsed.suggestedDrivers || []).map((d: any) => ({
                code: d.code,
                suggestedValue: d.suggestedValue,
                reason: d.reason,
                fromQuestionId: d.fromQuestionId || null,
            })),
            suggestedRisks: parsed.suggestedRisks || [],
        };

        return { draft, toolCalls: toolCallRecords, expandedCodes: validActivityCodes };
    }

    // If we exhausted tool iterations, do a final call without tools
    console.warn(`[agent] Tool iterations esaurite (${MAX_TOOL_ITERATIONS}), forzando risposta strutturata finale...`);
    console.log(`[agent] Messages context: ${messages.length} messaggi`);
    const responseSchema = buildResponseSchema(validActivityCodes);
    const finalResponse = await client.chat.completions.create({
        model: ESTIMATION_MODEL,
        messages,
        temperature: 0.1,
        max_tokens: getMaxTokens(),
        response_format: responseSchema as any,
    });

    const content = finalResponse.choices[0]?.message?.content;
    if (!content) {
        throw new Error('Empty final response from model');
    }

    const parsed = JSON.parse(content);
    const draft: DraftEstimation = {
        generatedTitle: parsed.generatedTitle || '',
        activities: (parsed.activities || []),
        totalBaseDays: parsed.totalBaseDays || 0,
        reasoning: parsed.reasoning || '',
        confidenceScore: parsed.confidenceScore || 0.7,
        suggestedDrivers: parsed.suggestedDrivers || [],
        suggestedRisks: parsed.suggestedRisks || [],
    };

    return { draft, toolCalls: toolCallRecords, expandedCodes: validActivityCodes };
}

/**
 * Fallback: direct LLM call without tool use (uses ILLMProvider abstraction)
 */
async function llmDirect(
    provider: ILLMProvider,
    systemPrompt: string,
    userPrompt: string,
    validActivityCodes: string[]
): Promise<DraftEstimation> {
    const responseSchema = buildResponseSchema(validActivityCodes);

    const content = await provider.generateContent({
        model: ESTIMATION_MODEL,
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: getMaxTokens(),
        options: { timeout: 55000 },
        responseFormat: responseSchema as any,
    });

    if (!content) {
        throw new Error('Empty response from LLM provider');
    }

    const parsed = JSON.parse(content);
    return {
        generatedTitle: parsed.generatedTitle || '',
        activities: (parsed.activities || []).map((a: any) => ({
            code: a.code,
            name: a.name,
            baseHours: a.baseHours,
            reason: a.reason,
            fromAnswer: a.fromAnswer || null,
            fromQuestionId: a.fromQuestionId || null,
        })),
        totalBaseDays: parsed.totalBaseDays || 0,
        reasoning: parsed.reasoning || '',
        confidenceScore: parsed.confidenceScore || 0.7,
        suggestedDrivers: (parsed.suggestedDrivers || []).map((d: any) => ({
            code: d.code,
            suggestedValue: d.suggestedValue,
            reason: d.reason,
            fromQuestionId: d.fromQuestionId || null,
        })),
        suggestedRisks: parsed.suggestedRisks || [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Validation (preserving EstimationEngine invariant)
// ─────────────────────────────────────────────────────────────────────────────

function validateWithEngine(
    draft: DraftEstimation,
    input: AgentInput
): EngineValidationResult {
    console.log('[agent] Avvio validazione deterministica EstimationEngine...');
    // Replicate EstimationEngine.calculateEstimation() deterministically
    // This ensures the invariant: Total Days = (Base/8) * Drivers * (1+Contingency)
    const totalHours = draft.activities.reduce((sum, a) => sum + a.baseHours, 0);
    const baseDays = totalHours / 8.0;

    // Default driver multiplier (will be refined by frontend with actual driver selections)
    const driverMultiplier = 1.0;
    const subtotal = baseDays * driverMultiplier;

    // Default risk score (from suggested risks count as heuristic)
    const riskScore = draft.suggestedRisks.length * 5;

    let contingencyPercent: number;
    if (riskScore <= 0) contingencyPercent = 0.10;
    else if (riskScore <= 10) contingencyPercent = 0.10;
    else if (riskScore <= 20) contingencyPercent = 0.15;
    else if (riskScore <= 30) contingencyPercent = 0.20;
    else contingencyPercent = 0.25;

    const contingencyDays = subtotal * contingencyPercent;
    const totalDays = subtotal + contingencyDays;

    // Verify AI-reported totalBaseDays matches our calculation
    const calculatedBaseDays = Number(baseDays.toFixed(2));
    if (Math.abs(calculatedBaseDays - draft.totalBaseDays) > 0.5) {
        console.warn(`[agent] MISMATCH BaseDays! AI ha riportato ${draft.totalBaseDays}, engine ha calcolato ${calculatedBaseDays}`);
        console.warn(`[agent] Correzione automatica: ${draft.totalBaseDays} → ${calculatedBaseDays}`);
        // Correct the draft
        draft.totalBaseDays = calculatedBaseDays;
    } else {
        console.log(`[agent] BaseDays check OK (AI: ${draft.totalBaseDays}, Engine: ${calculatedBaseDays}, delta: ${Math.abs(calculatedBaseDays - draft.totalBaseDays).toFixed(2)})`);
    }

    return {
        baseDays: Number(baseDays.toFixed(2)),
        driverMultiplier: Number(driverMultiplier.toFixed(3)),
        subtotal: Number(subtotal.toFixed(2)),
        riskScore,
        contingencyPercent: Number((contingencyPercent * 100).toFixed(2)),
        contingencyDays: Number(contingencyDays.toFixed(2)),
        totalDays: Number(totalDays.toFixed(2)),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Orchestration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the agentic estimation pipeline.
 * 
 * This is the main entry point for Phase 3.
 * It replaces the linear flow with a state machine that supports
 * tool use and self-reflection.
 */
export async function runAgentPipeline(input: AgentInput): Promise<AgentOutput> {
    const ctx = createContext(input);
    const provider = getDefaultProvider();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           AGENTIC ESTIMATION PIPELINE — Phase 3             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`[agent] Execution ID: ${ctx.executionId}`);
    console.log(`[agent] Input summary:`);
    console.log(`  - Descrizione (${input.description.length} chars): "${input.description.substring(0, 120)}${input.description.length > 120 ? '...' : ''}"`);
    console.log(`  - Tecnologia: ${input.technologyName || input.techCategory}`);
    console.log(`  - Risposte interview: ${input.answers ? Object.keys(input.answers).length : 0}`);
    console.log(`  - Catalogo attività: ${input.activities.length} attività disponibili`);
    console.log(`  - Codici validi: ${input.validActivityCodes.length}`);
    console.log(`  - Contesto progetto: ${input.projectContext ? input.projectContext.name : 'N/A'}`);
    console.log(`[agent] Flags:`);
    console.log(`  - reflectionEnabled: ${ctx.flags.reflectionEnabled}`);
    console.log(`  - toolUseEnabled: ${ctx.flags.toolUseEnabled}`);
    console.log(`  - maxReflectionIterations: ${ctx.flags.maxReflectionIterations}`);
    console.log(`  - reflectionConfidenceThreshold: ${ctx.flags.reflectionConfidenceThreshold}`);
    console.log(`  - autoApproveOnly: ${ctx.flags.autoApproveOnly}`);
    console.log(`[agent] Model: ${ESTIMATION_MODEL}`);
    console.log(`[agent] Timeout: ${ORCHESTRATION_TIMEOUT_MS}ms`);
    console.log('─'.repeat(62));

    let draft: DraftEstimation | null = null;
    let reflectionResult: any = undefined;
    let engineValidation: EngineValidationResult | undefined;

    try {
        // ── INIT ─────────────────────────────────────────────────────────
        transition(ctx, 'INIT', 'Pipeline started');

        // Pre-fetch RAG context (parallel with tool-use, model can also request it)
        let ragPromptFragment = '';
        let ragSystemAddition = '';
        const vectorEnabled = isVectorSearchEnabled();
        console.log(`[agent] Vector search enabled: ${vectorEnabled}, userId: ${input.userId || 'N/A'}`);
        if (vectorEnabled && input.userId) {
            console.log('[agent] Pre-fetching RAG context...');
            try {
                const ragCtx = await retrieveRAGContext(input.description, input.userId);
                if (ragCtx.hasExamples) {
                    ragPromptFragment = ragCtx.promptFragment;
                    ragSystemAddition = getRAGSystemPromptAddition();
                    console.log(`[agent] RAG pre-fetch OK: ${ragCtx.examples.length} esempi storici trovati (${ragCtx.searchLatencyMs}ms)`);
                    ragCtx.examples.forEach((ex, i) => {
                        console.log(`  [${i + 1}] "${ex.requirementTitle}" — similarity: ${Math.round(ex.similarity * 100)}%, ${ex.totalDays} days`);
                    });
                } else {
                    console.log('[agent] RAG pre-fetch: nessun esempio storico trovato');
                }
            } catch (ragErr) {
                console.warn('[agent] RAG pre-fetch FALLITO (il modello potrà usare query_history tool):', ragErr instanceof Error ? ragErr.message : ragErr);
            }
        } else {
            console.log('[agent] RAG pre-fetch skippato (vector search disabilitato o userId mancante)');
        }

        // Build prompts
        let systemPrompt = (await getPrompt('agent_estimation')) || AGENT_SYSTEM_PROMPT;
        if (ragSystemAddition) {
            systemPrompt += '\n' + ragSystemAddition;
        }

        let userPrompt = buildUserPrompt(input);
        if (ragPromptFragment) {
            userPrompt += '\n' + ragPromptFragment;
        }

        const toolCtx: ToolExecutionContext = {
            activitiesCatalog: input.activities,
            userId: input.userId,
        };

        // ── DRAFT ────────────────────────────────────────────────────────
        transition(ctx, 'DRAFT', 'Generating initial estimation');
        console.log(`[agent] System prompt: ${systemPrompt.length} chars`);
        console.log(`[agent] User prompt: ${userPrompt.length} chars`);
        console.log(`[agent] Modalità: ${ctx.flags.toolUseEnabled ? 'TOOL USE (function calling)' : 'DIRECT (senza tools)'}`);
        const draftStartMs = Date.now();

        // B1: expandedCodes captures any codes discovered by search_catalog during tool-use
        let expandedCodes = input.validActivityCodes;

        if (ctx.flags.toolUseEnabled) {
            const result = await llmWithTools(
                provider,
                systemPrompt,
                userPrompt,
                input.validActivityCodes,
                toolCtx,
                ctx
            );
            draft = result.draft;
            expandedCodes = result.expandedCodes;
        } else {
            draft = await llmDirect(provider, systemPrompt, userPrompt, input.validActivityCodes);
        }

        const draftElapsedMs = Date.now() - draftStartMs;
        console.log(`[agent] Draft generata in ${draftElapsedMs}ms`);

        // Validate activities are from catalog (B1: uses expanded set, not initial input)
        const validCodes = new Set(expandedCodes);
        const beforeFilterCount = draft.activities.length;
        draft.activities = draft.activities.filter(a => validCodes.has(a.code));
        const removedCount = beforeFilterCount - draft.activities.length;
        if (removedCount > 0) {
            console.warn(`[agent] ATTENZIONE: ${removedCount} attività rimosse perché non presenti nel catalogo!`);
        }

        // Recalculate totalBaseDays
        draft.totalBaseDays = Number(
            (draft.activities.reduce((sum, a) => sum + a.baseHours, 0) / 8).toFixed(2)
        );

        console.log('─'.repeat(62));
        console.log(`[agent] DRAFT RISULTATO:`);
        console.log(`  Titolo: "${draft.generatedTitle}"`);
        console.log(`  Attività (${draft.activities.length}):`);
        draft.activities.forEach((a, i) => {
            console.log(`    ${i + 1}. ${a.code} — ${a.name} (${a.baseHours}h) → ${a.reason.substring(0, 80)}`);
        });
        console.log(`  Total base days: ${draft.totalBaseDays}`);
        console.log(`  Confidence: ${draft.confidenceScore}`);
        console.log(`  Drivers suggeriti: ${draft.suggestedDrivers.length}`);
        draft.suggestedDrivers.forEach(d => console.log(`    - ${d.code}: ${d.suggestedValue} (${d.reason.substring(0, 60)})`));
        console.log(`  Rischi suggeriti: ${draft.suggestedRisks.join(', ') || 'nessuno'}`);
        console.log(`  Reasoning: "${draft.reasoning.substring(0, 200)}${draft.reasoning.length > 200 ? '...' : ''}"`);
        console.log('─'.repeat(62));

        // ── REFLECT ──────────────────────────────────────────────────────
        // Fast-path gating: skip reflection if draft is already high quality
        const allActivitiesValid = removedCount === 0;
        const fewToolCalls = ctx.toolCalls.length <= 1;
        const highConfidence = draft.confidenceScore >= 0.85;
        const skipReflection = allActivitiesValid && fewToolCalls && highConfidence;

        if (skipReflection) {
            console.log(`[agent] Reflection FAST-PATH: skip (validActivities=${allActivitiesValid}, toolCalls=${ctx.toolCalls.length}, confidence=${draft.confidenceScore})`);
        } else if (ctx.flags.reflectionEnabled && !isTimedOut(ctx)) {
            transition(ctx, 'REFLECT', 'Running reflection analysis');
            console.log(`[agent] Tempo trascorso: ${Date.now() - ctx.startedAt}ms / ${ORCHESTRATION_TIMEOUT_MS}ms`);
            const reflectStartMs = Date.now();

            reflectionResult = await reflectOnDraft(input, draft, provider, ctx.flags);
            console.log(`[agent] Reflection completata in ${Date.now() - reflectStartMs}ms`);
            ctx.iteration++;

            // ── REFINE (if needed) ───────────────────────────────────────
            // Tightened gating: only refine on HIGH severity issues (not medium)
            // to avoid unnecessary extra LLM calls that add 10-25s latency.
            const remainingMs = ORCHESTRATION_TIMEOUT_MS - (Date.now() - ctx.startedAt);
            const hasBudgetForRefine = remainingMs >= REFINE_TIME_BUDGET_MS;
            const hasHighSeverity = reflectionResult.issues?.some((i: any) => i.severity === 'high');
            const shouldRefine = reflectionResult.refinementTriggered && hasHighSeverity;

            if (!hasBudgetForRefine && shouldRefine) {
                console.warn(`[agent] Refinement richiesto ma tempo insufficiente (${remainingMs}ms < ${REFINE_TIME_BUDGET_MS}ms budget). Skip REFINE → VALIDATE per evitare timeout.`);
            }
            if (!shouldRefine && reflectionResult.refinementTriggered) {
                console.log(`[agent] Refinement suggerito ma SKIP: nessun issue high severity (solo medium/low)`);
            }
            if (shouldRefine && ctx.iteration < ctx.maxIterations && !isTimedOut(ctx) && hasBudgetForRefine) {
                console.log('─'.repeat(62));
                console.log(`[agent] REFINEMENT NECESSARIO — Il Senior Consultant ha trovato problemi`);
                console.log(`  Assessment: ${reflectionResult.assessment}`);
                console.log(`  Issues: ${reflectionResult.issues.length}`);
                reflectionResult.issues.forEach((iss: any, i: number) => {
                    console.log(`    ${i + 1}. [${iss.severity.toUpperCase()}] ${iss.type}: ${iss.description}`);
                    console.log(`       Azione suggerita: ${iss.suggestedAction}`);
                });
                console.log(`  Istruzioni correzione: "${reflectionResult.correctionPrompt.substring(0, 200)}..."`);
                console.log('─'.repeat(62));
                transition(ctx, 'REFINE', `Reflection triggered refinement (assessment: ${reflectionResult.assessment})`);

                const refinementPrompt = buildRefinementPrompt(reflectionResult, draft);
                const refinedUserPrompt = buildUserPrompt(input, refinementPrompt);

                if (ctx.flags.toolUseEnabled) {
                    const result = await llmWithTools(
                        provider,
                        systemPrompt,
                        refinedUserPrompt,
                        expandedCodes,
                        toolCtx,
                        ctx
                    );
                    draft = result.draft;
                    expandedCodes = result.expandedCodes;
                } else {
                    draft = await llmDirect(provider, systemPrompt, refinedUserPrompt, expandedCodes);
                }

                // Re-validate activities (B1: uses expanded set from refine pass)
                const refineValidCodes = new Set(expandedCodes);
                const beforeRefineCount = draft.activities.length;
                draft.activities = draft.activities.filter(a => refineValidCodes.has(a.code));
                if (beforeRefineCount !== draft.activities.length) {
                    console.warn(`[agent] Post-refine: ${beforeRefineCount - draft.activities.length} attività rimosse (non nel catalogo)`);
                }
                draft.totalBaseDays = Number(
                    (draft.activities.reduce((sum, a) => sum + a.baseHours, 0) / 8).toFixed(2)
                );

                console.log('─'.repeat(62));
                console.log(`[agent] DRAFT RAFFINATA:`);
                console.log(`  Titolo: "${draft.generatedTitle}"`);
                console.log(`  Attività (${draft.activities.length}):`);
                draft.activities.forEach((a, i) => {
                    console.log(`    ${i + 1}. ${a.code} — ${a.name} (${a.baseHours}h)`);
                });
                console.log(`  Total base days: ${draft.totalBaseDays}`);
                console.log(`  Confidence: ${draft.confidenceScore}`);
                console.log('─'.repeat(62));
                ctx.iteration++;
            } else if (!reflectionResult.refinementTriggered) {
                console.log('[agent] Reflection ha APPROVATO la draft — nessuna correzione necessaria');
            }
        } else {
            if (!ctx.flags.reflectionEnabled) {
                console.log('[agent] Reflection DISABILITATA (flag reflectionEnabled=false)');
            } else {
                console.log(`[agent] Reflection SALTATA per timeout (${Date.now() - ctx.startedAt}ms >= ${ORCHESTRATION_TIMEOUT_MS}ms)`);
            }
        }

        // ── VALIDATE ─────────────────────────────────────────────────────
        transition(ctx, 'VALIDATE', 'Running deterministic engine validation');

        engineValidation = validateWithEngine(draft, input);

        console.log('─'.repeat(62));
        console.log(`[agent] ENGINE VALIDATION (formula deterministica):`);
        console.log(`  Total hours: ${draft.activities.reduce((s, a) => s + a.baseHours, 0)}h`);
        console.log(`  Base days (hours/8): ${engineValidation.baseDays}`);
        console.log(`  Driver multiplier: ${engineValidation.driverMultiplier}`);
        console.log(`  Subtotal: ${engineValidation.subtotal} days`);
        console.log(`  Risk score: ${engineValidation.riskScore}`);
        console.log(`  Contingency: ${engineValidation.contingencyPercent}% (${engineValidation.contingencyDays} days)`);
        console.log(`  TOTAL DAYS: ${engineValidation.totalDays}`);
        console.log('─'.repeat(62));

        // ── COMPLETE ─────────────────────────────────────────────────────
        transition(ctx, 'COMPLETE', 'Pipeline completed successfully');

        const totalDurationMs = Date.now() - ctx.startedAt;

        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║                     PIPELINE COMPLETATA                     ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`[agent] Durata totale: ${totalDurationMs}ms (${(totalDurationMs / 1000).toFixed(1)}s)`);
        console.log(`[agent] Iterazioni: ${ctx.iteration}`);
        console.log(`[agent] Tool calls totali: ${ctx.toolCalls.length}`);
        if (ctx.toolCalls.length > 0) {
            const toolSummary = ctx.toolCalls.reduce((acc, tc) => {
                acc[tc.toolName] = (acc[tc.toolName] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log(`[agent] Tool summary: ${JSON.stringify(toolSummary)}`);
        }
        console.log(`[agent] Transizioni: ${ctx.transitions.map(t => t.to).join(' → ')}`);
        console.log(`[agent] Risultato finale: ${draft.activities.length} attività, ${draft.totalBaseDays} base days, confidence=${draft.confidenceScore}`);
        if (reflectionResult) {
            console.log(`[agent] Reflection: assessment=${reflectionResult.assessment}, issues=${reflectionResult.issues?.length || 0}, refined=${reflectionResult.refinementTriggered}`);
        }
        console.log('═'.repeat(62));

        const metadata: AgentMetadata = {
            executionId: ctx.executionId,
            totalDurationMs,
            iterations: ctx.iteration,
            toolCallCount: ctx.toolCalls.length,
            toolCalls: ctx.toolCalls,
            transitions: ctx.transitions.map(t => ({
                from: t.from,
                to: t.to,
                reason: t.reason,
                timestamp: t.timestamp,
                durationMs: t.durationMs,
            })),
            reflectionResult: reflectionResult || undefined,
            model: ESTIMATION_MODEL,
            flags: ctx.flags,
        };

        // B1: compute which codes were dynamically discovered during tool-use
        const initialCodeSet = new Set(input.validActivityCodes);
        const discoveredCodes = expandedCodes.filter(c => !initialCodeSet.has(c));
        if (discoveredCodes.length > 0) {
            console.log(`[agent] B1 expansion summary: ${discoveredCodes.length} new codes discovered via search_catalog: ${discoveredCodes.join(', ')}`);
        }

        return {
            success: true,
            generatedTitle: draft.generatedTitle,
            activities: draft.activities,
            totalBaseDays: draft.totalBaseDays,
            reasoning: draft.reasoning,
            confidenceScore: draft.confidenceScore,
            suggestedDrivers: draft.suggestedDrivers,
            suggestedRisks: draft.suggestedRisks,
            engineValidation,
            agentMetadata: metadata,
            expandedActivityCodes: discoveredCodes.length > 0 ? discoveredCodes : undefined,
        };

    } catch (error) {
        transition(ctx, 'FAILED', `Error: ${error instanceof Error ? error.message : String(error)}`);

        const totalDurationMs = Date.now() - ctx.startedAt;
        console.error('\n╔══════════════════════════════════════════════════════════════╗');
        console.error('║                     PIPELINE FALLITA                        ║');
        console.error('╚══════════════════════════════════════════════════════════════╝');
        console.error(`[agent] Errore: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`[agent] Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
        console.error(`[agent] Durata prima del fallimento: ${totalDurationMs}ms`);
        console.error(`[agent] Stato al momento del crash: ${ctx.state}`);
        console.error(`[agent] Iterazioni completate: ${ctx.iteration}`);
        console.error(`[agent] Tool calls completate: ${ctx.toolCalls.length}`);
        console.error(`[agent] Transizioni: ${ctx.transitions.map(t => `${t.from}→${t.to}`).join(' | ')}`);
        if (draft) {
            console.error(`[agent] Draft parziale: ${draft.activities.length} attività, ${draft.totalBaseDays} base days`);
        }
        console.error('═'.repeat(62));

        return {
            success: false,
            generatedTitle: draft?.generatedTitle || '',
            activities: draft?.activities || [],
            totalBaseDays: draft?.totalBaseDays || 0,
            reasoning: draft?.reasoning || '',
            confidenceScore: 0,
            suggestedDrivers: [],
            suggestedRisks: [],
            error: error instanceof Error ? error.message : String(error),
            agentMetadata: {
                executionId: ctx.executionId,
                totalDurationMs,
                iterations: ctx.iteration,
                toolCallCount: ctx.toolCalls.length,
                toolCalls: ctx.toolCalls,
                transitions: ctx.transitions,
                reflectionResult,
                model: ESTIMATION_MODEL,
                flags: ctx.flags,
            },
        };
    }
}
