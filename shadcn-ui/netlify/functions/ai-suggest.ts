import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';
import { validateAISuggestion, sanitizePromptInput } from '../../src/types/ai-validation';

// Initialize OpenAI with server-side API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// In-memory cache for AI responses (TTL: 5 minutes)
const aiCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to generate cache key
function getCacheKey(description: string, presetId: string): string {
    const normalizedDesc = description.trim().toLowerCase().substring(0, 200);
    return `${presetId}:${normalizedDesc}`;
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

// Helper to create compact prompt (reduces tokens by 60-70%)
function createCompactPrompt(activities: any[], drivers: any[], risks: any[]): string {
    const activitiesStr = activities.map(a => `${a.code}(${a.base_days}d,${a.group})`).join(', ');
    const driversStr = drivers.map(d => {
        // Safely handle options - it might not exist or be empty
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

        // Filter activities relevant to the preset's tech category
        const relevantActivities = activities.filter(
            (a) => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
        );

        console.log('Filtered activities:', relevantActivities?.length);

        // Check cache first (skip in test mode)
        const cacheKey = getCacheKey(sanitizedDescription, preset.name);
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

        // Build COMPACT system prompt (60-70% token reduction)
        console.log('📝 Creating compact prompt...');
        console.log('- relevantActivities:', relevantActivities?.length);
        console.log('- drivers:', drivers?.length);
        console.log('- risks:', risks?.length);

        let compactData;
        try {
            compactData = createCompactPrompt(relevantActivities, drivers, risks);
            console.log('✅ Compact prompt created, length:', compactData?.length);
        } catch (error: any) {
            console.error('❌ Error in createCompactPrompt:', error.message);
            console.error('Stack:', error.stack);
            throw new Error(`Failed to create compact prompt: ${error.message}`);
        }

        const systemPrompt = `Expert estimation assistant for ${preset.name} (${preset.tech_category}).

FIRST: Evaluate if the requirement description is valid and estimable.

ACCEPT as valid if it describes:
- Feature additions or modifications (even if brief)
- UI/UX changes or updates
- Data model changes, field additions
- Workflow or process modifications
- Bug fixes or improvements
- Integration or API work
- Documentation or configuration changes
- ANY action verb + technical context (update, add, modify, create, fix, change, implement)

REJECT only if it:
- Is extremely vague with no technical context (e.g., "make it better", "fix things")
- Is pure test input (e.g., "test", "aaa", "123", "qwerty")
- Contains no action or technical element
- Is random characters or gibberish
- Is a question rather than a requirement

BALANCE: A requirement can be brief but should indicate WHAT needs to be done.
"Aggiornare la lettera con aggiunta frase" ✓ (action: aggiornare, target: lettera)
"Add field to profile" ✓ (action: add, target: field)
"Make better" ✗ (no specific target or action)
"test" ✗ (test input)

IF VALID: Suggest relevant activity codes.
IF INVALID: Set isValidRequirement=false and explain specifically what's missing.

${compactData}

IMPORTANT: Return ONLY activity codes. Drivers and risks will be selected manually by the user.
Return JSON: {"isValidRequirement": true/false, "activityCodes": ["CODE"], "reasoning": "brief explanation"}`;

        const userPrompt = sanitizedDescription.substring(0, 1000); // Limit to 1000 chars

        console.log('Calling OpenAI API (optimized)...');
        console.log('Model: gpt-4o-mini');
        console.log('Test mode:', testMode ? 'enabled (temp=0.7, no cache)' : 'disabled (temp=0.1, cached)');
        console.log('System prompt length:', systemPrompt.length, '(optimized)');
        console.log('User prompt length:', userPrompt.length);

        // Call OpenAI API with optimized parameters
        const temperature = testMode ? 0.7 : 0.1; // Higher temp in test mode for variance
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature,
            max_tokens: 500, // Limit response size
        });

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

        // Parse JSON safely
        let rawSuggestion: unknown;
        try {
            rawSuggestion = JSON.parse(content);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid JSON response from AI');
        }

        // Validate with Zod schema and cross-validate with master data
        const validatedSuggestion = validateAISuggestion(
            rawSuggestion,
            relevantActivities.map((a) => a.code),
            drivers.map((d) => d.code),
            risks.map((r) => r.code)
        );

        console.log('✅ Validated suggestion:', JSON.stringify(validatedSuggestion, null, 2));

        // Cache the validated result (skip in test mode)
        if (!testMode) {
            aiCache.set(cacheKey, { response: validatedSuggestion, timestamp: Date.now() });
            console.log('💾 Cached response for future use');
        }

        // Return successful response
        console.log('Returning successful response');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(validatedSuggestion),
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
