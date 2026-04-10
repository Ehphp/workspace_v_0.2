/**
 * Multi-source ingestion types for "Create Project from Sources" flow.
 *
 * Supports collecting documentation from multiple sources (pasted text, files)
 * and bundling them into a single combined text for AI analysis.
 * Extensible to future source types (url, web_search_result).
 */

// ============================================================================
// Source Types
// ============================================================================

export type ProjectSourceType =
    | 'pasted_text'
    | 'file';

// ============================================================================
// Document Structure (metadata from structured parsing)
// ============================================================================

export type DocumentWarningCode =
    | 'content_truncated'
    | 'images_detected';

export interface DocumentParsingWarning {
    code: DocumentWarningCode;
    message: string;
}

export interface DocumentSectionMeta {
    level: number;      // 1-6 for headings
    title: string;
    pageNumber?: number;
}

export interface DocumentStructure {
    pageCount?: number;
    sections: DocumentSectionMeta[];
    detectedImageCount: number;
    warnings: DocumentParsingWarning[];
}

// ============================================================================
// Parsed Document Model (structured client-side representation)
// ============================================================================

export interface BlockProvenance {
    pageNumber?: number;
    sourceId?: string;
}

export interface HeadingBlock {
    type: 'heading';
    level: 1 | 2 | 3 | 4 | 5 | 6;
    text: string;
    provenance?: BlockProvenance;
}

export interface ParagraphBlock {
    type: 'paragraph';
    text: string;
    provenance?: BlockProvenance;
}

export interface TableBlock {
    type: 'table';
    rows: string[][];
    provenance?: BlockProvenance;
}

export interface PageBreakBlock {
    type: 'page-break';
    pageNumber: number;
}

export interface ListBlock {
    type: 'list';
    ordered: boolean;
    items: string[];
    provenance?: BlockProvenance;
}

export interface ImagePlaceholderBlock {
    type: 'image-placeholder';
    alt?: string;
    provenance?: BlockProvenance;
}

export type DocumentBlock =
    | HeadingBlock
    | ParagraphBlock
    | TableBlock
    | PageBreakBlock
    | ListBlock
    | ImagePlaceholderBlock;

export type DocumentFormat = 'pdf' | 'docx' | 'txt' | 'md';

export interface ParsedDocument {
    format: DocumentFormat;
    blocks: DocumentBlock[];
    metadata: {
        pageCount?: number;
        detectedImageCount: number;
        warnings: DocumentParsingWarning[];
    };
}

// ============================================================================
// Source Item
// ============================================================================

export interface ProjectSourceItem {
    id: string;
    type: ProjectSourceType;
    label: string;
    status: 'ready' | 'processing' | 'error';
    textContent: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    errorMessage?: string;
    /** Metadata from structured parsing (PDF/DOCX). Informational only. */
    structure?: DocumentStructure;
    /** Structured block-level representation. Source of truth for document content. */
    parsedDocument?: ParsedDocument;
}

// ============================================================================
// Source Bundle
// ============================================================================

export interface ProjectSourceBundle {
    sources: ProjectSourceItem[];
    combinedSourceText: string;
    /** Aggregated warnings from all parsed sources */
    warnings: DocumentParsingWarning[];
}

// ============================================================================
// Accepted File Config
// ============================================================================

export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx'];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
