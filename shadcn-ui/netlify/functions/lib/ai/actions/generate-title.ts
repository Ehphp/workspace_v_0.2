import { getDefaultProvider } from '../openai-client';

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

    const provider = getDefaultProvider();
    const systemPrompt = 'Create concise requirement titles (max 10 words). The description may include sections formatted as "**ColumnName**" followed by the value; use these values and their labels as context but do not repeat the label prefix in the title. Return only the title.';

    const responseContent = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 30,
        systemPrompt: systemPrompt,
        userPrompt: description.substring(0, 500)
    });

    const title = responseContent?.trim() || description.substring(0, 100);

    console.log('Generated title:', title);

    return { title };
}
