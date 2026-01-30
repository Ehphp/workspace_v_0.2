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

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { sanitizePromptInput } from '../../src/types/ai-validation';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';

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

/**
 * System prompt for generating estimate from interview
 */
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

REGOLE IMPORTANTI:
- Usa SOLO codici attività presenti nel catalogo fornito
- Non inventare attività o codici
- Sii conservativo: meglio una stima accurata che ottimistica
- Se una risposta indica alta complessità, includi attività extra (testing, review, documentation)
- Considera dipendenze e integrazioni menzionate nelle risposte
- Se le risposte sono incomplete o vaghe, abbassa il confidence score

ANALISI DELLE RISPOSTE:
- Risposte che indicano integrazioni → aggiungi attività di integrazione e testing
- Risposte che indicano alti volumi → aggiungi attività di performance/ottimizzazione
- Risposte che indicano sicurezza → aggiungi attività di security review
- Risposte che indicano UI complessa → aggiungi attività frontend aggiuntive
- Risposte che indicano requisiti di testing → aggiungi attività QA

CONFIDENCE SCORE:
- 0.9-1.0: Tutte le risposte chiare e complete, requisito ben definito
- 0.7-0.9: Risposte sufficienti, qualche ambiguità minore
- 0.5-0.7: Alcune risposte vaghe, stima approssimativa
- 0.3-0.5: Molte risposte mancanti, stima molto approssimativa
- <0.3: Informazioni insufficienti per una stima affidabile

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
      "fromQuestionId": "q1_integration" // ID della domanda correlata
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

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    return new OpenAI({
        apiKey,
        timeout: 55000, // 55 second timeout (Netlify has 60s limit)
        maxRetries: 1,
    });
}

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

/**
 * Main handler
 */
export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    // Debug logging
    logAuthDebugInfo();
    console.log('[ai-estimate-from-interview] Request received');

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // Origin allowlist check
    if (!isOriginAllowed(originHeader)) {
        console.warn('[ai-estimate-from-interview] Blocked origin:', originHeader);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Origin not allowed' }),
        };
    }

    // Auth validation (allow unauthenticated for Quick Estimate demo)
    const authHeader = event.headers.authorization || (event.headers.Authorization as string | undefined);
    const authResult = await validateAuthToken(authHeader);

    if (!authResult.ok && authHeader) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: authResult.message || 'Unauthorized' }),
        };
    }

    try {
        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');

        // Validate required fields
        if (!body.description || typeof body.description !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing description',
                    message: 'La descrizione del requisito è obbligatoria.',
                }),
            };
        }

        if (!body.answers || typeof body.answers !== 'object') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing answers',
                    message: 'Le risposte all\'interview sono obbligatorie.',
                }),
            };
        }

        if (!body.activities || !Array.isArray(body.activities) || body.activities.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing activities catalog',
                    message: 'Il catalogo delle attività è obbligatorio.',
                }),
            };
        }

        // Sanitize description
        const sanitizedDescription = sanitizePromptInput(body.description);

        // Check OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            console.error('[ai-estimate-from-interview] OPENAI_API_KEY not configured');
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Service configuration error',
                    message: 'Il servizio AI non è configurato. Contatta il supporto.',
                }),
            };
        }

        // Initialize OpenAI client
        const openai = getOpenAIClient();

        // Format data for prompt
        const activitiesCatalog = formatActivitiesCatalog(body.activities);
        const interviewAnswers = formatInterviewAnswers(body.answers);
        const validActivityCodes = body.activities.map(a => a.code);

        console.log('[ai-estimate-from-interview] Processing:', {
            descriptionLength: sanitizedDescription.length,
            answersCount: Object.keys(body.answers).length,
            activitiesCount: body.activities.length,
            techCategory: body.techCategory,
            validCodes: validActivityCodes.slice(0, 5).join(', ') + (validActivityCodes.length > 5 ? '...' : ''),
        });

        // Build response schema with valid activity codes enum
        // This is CRITICAL to prevent AI from inventing codes
        const responseSchema = buildResponseSchema(validActivityCodes);

        // Build user prompt
        const userPrompt = `REQUISITO:
${sanitizedDescription}

RISPOSTE INTERVIEW TECNICA:
${interviewAnswers}

CATALOGO ATTIVITÀ DISPONIBILI (usa SOLO questi codici):
${activitiesCatalog}

IMPORTANTE: Puoi usare ESCLUSIVAMENTE i codici attività elencati sopra. Non inventare nuovi codici.

Analizza le risposte e seleziona le attività necessarie per implementare questo requisito.
Collega ogni attività alla risposta che l'ha motivata.`;

        // Call OpenAI with dynamic schema containing enum constraint
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.1, // Low temperature for consistent estimates
            max_tokens: 2500,
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT
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

        // Return successful response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                generatedTitle: result.generatedTitle || '',
                activities: validatedActivities,
                totalBaseDays: Number(totalBaseDays.toFixed(2)),
                reasoning: result.reasoning,
                confidenceScore: Number(confidenceScore.toFixed(2)),
                suggestedDrivers: result.suggestedDrivers || [],
                suggestedRisks: result.suggestedRisks || [],
            }),
        };

    } catch (error) {
        console.error('[ai-estimate-from-interview] Error:', error);

        const isTimeoutError = error instanceof Error && error.message.includes('timeout');
        const isParseError = error instanceof SyntaxError;

        let statusCode = 500;
        let message = 'Errore durante la generazione della stima. Riprova.';

        if (isTimeoutError) {
            statusCode = 504;
            message = 'Il servizio AI ha impiegato troppo tempo. Riprova.';
        } else if (isParseError) {
            statusCode = 502;
            message = 'Risposta AI non valida. Riprova.';
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                message,
                activities: [],
                totalBaseDays: 0,
                reasoning: '',
                confidenceScore: 0,
            }),
        };
    }
};
