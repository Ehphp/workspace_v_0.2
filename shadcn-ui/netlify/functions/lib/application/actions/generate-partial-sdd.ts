/**
 * AI Action: Generate Partial SDD from a single document chunk.
 *
 * Part of the chunked SDD pipeline — each chunk is processed independently
 * to extract a partial Structured Document Digest. Results are later
 * consolidated by consolidate-sdd.ts.
 */

import type { DocumentChunk } from '../../ai/chunking/document-chunker';
import {
    PARTIAL_SDD_SYSTEM_PROMPT,
    createPartialSDDResponseSchema,
    PartialSDDSchema,
    type PartialSDD,
} from '../../ai/prompts/partial-sdd';

// Re-export PartialSDD type for consumers
export type { PartialSDD };

/** Minimal provider interface to avoid coupling to concrete OpenAI client */
interface LLMProvider {
    generateContent(params: {
        model: string;
        temperature: number;
        maxTokens: number;
        responseFormat: any;
        systemPrompt: string;
        userPrompt: string;
        reasoningEffort?: 'high' | 'medium' | 'low' | 'minimal';
        options?: { timeout: number; maxRetries: number };
    }): Promise<string>;
}

/**
 * Extract a partial SDD from a single document chunk.
 *
 * @param chunk - Document chunk with metadata (index, totalChunks, offsets)
 * @param provider - LLM provider (OpenAI client)
 * @returns Validated PartialSDD
 * @throws If LLM returns no output or schema validation fails
 */
export async function generatePartialSDD(
    chunk: DocumentChunk,
    provider: LLMProvider,
): Promise<PartialSDD> {
    const startMs = Date.now();
    const chunkLabel = `chunk ${chunk.index + 1}/${chunk.totalChunks}`;

    console.log(`[generate-partial-sdd] Processing ${chunkLabel}, ${chunk.text.length} chars (offset ${chunk.startOffset}-${chunk.endOffset})`);

    const userPrompt = [
        `FRAMMENTO ${chunk.index + 1} DI ${chunk.totalChunks}`,
        `Caratteri ${chunk.startOffset}-${chunk.endOffset} del documento originale`,
        '',
        chunk.text,
    ].join('\n');

    const schema = createPartialSDDResponseSchema();

    const raw = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 3000,
        responseFormat: schema as any,
        systemPrompt: PARTIAL_SDD_SYSTEM_PROMPT,
        userPrompt,
        reasoningEffort: 'low',
        options: { timeout: 60_000, maxRetries: 0 },
    });

    const elapsedMs = Date.now() - startMs;

    if (!raw) {
        console.error(`[generate-partial-sdd] ${chunkLabel}: empty LLM response (${elapsedMs}ms)`);
        throw new Error(`No response from LLM for partial SDD extraction (${chunkLabel})`);
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.error(`[generate-partial-sdd] ${chunkLabel}: invalid JSON (${elapsedMs}ms)`);
        throw new Error(`LLM returned invalid JSON for partial SDD (${chunkLabel})`);
    }

    const validation = PartialSDDSchema.safeParse(parsed);
    if (!validation.success) {
        console.error(`[generate-partial-sdd] ${chunkLabel}: schema validation failed (${elapsedMs}ms):`, validation.error.issues);
        throw new Error(`Partial SDD schema validation failed (${chunkLabel})`);
    }

    const result = validation.data;
    console.log(
        `[generate-partial-sdd] ${chunkLabel} OK (${elapsedMs}ms):`,
        `${result.functionalAreas.length} areas,`,
        `${result.businessEntities.length} entities,`,
        `${result.externalSystems.length} systems,`,
        `${result.keyPassages.length} passages,`,
        `quality: ${result.documentQuality}`,
    );

    return result;
}
