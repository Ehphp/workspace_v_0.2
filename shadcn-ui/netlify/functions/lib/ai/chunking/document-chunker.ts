/**
 * Document Chunker — splits long documents into overlapping chunks
 * for the chunked SDD pipeline.
 *
 * Pure utility with no external dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants (exported for tests and consumers)
// ─────────────────────────────────────────────────────────────────────────────

/** Default maximum characters per chunk */
export const DEFAULT_CHUNK_SIZE = 15_000;

/** Characters of overlap prepended from previous chunk */
export const DEFAULT_OVERLAP_SIZE = 500;

/** Maximum number of chunks before dynamic resize */
export const DEFAULT_MAX_CHUNKS = 10;

/** Documents above this length trigger the chunked pipeline */
export const CHUNKED_THRESHOLD = 20_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentChunk {
    /** Chunk text content (includes overlap prefix from previous chunk) */
    text: string;
    /** Zero-based chunk index */
    index: number;
    /** Total number of chunks in the split */
    totalChunks: number;
    /** Start character offset in the original document (before overlap) */
    startOffset: number;
    /** End character offset in the original document */
    endOffset: number;
}

export interface ChunkingOptions {
    /** Max characters per chunk (default: DEFAULT_CHUNK_SIZE) */
    chunkSize?: number;
    /** Overlap characters between consecutive chunks (default: DEFAULT_OVERLAP_SIZE) */
    overlapSize?: number;
    /** Maximum number of chunks — triggers dynamic resize if exceeded (default: DEFAULT_MAX_CHUNKS) */
    maxChunks?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentence-level splitting (fallback for oversized paragraphs)
// ─────────────────────────────────────────────────────────────────────────────

/** Regex for sentence boundaries — splits after . ? ! followed by whitespace */
const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/;

function splitParagraphIntoSentences(paragraph: string): string[] {
    const sentences = paragraph.split(SENTENCE_BOUNDARY).filter(s => s.length > 0);
    // If regex produced nothing useful, return original as single element
    return sentences.length > 0 ? sentences : [paragraph];
}

// ─────────────────────────────────────────────────────────────────────────────
// Core chunking logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a document into overlapping chunks suitable for partial SDD extraction.
 *
 * Algorithm:
 * 1. Split on paragraph boundaries (\n\n)
 * 2. Greedily accumulate paragraphs until adding the next would exceed chunkSize
 * 3. If a single paragraph exceeds chunkSize, split on sentence boundaries
 * 4. Prepend the last overlapSize chars of the previous chunk to the next
 * 5. If total chunks > maxChunks, recompute chunkSize proportionally
 *
 * @param sourceText - Full document text (any length)
 * @param options - Chunking parameters
 * @returns Array of DocumentChunk objects, or single-element array for short docs
 */
export function splitDocumentIntoChunks(
    sourceText: string,
    options?: ChunkingOptions,
): DocumentChunk[] {
    const text = sourceText.trim();
    if (text.length === 0) {
        return [];
    }

    let chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlapSize = options?.overlapSize ?? DEFAULT_OVERLAP_SIZE;
    const maxChunks = options?.maxChunks ?? DEFAULT_MAX_CHUNKS;

    // Short document — single chunk, no split needed
    if (text.length <= chunkSize) {
        return [{
            text,
            index: 0,
            totalChunks: 1,
            startOffset: 0,
            endOffset: text.length,
        }];
    }

    // Split into paragraphs (preserve paragraph separators as boundaries)
    const paragraphs = text.split(/\n\n+/);

    // Break paragraphs that exceed chunkSize into sentences
    const segments: string[] = [];
    for (const para of paragraphs) {
        if (para.length <= chunkSize) {
            segments.push(para);
        } else {
            // Paragraph too large — split into sentences
            const sentences = splitParagraphIntoSentences(para);
            for (const sentence of sentences) {
                if (sentence.length <= chunkSize) {
                    segments.push(sentence);
                } else {
                    // Sentence still too large — hard-split at chunkSize
                    for (let i = 0; i < sentence.length; i += chunkSize) {
                        segments.push(sentence.slice(i, i + chunkSize));
                    }
                }
            }
        }
    }

    // First pass: greedy accumulation into raw chunks (no overlap yet)
    let rawChunks = greedyAccumulate(segments, chunkSize);

    // If too many chunks, recompute chunkSize and re-accumulate
    if (rawChunks.length > maxChunks) {
        chunkSize = Math.ceil(text.length / maxChunks) + overlapSize;
        // Re-segment with the larger chunkSize if needed
        const reSegments: string[] = [];
        for (const seg of segments) {
            if (seg.length <= chunkSize) {
                reSegments.push(seg);
            } else {
                for (let i = 0; i < seg.length; i += chunkSize) {
                    reSegments.push(seg.slice(i, i + chunkSize));
                }
            }
        }
        rawChunks = greedyAccumulate(reSegments, chunkSize);
    }

    // Second pass: apply overlap and compute offsets
    const totalChunks = rawChunks.length;
    const result: DocumentChunk[] = [];
    let currentOffset = 0;

    for (let i = 0; i < rawChunks.length; i++) {
        const rawText = rawChunks[i];
        const startOffset = currentOffset;
        const endOffset = currentOffset + rawText.length;

        let chunkText: string;
        if (i === 0) {
            // First chunk: no overlap prefix
            chunkText = rawText;
        } else {
            // Prepend overlap from previous raw chunk
            const prevRaw = rawChunks[i - 1];
            const overlapText = prevRaw.slice(Math.max(0, prevRaw.length - overlapSize));
            chunkText = overlapText + '\n\n' + rawText;
        }

        result.push({
            text: chunkText,
            index: i,
            totalChunks,
            startOffset,
            endOffset,
        });

        currentOffset = endOffset;
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Greedily accumulates segments into chunks up to maxSize.
 * Joins segments with paragraph separators (\n\n).
 */
function greedyAccumulate(segments: string[], maxSize: number): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const seg of segments) {
        const separator = current.length > 0 ? '\n\n' : '';
        const candidate = current + separator + seg;

        if (candidate.length <= maxSize) {
            current = candidate;
        } else {
            // Current chunk is full — push and start new
            if (current.length > 0) {
                chunks.push(current);
            }
            current = seg;
        }
    }

    // Push final chunk
    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}
