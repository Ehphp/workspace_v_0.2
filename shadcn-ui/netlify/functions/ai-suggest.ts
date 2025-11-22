import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { validateAISuggestion, sanitizePromptInput } from '../../src/types/ai-validation';

// Initialize OpenAI with server-side API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// In-memory cache for AI responses (TTL: 5 minutes)
const aiCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // ✅ CHANGED: 24 hours (was 5 minutes)
// Ensures same requirement returns same result within 24 hours

// Helper to generate cache key with activity codes hash
function getCacheKey(description: string, presetId: string, activityCodes: string[]): string {
    const normalizedDesc = description.trim().toLowerCase().substring(0, 200);
    const activitiesHash = activityCodes.sort().join(',');
    return `${presetId}:${normalizedDesc}:${activitiesHash}`;
}

// Helper to get cached response
function getCachedResponse(key: string): any | null {
    const cached = aiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.response;
    }
    if (cached) {
        aiCache.delete(key); // Remove expired
    }
    return null;
}

// Helper to create descriptive prompt with full activity details
// This provides GPT with complete context to make accurate suggestions
function createDescriptivePrompt(activities: any[]): string {
    // Format: CODE: Name | Description | Effort | Group
    const activitiesStr = activities.map(a =>
        `CODE: ${a.code}\n` +
        `NAME: ${a.name}\n` +
        `DESCRIPTION: ${a.description}\n` +
        `EFFORT: ${a.base_days} days | GROUP: ${a.group}\n` +
        `---`
    ).join('\n\n');

    return `AVAILABLE ACTIVITIES:\n\n${activitiesStr}`;
}

// Helper to create JSON schema with strict validation for structured outputs
// This ensures GPT can ONLY return valid activity codes (no invented codes possible)
function createActivitySchema(validActivityCodes: string[]) {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "activity_suggestion_response",
            strict: true,  // ✅ CRITICAL: Enforces strict schema adherence by OpenAI
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: {
                        type: "boolean",
                        description: "Whether the requirement description is valid and estimable"
                    },
                    activityCodes: {
                        type: "array",
                        description: "Array of relevant activity codes for this requirement",
                        items: {
                            type: "string",
                            enum: validActivityCodes  // ✅ GPT can ONLY return codes from this list
                        }
                    },
                    reasoning: {
                        type: "string",
                        description: "Brief explanation of the activity selection (max 500 characters)"
                    }
                },
                required: ["isValidRequirement", "activityCodes", "reasoning"],
                additionalProperties: false  // ✅ No extra fields allowed
            }
        }
    };
}

// Lightweight, deterministic validation to avoid pointless AI calls
function validateRequirementDescription(description: string): { isValid: boolean; reason?: string } {
    const normalized = description.trim();

    if (!normalized) {
        return { isValid: false, reason: 'Description is empty' };
    }

    if (normalized.length < 6) {
        return { isValid: false, reason: 'Description is too short to evaluate' };
    }

    if (!/[a-zA-Z\u00C0-\u017F]/.test(normalized)) {
        return { isValid: false, reason: 'Description must contain alphabetic characters' };
    }

    const testInputPatterns = /^(test|aaa+|bbb+|ccc+|qwerty|asdf|lorem ipsum|123+|\d+)$/i;
    if (testInputPatterns.test(normalized)) {
        return { isValid: false, reason: 'Description looks like placeholder or test input' };
    }

    const hasActionVerb = /(add|update|modify|change|create|implement|build|fix|refactor|remove|delete|configure|enable|disable|integrate|migrate|rename|aggiorn|aggiung|modific|crea|elimin|rimuov|implement|configur|abilit|disabilit|corregg|integra|migra|sistem)/i.test(normalized);
    if (!hasActionVerb) {
        return { isValid: false, reason: 'Missing action verb' };
    }

    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    if (words.length < 3) {
        return { isValid: false, reason: 'Description is too short or ambiguous' };
    }

    const hasTechnicalTarget = /(api|endpoint|service|servizio|microservice|database|db|table|tabella|campo|column|form|pagina|screen|ui|ux|workflow|processo|process|configurazione|report|dashboard|notifica|email|auth|login|registrazione|utente|profilo|integrazione|deploy|pipeline|script|query|data|model|schema|cache|log|monitor|cron|job|batch|trigger|webhook|storage|bucket|file|documento|pdf|excel|csv|import|export|frontend|front-end|backend|back-end|api-gateway|serverless|lambda|function|cloud)/i.test(normalized);
    if (!hasTechnicalTarget) {
        return { isValid: false, reason: 'Missing technical target (API, form, table, workflow, etc.)' };
    }

    if (/[?]{2,}$/.test(normalized) || /\?$/.test(normalized)) {
        return { isValid: false, reason: 'Description is a question, not a requirement' };
    }

    return { isValid: true };
}

// Legacy compact function (kept for reference - can be removed later)
function createCompactPrompt(activities: any[], drivers: any[], risks: any[]): string {
    const activitiesStr = activities.map(a => `${a.code}(${a.base_days}d,${a.group})`).join(', ');
    const driversStr = drivers.map(d => {
        if (!d.options || !Array.isArray(d.options) || d.options.length === 0) {
            return `${d.code}(1.0)`;
        }
        const multipliers = d.options.map((o: any) => o.multiplier).filter((m: any) => typeof m === 'number');
        if (multipliers.length === 0) {
            return `${d.code}(1.0)`;
        }
        const minMax = `${Math.min(...multipliers)}-${Math.max(...multipliers)}`;
        return `${d.code}(${minMax})`;
    }).join(', ');
    const risksStr = risks.map(r => `${r.code}(${r.weight})`).join(', ');

    return `Activities: ${activitiesStr}\nDrivers: ${driversStr}\nRisks: ${risksStr}`;
}

interface RequestBody {
    action?: 'suggest-activities' | 'generate-title';
    description: string;
    preset?: {
        id: string;
        name: string;
        description: string;
        tech_category: string;
        default_activity_codes: string[];
        default_driver_values: Record<string, string>;
        default_risks: string[];
    };
    activities?: Array<{
        code: string;
        name: string;
        base_days: number;
        group: string;
        tech_category: string;
    }>;
    drivers?: Array<{
        code: string;
        name: string;
        options?: Array<{
            value: string;
            multiplier: number;
        }>;
    }>;
    risks?: Array<{
        code: string;
        name: string;
        weight: number;
    }>;
    // Test mode: disable cache and increase temperature
    testMode?: boolean;
}

interface AIActivitySuggestion {
    isValidRequirement: boolean;
    activityCodes: string[];
    reasoning?: string;
}

export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };

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

    // Check API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not configured');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'OpenAI API key not configured on server',
            }),
        };
    }

    try {
        console.log('=== AI Suggest Function Called ===');
        console.log('HTTP Method:', event.httpMethod);
        console.log('API Key configured:', !!process.env.OPENAI_API_KEY);

        // Parse request body
        const body: RequestBody = JSON.parse(event.body || '{}');
        const action = body.action || 'suggest-activities';

        // Handle title generation
        if (action === 'generate-title') {
            const { description } = body;

            if (!description) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Missing description' }),
                };
            }

            const sanitizedDescription = sanitizePromptInput(description);
            console.log('Generating title for description:', sanitizedDescription.substring(0, 100));

            // Check cache first
            const cacheKey = `title:${sanitizedDescription.substring(0, 200)}`;
            const cached = getCachedResponse(cacheKey);
            if (cached) {
                console.log('✅ Using cached title');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ title: cached }),
                };
            }

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Create concise requirement titles (max 10 words). Return only the title.',
                    },
                    {
                        role: 'user',
                        content: sanitizedDescription.substring(0, 500), // Limit input length
                    },
                ],
                temperature: 0.3, // More deterministic
                max_tokens: 30, // Reduced from 50
            });

            const title = completion.choices[0]?.message?.content?.trim() || description.substring(0, 100);

            // Cache the result
            aiCache.set(cacheKey, { response: title, timestamp: Date.now() });
            console.log('Generated and cached title:', title);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ title }),
            };
        }

        // Handle activity suggestions (original logic)
        const { description, preset, activities, drivers, risks, testMode } = body;

        if (!description || !preset || !activities || !drivers || !risks) {
            console.error('Validation failed - missing fields');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing required fields: description, preset, activities, drivers, risks',
                }),
            };
        }

        const sanitizedDescription = sanitizePromptInput(description);
        console.log('Request body parsed:');
        console.log('- Description length:', sanitizedDescription?.length);
        console.log('- Preset:', preset?.name);
        console.log('- Activities count:', activities?.length);
        console.log('- Drivers count:', drivers?.length);
        console.log('- Risks count:', risks?.length);

        const descriptionCheck = validateRequirementDescription(sanitizedDescription);
        if (!descriptionCheck.isValid) {
            console.warn('Requirement rejected by deterministic validation:', descriptionCheck.reason);
            const invalidSuggestion: AIActivitySuggestion = {
                isValidRequirement: false,
                activityCodes: [],
                reasoning: descriptionCheck.reason || 'Requirement description is too vague or looks like test data',
            };
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(invalidSuggestion),
            };
        }

        // Filter activities relevant to the preset's tech category
        const relevantActivities = activities.filter(
            (a) => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
        );

        console.log('Filtered activities:', relevantActivities?.length);

        // Check cache first (skip in test mode)
        const relevantActivityCodes = relevantActivities.map(a => a.code);
        const cacheKey = getCacheKey(sanitizedDescription, preset.id, relevantActivityCodes);
        if (!testMode) {
            const cached = getCachedResponse(cacheKey);
            if (cached) {
                console.log('✅ Using cached AI suggestion');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(cached),
                };
            }
        } else {
            console.log('🧪 Test mode: cache disabled');
        }

        // Build DESCRIPTIVE system prompt with full activity details
        console.log('📝 Creating descriptive prompt with full activity details...');
        console.log('- relevantActivities:', relevantActivities?.length);

        let descriptiveData;
        try {
            descriptiveData = createDescriptivePrompt(relevantActivities);
            console.log('✅ Descriptive prompt created, length:', descriptiveData?.length);
        } catch (error: any) {
            console.error('❌ Error in createDescriptivePrompt:', error.message);
            console.error('Stack:', error.stack);
            throw new Error(`Failed to create descriptive prompt: ${error.message}`);
        }

        const systemPrompt = `You are an expert software estimation assistant for ${preset.name} (${preset.tech_category}).

STEP 1: Validate the requirement description.
- If it is invalid or unclear, set isValidRequirement to false, return activityCodes as an empty array, and explain why in reasoning.
- Invalid means: too vague, placeholder/test text, no action verb, no clear technical target (API, form, table, workflow, report, page, endpoint, etc.), gibberish, or a question.

STEP 2: When valid, suggest ONLY the relevant activity codes needed to implement it.

IMPORTANT CONSTRAINTS:
- You suggest ONLY activity codes (you NEVER suggest drivers or risks)
- Drivers and risks will be selected manually by the user
- Return JSON with: isValidRequirement (boolean), activityCodes (array of strings), reasoning (string)
- Activity codes MUST be from the available list below

VALIDATION RULES:

ACCEPT if requirement describes:
- Feature additions or modifications (even if brief)
- UI/UX changes or updates
- Data model changes, field additions
- Workflow or process modifications
- Bug fixes or improvements
- Integration or API work
- Documentation or configuration changes
- ANY action verb + technical context (update, add, modify, create, fix, change, implement)

REJECT only if:
- Extremely vague with no technical context (e.g., "make it better", "fix things")
- Pure test input (e.g., "test", "aaa", "123", "qwerty")
- No action or technical element
- No clear technical target (API, form, table, workflow, report, page, endpoint, etc.)
- Random characters or gibberish
- Is a question rather than a requirement

EXAMPLES:
"Aggiornare la lettera con aggiunta frase" -> accept (action: aggiornare, target: lettera)
"Add field to profile" -> accept (action: add, target: field)
"Make better" -> reject (no specific target or action)
"test" -> reject (test input)

${descriptiveData}

SELECTION GUIDELINES:
- Read the activity DESCRIPTION carefully to understand when to use it
- Consider the EFFORT (base days) to ensure realistic coverage
- Select activities from appropriate GROUP (ANALYSIS, DEV, TEST, OPS, GOVERNANCE)
- Choose activities that match the requirement's scope and complexity
- Include typical SDLC activities: analysis -> development -> testing -> deployment

RETURN FORMAT:
{"isValidRequirement": true/false, "activityCodes": ["CODE1", "CODE2", ...], "reasoning": "brief explanation of your selection"}`;

        const userPrompt = sanitizedDescription.substring(0, 1000); // Limit to 1000 chars

        console.log('Calling OpenAI API with structured outputs...');
        console.log('Model: gpt-4o-mini');
        console.log('Test mode:', testMode ? 'enabled (temp=0.7, no cache)' : 'disabled (temp=0.0, cached)');
        console.log('System prompt length:', systemPrompt.length, '(optimized)');
        console.log('User prompt length:', userPrompt.length);

        // Generate strict JSON schema with enum of valid activity codes
        // This guarantees GPT cannot invent or suggest invalid codes
        const responseSchema = createActivitySchema(
            relevantActivities.map(a => a.code)
        );
        console.log('✅ Using structured outputs with', relevantActivities.length, 'valid activity codes in enum');

        // Call OpenAI API with structured outputs (Phase 2 improvement)
        const temperature = testMode ? 0.7 : 0.0; // ✅ CHANGED: 0.0 for maximum determinism (was 0.1)
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',  // Supports structured outputs
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: responseSchema,  // ✅ PHASE 2: Strict schema with enum validation
            temperature,
            max_tokens: 500, // Limit response size
        });

        console.log('✅ Using temperature:', temperature, '(determinism level:', temperature === 0 ? 'maximum' : 'test mode', ')');

        console.log('OpenAI response received:');
        console.log('- Choices count:', response.choices?.length);
        console.log('- Model used:', response.model);
        console.log('- Usage:', JSON.stringify(response.usage));

        const content = response.choices[0]?.message?.content;
        console.log('Content length:', content?.length);
        console.log('Content preview:', content?.substring(0, 200));

        if (!content) {
            throw new Error('No response from OpenAI');
        }

        // Parse JSON (guaranteed valid by structured outputs schema)
        let suggestion: any;
        try {
            suggestion = JSON.parse(content);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid JSON response from AI');
        }

        // ✅ PHASE 2 IMPROVEMENT: Minimal validation needed
        // Structured outputs guarantee:
        // - activityCodes contains ONLY codes from enum (no invalid codes possible)
        // - All required fields present (isValidRequirement, activityCodes, reasoning)
        // - No additional properties
        // - Correct types for all fields

        console.log('✅ Structured output received and validated by OpenAI');
        console.log('- isValidRequirement:', suggestion.isValidRequirement);
        console.log('- activityCodes count:', suggestion.activityCodes?.length);
        console.log('- All codes pre-validated by enum constraint');

        // Keep basic Zod validation for extra safety (optional - can be removed)
        const validatedSuggestion = validateAISuggestion(
            suggestion,
            relevantActivities.map((a) => a.code),
            drivers.map((d) => d.code),
            risks.map((r) => r.code)
        );

        const finalSuggestion: AIActivitySuggestion = validatedSuggestion.isValidRequirement
            ? validatedSuggestion
            : {
                ...validatedSuggestion,
                activityCodes: [],
                reasoning: validatedSuggestion.reasoning || 'Requirement description is invalid or too vague',
            };

        console.log('Validated suggestion:', JSON.stringify(finalSuggestion, null, 2));

        // Cache the validated result (skip in test mode)
        if (!testMode) {
            aiCache.set(cacheKey, { response: finalSuggestion, timestamp: Date.now() });
            console.log('Cached response for future use');
        }

        // Return successful response
        console.log('Returning successful response');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(finalSuggestion),
        };
    } catch (error: any) {
        console.error('=== ERROR in ai-suggest function ===');
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);
        console.error('Error code:', error?.code);
        console.error('Error status:', error?.status);
        console.error('Error response:', error?.response?.data);
        console.error('Full error:', JSON.stringify(error, null, 2));

        // Return error response
        return {
            statusCode: error?.status || 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to generate AI suggestions',
                message: error.message || 'Unknown error',
                code: error?.code,
                status: error?.status,
            }),
        };
    }
};
