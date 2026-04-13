/**
 * Input sanitization utilities for AI prompts
 * 
 * Local copy for Netlify functions to avoid cross-boundary imports
 * that can cause esbuild issues.
 */

/**
 * Sanitizza input per prevenire injection attacks
 * 
 * @param text - Input text to sanitize
 * @returns Sanitized text safe for AI prompts
 */
export function sanitizePromptInput(text: string): string {
    return text
        .replace(/[<>]/g, '')           // Remove HTML-like tags
        .replace(/[{}]/g, '')            // Remove JSON delimiters
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
        .slice(0, 5000)                  // Limit length
        .trim();
}

/**
 * Sanitize document ingestion input.
 *
 * Same escaping as sanitizePromptInput but with a configurable length limit.
 * Default 20 000 preserves behavior for all existing callers.
 * Pass a higher maxLength for flows that support long documents (e.g. chunked SDD).
 */
export function sanitizeDocumentInput(text: string, maxLength = 20000): string {
    return text
        .replace(/[<>]/g, '')
        .replace(/[{}]/g, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .slice(0, maxLength)
        .trim();
}
