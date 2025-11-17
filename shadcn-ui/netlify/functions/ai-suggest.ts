import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import OpenAI from 'openai';

// Initialize OpenAI with server-side API key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
    }>;
    risks?: Array<{
        code: string;
        name: string;
        weight: number;
    }>;
}

interface AIActivitySuggestion {
    activityCodes: string[];
    suggestedDrivers?: Record<string, string>;
    suggestedRisks?: string[];
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

            console.log('Generating title for description:', description.substring(0, 100));

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that creates concise, clear titles for software requirements. Generate a title of maximum 10 words that captures the essence of the requirement description. Return ONLY the title text, no quotes or extra formatting.',
                    },
                    {
                        role: 'user',
                        content: `Create a concise title for this requirement:\n\n${description}`,
                    },
                ],
                temperature: 0.7,
                max_tokens: 50,
            });

            const title = completion.choices[0]?.message?.content?.trim() || description.substring(0, 100);

            console.log('Generated title:', title);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ title }),
            };
        }

        // Handle activity suggestions (original logic)
        const { description, preset, activities, drivers, risks } = body;

        console.log('Request body parsed:');
        console.log('- Description length:', description?.length);
        console.log('- Preset:', preset?.name);
        console.log('- Activities count:', activities?.length);
        console.log('- Drivers count:', drivers?.length);
        console.log('- Risks count:', risks?.length);

        // Validate required fields
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

        // Filter activities relevant to the preset's tech category
        const relevantActivities = activities.filter(
            (a) => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
        );

        // Build system prompt
        const systemPrompt = `You are an expert software estimation assistant. Your role is to suggest which activities should be included in an estimation based on a requirement description.

IMPORTANT: You only suggest activities. You DO NOT calculate effort or days. The calculation is done by a deterministic engine.

Technology Preset: ${preset.name} (${preset.tech_category})
Description: ${preset.description}

Available activities for this technology:
${relevantActivities.map((a) => `- ${a.code}: ${a.name} (${a.base_days} days, ${a.group})`).join('\n')}

Available drivers:
${drivers.map((d) => `- ${d.code}: ${d.name}`).join('\n')}

Available risks:
${risks.map((r) => `- ${r.code}: ${r.name} (weight: ${r.weight})`).join('\n')}

Based on the requirement description, suggest:
1. Which activity codes should be selected (array of codes)
2. Optionally, suggested driver values (object with driver codes as keys)
3. Optionally, suggested risk codes (array of codes)

Return your response as a JSON object with this structure:
{
  "activityCodes": ["CODE1", "CODE2", ...],
  "suggestedDrivers": {"COMPLEXITY": "HIGH", ...},
  "suggestedRisks": ["R_CODE1", ...],
  "reasoning": "Brief explanation of your suggestions"
}`;

        const userPrompt = `Requirement description:
${description}

Please suggest which activities, drivers, and risks are relevant for this requirement.`;

        console.log('Calling OpenAI API...');
        console.log('Model: gpt-4o-mini');
        console.log('System prompt length:', systemPrompt.length);
        console.log('User prompt length:', userPrompt.length);

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
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

        const suggestion: AIActivitySuggestion = JSON.parse(content);
        console.log('Parsed suggestion:', JSON.stringify(suggestion, null, 2));

        // Validate that suggested activity codes exist
        const validActivityCodes = relevantActivities.map((a) => a.code);
        suggestion.activityCodes = suggestion.activityCodes.filter((code) =>
            validActivityCodes.includes(code)
        );

        // Return successful response
        console.log('Returning successful response');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(suggestion),
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
