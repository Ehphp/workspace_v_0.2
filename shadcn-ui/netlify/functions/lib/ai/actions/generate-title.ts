import { getOpenAIClient } from '../openai-client';
import { getCachedResponse, setCachedResponse } from '../ai-cache';

export interface GenerateTitleRequest {
    description: string;
}

export interface GenerateTitleResponse {
    title: string;
}

/**
 * Generate a concise title for a requirement
 * @param request - Request with requirement description
 * @returns Generated title
 */
export async function generateTitle(request: GenerateTitleRequest): Promise<GenerateTitleResponse> {
    const { description } = request;

    console.log('Generating title for description:', description.substring(0, 100));

    // Check cache first
    const cacheKey = `title:${description.substring(0, 200)}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
        console.log('Using cached title');
        return { title: cached };
    }

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: 'Create concise requirement titles (max 10 words). The description may include sections formatted as "**ColumnName**" followed by the value; use these values and their labels as context but do not repeat the label prefix in the title. Return only the title.',
            },
            {
                role: 'user',
                content: description.substring(0, 500),
            },
        ],
        temperature: 0.3,
        max_tokens: 30,
    });

    const title = completion.choices[0]?.message?.content?.trim() || description.substring(0, 100);

    // Cache the result
    setCachedResponse(cacheKey, title);
    console.log('Generated and cached title:', title);

    return { title };
}
