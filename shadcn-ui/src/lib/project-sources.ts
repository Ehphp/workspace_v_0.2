/**
 * Project Sources — Parsing & Bundle Utilities
 *
 * Handles client-side file reading and text extraction for the
 * "Create Project from Sources" multi-source ingestion flow.
 *
 * Supports: .txt, .md (native), .pdf (pdfjs-dist), .docx (mammoth).
 */

import type {
    ProjectSourceItem,
    ProjectSourceBundle,
    DocumentStructure,
    DocumentParsingWarning,
    DocumentSectionMeta,
    DocumentBlock,
    DocumentFormat,
    HeadingBlock,
    ParsedDocument,
} from '@/types/project-sources';
import { MAX_FILE_SIZE_BYTES, ACCEPTED_EXTENSIONS } from '@/types/project-sources';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HEADING_FONT_SIZE_RATIO = 1.3;

// ─────────────────────────────────────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────────────────────────────────────

let _counter = 0;
export function generateSourceId(): string {
    return `src_${Date.now()}_${++_counter}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal result type for structured extraction
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedContent {
    textContent: string;
    structure: DocumentStructure;
    parsedDocument: ParsedDocument;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection functions: blocks → text, blocks → structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic text serialization of document blocks.
 * Produces a Markdown-flavored plain text representation.
 */
export function blocksToText(blocks: DocumentBlock[]): string {
    const parts: string[] = [];
    for (const block of blocks) {
        switch (block.type) {
            case 'heading':
                parts.push(`${'#'.repeat(block.level)} ${block.text}`);
                break;
            case 'paragraph':
                if (block.text.trim()) parts.push(block.text.trim());
                break;
            case 'table': {
                const md = rowsToMarkdownTable(block.rows);
                if (md) parts.push(md);
                break;
            }
            case 'page-break':
                parts.push(`--- Page ${block.pageNumber} ---`);
                break;
            case 'list': {
                const lines = block.ordered
                    ? block.items.map((item, i) => `${i + 1}. ${item}`)
                    : block.items.map((item) => `- ${item}`);
                parts.push(lines.join('\n'));
                break;
            }
            case 'image-placeholder':
                parts.push(block.alt ? `[Image: ${block.alt}]` : '[Image]');
                break;
        }
    }
    return parts.join('\n\n');
}

/**
 * Derive the legacy DocumentStructure from a ParsedDocument.
 * Keeps backward compatibility with UI and existing consumers.
 */
function deriveStructure(doc: ParsedDocument): DocumentStructure {
    const sections: DocumentSectionMeta[] = doc.blocks
        .filter((b): b is HeadingBlock => b.type === 'heading')
        .map((b) => ({
            level: b.level,
            title: b.text,
            pageNumber: b.provenance?.pageNumber,
        }));

    return {
        pageCount: doc.metadata.pageCount,
        sections,
        detectedImageCount: doc.metadata.detectedImageCount,
        warnings: doc.metadata.warnings,
    };
}

/**
 * Render a rows×cells matrix as a Markdown table.
 */
function rowsToMarkdownTable(rows: string[][]): string | null {
    if (rows.length === 0 || rows[0].length === 0) return null;
    const colCount = Math.max(...rows.map((r) => r.length));
    const normalized = rows.map((r) => {
        const padded = [...r];
        while (padded.length < colCount) padded.push('');
        return padded.map((c) => c.replace(/\|/g, '\\|'));
    });
    const headerRow = `| ${normalized[0].join(' | ')} |`;
    const separatorRow = `| ${normalized[0].map(() => '---').join(' | ')} |`;
    const dataRows = normalized.slice(1).map((r) => `| ${r.join(' | ')} |`);
    return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Extract a rows×cells string matrix from an HTML table element.
 */
function htmlTableToRows(table: HTMLTableElement): string[][] {
    return Array.from(table.querySelectorAll('tr')).map((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map((c) => (c.textContent ?? '').trim());
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// File → ProjectSourceItem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a local File into a ProjectSourceItem.
 * Text extraction happens entirely client-side.
 */
export async function parseProjectFile(file: File): Promise<ProjectSourceItem> {
    const id = generateSourceId();
    const ext = getFileExtension(file.name);

    // Validate extension
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return {
            id,
            type: 'file',
            label: file.name,
            status: 'error',
            textContent: '',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            errorMessage: `Unsupported file type: ${ext}. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`,
        };
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return {
            id,
            type: 'file',
            label: file.name,
            status: 'error',
            textContent: '',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            errorMessage: `File too large (${formatFileSize(file.size)}). Maximum: ${formatFileSize(MAX_FILE_SIZE_BYTES)}`,
        };
    }

    try {
        const extracted = await extractContent(file, ext);

        if (!extracted.textContent.trim()) {
            return {
                id,
                type: 'file',
                label: file.name,
                status: 'error',
                textContent: '',
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                errorMessage: 'No text could be extracted from this file.',
            };
        }

        return {
            id,
            type: 'file',
            label: file.name,
            status: 'ready',
            textContent: extracted.textContent,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            structure: extracted.structure,
            parsedDocument: extracted.parsedDocument,
        };
    } catch (err) {
        return {
            id,
            type: 'file',
            label: file.name,
            status: 'error',
            textContent: '',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            errorMessage: err instanceof Error ? err.message : 'Failed to extract text from file.',
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content extraction by format
// ─────────────────────────────────────────────────────────────────────────────

async function extractContent(file: File, ext: string): Promise<ExtractedContent> {
    switch (ext) {
        case '.txt':
        case '.md': {
            const text = await file.text();
            const format: DocumentFormat = ext === '.md' ? 'md' : 'txt';
            const parsedDocument: ParsedDocument = {
                format,
                blocks: text.trim() ? [{ type: 'paragraph', text }] : [],
                metadata: { detectedImageCount: 0, warnings: [] },
            };
            return {
                textContent: text,
                structure: deriveStructure(parsedDocument),
                parsedDocument,
            };
        }
        case '.pdf':
            return extractPdfContent(file);
        case '.docx':
            return extractDocxContent(file);
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Extraction (blocks-first)
// ─────────────────────────────────────────────────────────────────────────────

async function extractPdfContent(file: File): Promise<ExtractedContent> {
    const pdfjs = await import('pdfjs-dist');

    // Configure worker
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    const blocks: DocumentBlock[] = [];
    let totalImageCount = 0;
    const warnings: DocumentParsingWarning[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Page break block (provenance marker)
        blocks.push({ type: 'page-break', pageNumber: i });

        // --- Text extraction with heading heuristics ---
        const content = await page.getTextContent();
        const items = content.items.filter(
            (item): item is typeof item & { str: string; transform: number[] } =>
                'str' in item && 'transform' in item,
        );

        if (items.length > 0) {
            // Compute median font size for heading detection
            const fontSizes = items
                .map((item) => Math.abs(item.transform[3]))
                .filter((s) => s > 0);
            const medianFontSize = fontSizes.length > 0 ? median(fontSizes) : 12;
            const headingThreshold = medianFontSize * HEADING_FONT_SIZE_RATIO;

            // Group consecutive non-heading text items into paragraph blocks
            let paragraphBuffer: string[] = [];

            const flushParagraph = () => {
                if (paragraphBuffer.length > 0) {
                    const text = paragraphBuffer.join(' ').trim();
                    if (text) {
                        blocks.push({
                            type: 'paragraph',
                            text,
                            provenance: { pageNumber: i },
                        });
                    }
                    paragraphBuffer = [];
                }
            };

            for (const item of items) {
                const text = item.str.trim();
                if (!text) continue;
                const fontSize = Math.abs(item.transform[3]);

                if (fontSize > headingThreshold && text.length > 2 && text.length < 200) {
                    flushParagraph();
                    blocks.push({
                        type: 'heading',
                        level: 2,
                        text,
                        provenance: { pageNumber: i },
                    });
                } else {
                    paragraphBuffer.push(text);
                }
            }

            flushParagraph();
        }

        // --- Image count detection via operator list (named constants) ---
        try {
            const ops = await page.getOperatorList();
            for (const op of ops.fnArray) {
                if (
                    op === pdfjs.OPS.paintImageXObject ||
                    op === pdfjs.OPS.paintInlineImageXObject
                ) {
                    totalImageCount++;
                }
            }
        } catch {
            // Non-critical: skip image counting for this page
        }
    }

    // Image warning (document-level; cannot correlate to block positions in PDF)
    if (totalImageCount > 0) {
        warnings.push({
            code: 'images_detected',
            message: `${totalImageCount} image${totalImageCount !== 1 ? 's' : ''} detected in PDF (not yet analyzed)`,
        });
    }

    const parsedDocument: ParsedDocument = {
        format: 'pdf',
        blocks,
        metadata: {
            pageCount: pdf.numPages,
            detectedImageCount: totalImageCount,
            warnings,
        },
    };

    // Derive text projection from blocks
    const textContent = blocksToText(blocks);

    return {
        textContent,
        structure: deriveStructure(parsedDocument),
        parsedDocument,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX Extraction (blocks-first)
// ─────────────────────────────────────────────────────────────────────────────

async function extractDocxContent(file: File): Promise<ExtractedContent> {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    const warnings: DocumentParsingWarning[] = [];
    const blocks: DocumentBlock[] = [];

    // Parse HTML using browser-native DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    // Count images once at document scope to avoid double-counting
    const detectedImageCount = body.querySelectorAll('img').length;

    for (const node of Array.from(body.children)) {
        const tag = node.tagName.toLowerCase();

        // --- Headings ---
        const headingMatch = tag.match(/^h([1-6])$/);
        if (headingMatch) {
            const level = parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
            const title = (node.textContent ?? '').trim();
            if (title) {
                blocks.push({ type: 'heading', level, text: title });
            }
            continue;
        }

        // --- Tables ---
        if (tag === 'table') {
            const rows = htmlTableToRows(node as HTMLTableElement);
            if (rows.length > 0) {
                blocks.push({ type: 'table', rows });
            }
            continue;
        }

        // --- Lists ---
        if (tag === 'ul' || tag === 'ol') {
            const items = Array.from(node.querySelectorAll('li'))
                .map((li) => (li.textContent ?? '').trim())
                .filter(Boolean);
            if (items.length > 0) {
                blocks.push({ type: 'list', ordered: tag === 'ol', items });
            }
            continue;
        }

        // --- Paragraphs and other elements → text ---
        const text = (node.textContent ?? '').trim();
        if (text) {
            blocks.push({ type: 'paragraph', text });
        }
    }

    if (detectedImageCount > 0) {
        warnings.push({
            code: 'images_detected',
            message: `${detectedImageCount} image${detectedImageCount !== 1 ? 's' : ''} detected in DOCX (not yet analyzed)`,
        });
    }

    const parsedDocument: ParsedDocument = {
        format: 'docx',
        blocks,
        metadata: {
            detectedImageCount,
            warnings,
        },
    };

    // Derive text projection from blocks
    const textContent = blocksToText(blocks);

    return {
        textContent,
        structure: deriveStructure(parsedDocument),
        parsedDocument,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a combined source text from all ready sources.
 * Sources in error or with empty content are excluded.
 * Each source is separated by a readable header.
 *
 * Note: combinedSourceText is a derived bundle projection.
 * Each source's textContent is itself derived from its ParsedDocument blocks.
 * The backend contract ({ sourceText: string }) remains unchanged.
 */
export function buildProjectSourceBundle(sources: ProjectSourceItem[]): ProjectSourceBundle {
    const validSources = sources.filter(
        (s) => s.status === 'ready' && s.textContent.trim().length > 0,
    );

    // Aggregate warnings from all sources that have structure metadata
    const warnings: DocumentParsingWarning[] = [];
    for (const s of validSources) {
        if (s.structure?.warnings) {
            for (const w of s.structure.warnings) {
                warnings.push({ ...w, message: `[${s.label}] ${w.message}` });
            }
        }
    }

    if (validSources.length === 0) {
        return { sources, combinedSourceText: '', warnings };
    }

    // Single source → no header needed
    if (validSources.length === 1) {
        return {
            sources,
            combinedSourceText: validSources[0].textContent.trim(),
            warnings,
        };
    }

    const sections = validSources.map((s) => {
        const header = s.type === 'pasted_text'
            ? `--- SOURCE: Pasted Text ---`
            : `--- SOURCE: ${s.fileName ?? s.label} ---`;
        return `${header}\n${s.textContent.trim()}`;
    });

    return {
        sources,
        combinedSourceText: sections.join('\n\n').trim(),
        warnings,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return a short preview of text content, trimming to maxLength
 * and adding ellipsis if truncated.
 */
export function getSourcePreview(text: string, maxLength = 150): string {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= maxLength) return trimmed;
    return trimmed.slice(0, maxLength).trimEnd() + '…';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getFileExtension(name: string): string {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Return an appropriate icon name for a source type/extension.
 */
export function getSourceIconName(source: ProjectSourceItem): string {
    if (source.type === 'pasted_text') return 'clipboard';
    const ext = source.fileName ? getFileExtension(source.fileName) : '';
    switch (ext) {
        case '.pdf': return 'file-text';
        case '.docx': return 'file-text';
        case '.md': return 'file-code';
        case '.txt': return 'file';
        default: return 'file';
    }
}
