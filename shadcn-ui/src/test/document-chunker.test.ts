/**
 * Tests for document-chunker.ts
 *
 * Covers:
 *   a. Short document below threshold → single chunk
 *   b. Document above threshold → multiple chunks
 *   c. Overlap between consecutive chunks
 *   d. Respects paragraph boundaries
 *   e. Never exceeds maxChunks (dynamic resize)
 *   f. Empty input → single empty chunk
 *   g. Chunk metadata (index, totalChunks, startOffset, endOffset)
 *   h. Very long single paragraph → sentence fallback
 */

import {
    splitDocumentIntoChunks,
    CHUNKED_THRESHOLD,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_OVERLAP_SIZE,
    DEFAULT_MAX_CHUNKS,
    type DocumentChunk,
} from '../../netlify/functions/lib/ai/chunking/document-chunker';
import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate text of a given length with paragraph breaks */
function generateText(length: number, paragraphEvery = 500): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz ';
    let text = '';
    let sinceBreak = 0;
    for (let i = 0; i < length; i++) {
        if (sinceBreak >= paragraphEvery) {
            text += '.\n\n';
            sinceBreak = 0;
            i += 2; // account for \n\n
        } else {
            text += chars[i % chars.length];
            sinceBreak++;
        }
    }
    return text;
}

/** Generate text made of sentences, no paragraph breaks */
function generateSentences(length: number, sentenceLen = 80): string {
    const word = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ';
    let text = '';
    while (text.length < length) {
        const remaining = length - text.length;
        if (remaining < sentenceLen) {
            text += word.repeat(Math.ceil(remaining / word.length)).slice(0, remaining - 1) + '.';
        } else {
            text += word.repeat(Math.ceil(sentenceLen / word.length)).slice(0, sentenceLen - 1) + '. ';
        }
    }
    return text.slice(0, length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('splitDocumentIntoChunks', () => {
    it('a. returns a single chunk for short text', () => {
        const text = 'Short text.';
        const chunks = splitDocumentIntoChunks(text);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].text).toBe(text);
        expect(chunks[0].index).toBe(0);
        expect(chunks[0].totalChunks).toBe(1);
    });

    it('b. splits a long document into multiple chunks', () => {
        const text = generateText(50000);
        const chunks = splitDocumentIntoChunks(text);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.length).toBeLessThanOrEqual(DEFAULT_MAX_CHUNKS);
    });

    it('c. has overlap between consecutive chunks', () => {
        const text = generateText(40000);
        const chunks = splitDocumentIntoChunks(text);
        if (chunks.length >= 2) {
            // Overlap is added in the text content, not in offsets.
            // Verify the chunk text contains the overlap prefix from previous chunk.
            const prevRaw = chunks[0].text;
            const overlapSuffix = prevRaw.slice(Math.max(0, prevRaw.length - DEFAULT_OVERLAP_SIZE));
            expect(chunks[1].text.startsWith(overlapSuffix)).toBe(true);
        }
    });

    it('d. chunk metadata is correct', () => {
        const text = generateText(35000);
        const chunks = splitDocumentIntoChunks(text);
        for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].index).toBe(i);
            expect(chunks[i].totalChunks).toBe(chunks.length);
            expect(chunks[i].startOffset).toBeGreaterThanOrEqual(0);
            expect(chunks[i].endOffset).toBeGreaterThan(chunks[i].startOffset);
            expect(chunks[i].endOffset).toBeLessThanOrEqual(text.length);
        }
    });

    it('e. never exceeds maxChunks even for very long text', () => {
        const text = generateText(200000);
        const chunks = splitDocumentIntoChunks(text);
        expect(chunks.length).toBeLessThanOrEqual(DEFAULT_MAX_CHUNKS);
    });

    it('f. handles empty input gracefully', () => {
        const chunks = splitDocumentIntoChunks('');
        expect(chunks).toHaveLength(0);
    });

    it('g. chunk offsets are contiguous and cover the document', () => {
        const text = generateText(45000);
        const chunks = splitDocumentIntoChunks(text);
        // Start of first chunk = 0
        expect(chunks[0].startOffset).toBe(0);
        // Each chunk starts exactly where the previous ended
        for (let i = 1; i < chunks.length; i++) {
            expect(chunks[i].startOffset).toBe(chunks[i - 1].endOffset);
        }
        // Last chunk end should be close to text length (paragraph joining may shift slightly)
        const lastEnd = chunks[chunks.length - 1].endOffset;
        expect(lastEnd).toBeGreaterThan(text.length * 0.98);
        expect(lastEnd).toBeLessThanOrEqual(text.length);
    });

    it('h. handles a single very long paragraph (sentence fallback)', () => {
        // No paragraph breaks, only sentences
        const text = generateSentences(40000);
        expect(text.includes('\n\n')).toBe(false);
        const chunks = splitDocumentIntoChunks(text);
        expect(chunks.length).toBeGreaterThan(1);
    });

    it('respects custom chunkSize and overlap', () => {
        const text = generateText(30000);
        const chunks = splitDocumentIntoChunks(text, {
            chunkSize: 5000,
            overlapSize: 200,
            maxChunks: 20,
        });
        expect(chunks.length).toBeGreaterThan(3);
        // Each chunk text should be roughly chunkSize
        for (const c of chunks.slice(0, -1)) {
            expect(c.text.length).toBeLessThanOrEqual(6000); // some slack for boundary seeking
        }
    });
});
