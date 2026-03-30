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
} from '@/types/project-sources';
import { MAX_FILE_SIZE_BYTES, ACCEPTED_EXTENSIONS } from '@/types/project-sources';

// ─────────────────────────────────────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────────────────────────────────────

let _counter = 0;
export function generateSourceId(): string {
    return `src_${Date.now()}_${++_counter}`;
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
        const textContent = await extractText(file, ext);

        if (!textContent.trim()) {
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
            textContent,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
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
// Text extraction by format
// ─────────────────────────────────────────────────────────────────────────────

async function extractText(file: File, ext: string): Promise<string> {
    switch (ext) {
        case '.txt':
        case '.md':
            return file.text();
        case '.pdf':
            return extractPdfText(file);
        case '.docx':
            return extractDocxText(file);
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }
}

async function extractPdfText(file: File): Promise<string> {
    const pdfjs = await import('pdfjs-dist');

    // Configure worker
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ');
        if (text.trim()) {
            pages.push(text.trim());
        }
    }

    return pages.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a combined source text from all ready sources.
 * Sources in error or with empty content are excluded.
 * Each source is separated by a readable header.
 */
export function buildProjectSourceBundle(sources: ProjectSourceItem[]): ProjectSourceBundle {
    const validSources = sources.filter(
        (s) => s.status === 'ready' && s.textContent.trim().length > 0,
    );

    if (validSources.length === 0) {
        return { sources, combinedSourceText: '' };
    }

    // Single source → no header needed
    if (validSources.length === 1) {
        return {
            sources,
            combinedSourceText: validSources[0].textContent.trim(),
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
