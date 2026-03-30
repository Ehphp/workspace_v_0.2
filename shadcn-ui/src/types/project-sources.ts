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
}

// ============================================================================
// Source Bundle
// ============================================================================

export interface ProjectSourceBundle {
    sources: ProjectSourceItem[];
    combinedSourceText: string;
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
