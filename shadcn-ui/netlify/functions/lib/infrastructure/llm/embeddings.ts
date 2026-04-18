/**
 * OpenAI Embeddings Client
 * 
 * Generates vector embeddings using OpenAI's text-embedding-3-small model.
 * Used for semantic search of activities and requirements.
 */

import OpenAI from 'openai';

// Singleton client instance
let embeddingClient: OpenAI | null = null;

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Get OpenAI client for embeddings
 */
function getEmbeddingClient(): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    if (!embeddingClient) {
        embeddingClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 30000,
            maxRetries: 2,
        });
    }

    return embeddingClient;
}

/**
 * Generate embedding for a single text
 * 
 * @param text - Text to embed
 * @returns Vector embedding (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
        throw new Error('Cannot generate embedding for empty text');
    }

    const client = getEmbeddingClient();

    // Normalize text: remove excessive whitespace, limit length
    const normalizedText = text
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000); // OpenAI limit is ~8191 tokens

    const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: normalizedText,
        dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than individual calls
 * 
 * @param texts - Array of texts to embed
 * @returns Array of embeddings in same order
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
        return [];
    }

    const client = getEmbeddingClient();

    // Normalize texts
    const normalizedTexts = texts.map(t =>
        t.replace(/\s+/g, ' ').trim().substring(0, 8000)
    );

    // OpenAI batch limit is ~2048 items, but we'll chunk at 100 for safety
    const BATCH_SIZE = 100;
    const results: number[][] = [];

    for (let i = 0; i < normalizedTexts.length; i += BATCH_SIZE) {
        const batch = normalizedTexts.slice(i, i + BATCH_SIZE);

        const response = await client.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
        });

        // Embeddings come back in order of input
        for (const data of response.data) {
            results.push(data.embedding);
        }
    }

    return results;
}

/**
 * Create searchable text for an activity
 * Combines name and description for better semantic representation
 */
export function createActivitySearchText(activity: {
    name: string;
    description?: string | null;
    code: string;
    group?: string;
}): string {
    const parts = [
        activity.name,
        activity.description || '',
        `Category: ${activity.group || 'General'}`,
    ].filter(Boolean);

    return parts.join('. ');
}

/**
 * Create searchable text for a requirement
 * Combines title and description
 */
export function createRequirementSearchText(requirement: {
    title: string;
    description?: string | null;
}): string {
    return `${requirement.title}. ${requirement.description || ''}`.trim();
}

/**
 * Export constants for use elsewhere
 */
export const EMBEDDING_CONFIG = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
} as const;
