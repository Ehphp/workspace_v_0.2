/**
 * Netlify Function: AI Estimate from Interview
 * 
 * Generates an estimation based on:
 * - Original requirement description
 * - Technical interview answers
 * - Technology preset and available activities
 * 
 * Returns selected activities with reasoning, linking each to specific answers.
 * 
 * POST /.netlify/functions/ai-estimate-from-interview
 */

import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';
import { searchSimilarActivities, isVectorSearchEnabled } from './lib/ai/vector-search';
import { retrieveRAGContext, getRAGSystemPromptAddition } from './lib/ai/rag';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InterviewAnswer {
    questionId: string;
    category: string;
    value: string | string[] | number;
    timestamp: string;
}

interface Activity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
}

interface RequestBody {
    description: string;
    techPresetId: string;
    techCategory: string;
    answers: Record<string, InterviewAnswer>;
    activities: Activity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un Tech Lead esperto che deve selezionare le attività per implementare un requisito software.

HAI A DISPOSIZIONE:
1. Descrizione del requisito originale
2. Risposte a domande tecniche specifiche fornite dallo sviluppatore
3. Catalogo delle attività disponibili per lo stack tecnologico

IL TUO COMPITO:
1. Analizza le risposte per capire la complessità REALE del requisito
2. Seleziona SOLO le attività necessarie dal catalogo fornito
3. Per ogni attività selezionata, spiega PERCHÉ è necessaria
4. Collega ogni attività alla risposta che l'ha triggerata (quando applicabile)
5. Calcola un confidence score basato sulla completezza delle risposte

⚠️ REGOLE DETERMINISTICHE PER RIDURRE VARIANZA ⚠️

SELEZIONE ATTIVITÀ OBBLIGATORIE (se il requisito le richiede):
1. Se menziona "email", "notifica", "invio", "flusso automatico" → INCLUDI attività FLOW (PP_FLOW_* o equivalente)
2. Se menziona "form", "schermata", "interfaccia", "UI" → INCLUDI attività FORM (PP_DV_FORM_* o equivalente)
3. Se menziona "dati", "campi", "tabella", "entità" → INCLUDI attività FIELD/DATA (PP_DV_FIELD_* o equivalente)
4. Se menziona "test", "validazione", "UAT" → INCLUDI attività TEST (PP_E2E_TEST_* o equivalente)
5. Se menziona "deploy", "rilascio", "ambiente" → INCLUDI attività DEPLOY (PP_DEPLOY_* o equivalente)

SCELTA VARIANTE _SM vs _LG (BASATA SULLE RISPOSTE, NON SUL TUO GIUDIZIO):
- Se la risposta indica "semplice", "pochi", "1-2", "base", "minimo" → USA variante _SM
- Se la risposta indica "complesso", "molti", "5+", "avanzato", "multipli" → USA variante _LG  
- Se la risposta è neutra o assente → USA la variante BASE (senza suffisso)

REGOLE DI COERENZA:
- Per lo STESSO tipo di requisito con le STESSE risposte, seleziona SEMPRE le stesse attività
- NON aggiungere attività "per sicurezza" - includi SOLO quelle giustificate dalle risposte
- Se non sei sicuro, usa la variante BASE (senza _SM/_LG)

CONFIDENCE SCORE (DETERMINISTICO):
- 0.90: Tutte le domande hanno risposta chiara e coerente
- 0.80: 80%+ domande con risposta chiara
- 0.70: 60-80% domande con risposta chiara
- 0.60: Meno del 60% domande con risposta chiara

FORMATO OUTPUT (JSON):
{
  "generatedTitle": "Titolo sintetico del requisito (max 60 caratteri, in italiano)",
  "activities": [
    {
      "code": "ACTIVITY_CODE",
      "name": "Nome attività",
      "baseHours": 8,
      "reason": "Perché questa attività è necessaria",
      "fromAnswer": "Valore della risposta che ha triggerato questa selezione",
      "fromQuestionId": "q1_integration"
    }
  ],
  "totalBaseDays": 5.5,
  "reasoning": "Spiegazione complessiva della stima e delle scelte fatte",
  "confidenceScore": 0.85,
  "suggestedDrivers": [
    {
      "code": "DRIVER_CODE",
      "suggestedValue": "HIGH",
      "reason": "Perché suggerisci questo valore",
      "fromQuestionId": "q2_complexity"
    }
  ],
  "suggestedRisks": ["RISK_CODE_1", "RISK_CODE_2"]
}

GENERATED TITLE:
- Deve essere un titolo breve e descrittivo del requisito
- Max 60 caratteri
- In italiano
- Deve catturare l'essenza funzionale del requisito
- Esempio: "Report utilizzo ESM per HR" o "Integrazione API candidature Talentum"`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build JSON Schema for structured output with dynamic activity codes
 * 
 * NOTE: We build the schema dynamically to include the enum of valid activity codes.
 * This prevents the AI from inventing codes that don't exist in the catalog.
 */
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
                                // CRITICAL: Enum constraint to prevent AI from inventing codes
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

/**
 * Format activities catalog for prompt
 */
function formatActivitiesCatalog(activities: Activity[]): string {
    return activities
        .map(a => `- ${a.code}: ${a.name} (${a.base_hours}h) - ${a.description}`)
        .join('\n');
}

/**
 * Format interview answers for prompt
 */
function formatInterviewAnswers(answers: Record<string, InterviewAnswer>): string {
    const entries = Object.entries(answers);
    if (entries.length === 0) {
        return 'Nessuna risposta fornita.';
    }

    return entries
        .map(([_, answer]) => {
            const valueStr = Array.isArray(answer.value)
                ? answer.value.join(', ')
                : String(answer.value);
            return `[${answer.category}] ${answer.questionId}: ${valueStr}`;
        })
        .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export const handler = createAIHandler<RequestBody>({
    name: 'ai-estimate-from-interview',
    requireAuth: false, // Allow unauthenticated for Quick Estimate demo
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'La descrizione del requisito è obbligatoria.';
        }
        if (!body.answers || typeof body.answers !== 'object') {
            return 'Le risposte all\'interview sono obbligatorie.';
        }
        if (!body.activities || !Array.isArray(body.activities) || body.activities.length === 0) {
            return 'Il catalogo delle attività è obbligatorio.';
        }
        return null;
    },

    handler: async (body, ctx) => {
        // Get OpenAI client with extended timeout (55s)
        const openai = getOpenAIClient({ timeout: 55000, maxRetries: 1 });

        // Sanitize description
        const sanitizedDescription = ctx.sanitize(body.description);

        // Use vector search for more relevant activities (Phase 2)
        let activitiesToUse: Activity[] = body.activities;
        let searchMethod = 'frontend-provided';

        if (isVectorSearchEnabled() && body.techCategory) {
            try {
                console.log('[ai-estimate-from-interview] Using vector search for activity retrieval');
                const techCategories = [body.techCategory, 'MULTI'];
                const searchResult = await searchSimilarActivities(
                    sanitizedDescription,
                    techCategories,
                    35, // Top-35 most relevant activities
                    0.45
                );

                if (searchResult.results.length > 0) {
                    activitiesToUse = searchResult.results.map(r => ({
                        code: r.code,
                        name: r.name,
                        description: r.description || '',
                        base_hours: r.base_hours,
                        group: r.group,
                        tech_category: r.tech_category,
                    }));
                    searchMethod = searchResult.metrics.usedFallback ? 'vector-fallback' : 'vector';
                    console.log(`[ai-estimate-from-interview] Vector search returned ${activitiesToUse.length} activities in ${searchResult.metrics.latencyMs}ms`);
                }
            } catch (err) {
                console.warn('[ai-estimate-from-interview] Vector search failed, using provided activities:', err);
            }
        }

        // Retrieve RAG context (Phase 4: Historical Learning)
        let ragContext = { hasExamples: false, promptFragment: '', searchLatencyMs: 0 } as any;
        if (isVectorSearchEnabled()) {
            try {
                ragContext = await retrieveRAGContext(sanitizedDescription);
                if (ragContext.hasExamples) {
                    console.log(`[ai-estimate-from-interview] RAG: found ${ragContext.examples?.length || 0} historical examples`);
                }
            } catch (err) {
                console.warn('[ai-estimate-from-interview] RAG retrieval failed:', err);
            }
        }

        // Format data for prompt
        const activitiesCatalog = formatActivitiesCatalog(activitiesToUse);
        const interviewAnswers = formatInterviewAnswers(body.answers);
        const validActivityCodes = activitiesToUse.map(a => a.code);

        console.log('[ai-estimate-from-interview] Processing:', {
            descriptionLength: sanitizedDescription.length,
            answersCount: Object.keys(body.answers).length,
            activitiesCount: activitiesToUse.length,
            techCategory: body.techCategory,
            searchMethod,
            ragExamples: ragContext.examples?.length || 0,
            validCodes: validActivityCodes.slice(0, 5).join(', ') + (validActivityCodes.length > 5 ? '...' : ''),
        });

        // Build response schema with valid activity codes enum
        // This is CRITICAL to prevent AI from inventing codes
        const responseSchema = buildResponseSchema(validActivityCodes);

        // Build user prompt with optional RAG context
        let userPrompt = `REQUISITO:
${sanitizedDescription}

RISPOSTE INTERVIEW TECNICA:
${interviewAnswers}

CATALOGO ATTIVITÀ DISPONIBILI (usa SOLO questi codici):
${activitiesCatalog}

IMPORTANTE: Puoi usare ESCLUSIVAMENTE i codici attività elencati sopra. Non inventare nuovi codici.

Analizza le risposte e seleziona le attività necessarie per implementare questo requisito.
Collega ogni attività alla risposta che l'ha motivata.`;

        // Add RAG examples if available
        if (ragContext.hasExamples && ragContext.promptFragment) {
            userPrompt = userPrompt + '\n' + ragContext.promptFragment;
        }

        // Build system prompt with optional RAG enhancement
        let systemPrompt = SYSTEM_PROMPT;
        if (ragContext.hasExamples) {
            systemPrompt = systemPrompt + '\n' + getRAGSystemPromptAddition();
        }

        // Call OpenAI with dynamic schema containing enum constraint
        // Using temperature=0 and seed for deterministic responses
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0, // Zero temperature for maximum determinism
            seed: 42, // Fixed seed for reproducible results
            max_tokens: 2500,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            response_format: responseSchema,
        });

        // Parse response
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const result = JSON.parse(content);

        // Validate activities are from catalog
        const validatedActivities = result.activities.filter((a: any) =>
            validActivityCodes.includes(a.code)
        );

        // Recalculate total if activities were filtered
        const totalBaseDays = validatedActivities.reduce(
            (sum: number, a: any) => sum + (a.baseHours / 8),
            0
        );

        // Adjust confidence if activities were filtered out
        let confidenceScore = result.confidenceScore;
        if (validatedActivities.length < result.activities.length) {
            console.warn('[ai-estimate-from-interview] Filtered out invalid activities:',
                result.activities.length - validatedActivities.length
            );
            confidenceScore = Math.max(0.3, confidenceScore - 0.1);
        }

        // Log success
        console.log('[ai-estimate-from-interview] Generated estimate:', {
            generatedTitle: result.generatedTitle,
            activitiesCount: validatedActivities.length,
            totalBaseDays: totalBaseDays.toFixed(2),
            confidenceScore: confidenceScore.toFixed(2),
            suggestedDriversCount: result.suggestedDrivers?.length || 0,
            suggestedRisksCount: result.suggestedRisks?.length || 0,
        });

        // Return successful response (createAIHandler wraps with statusCode/headers)
        return {
            success: true,
            generatedTitle: result.generatedTitle || '',
            activities: validatedActivities,
            totalBaseDays: Number(totalBaseDays.toFixed(2)),
            reasoning: result.reasoning,
            confidenceScore: Number(confidenceScore.toFixed(2)),
            suggestedDrivers: result.suggestedDrivers || [],
            suggestedRisks: result.suggestedRisks || [],
        };
    }
});
