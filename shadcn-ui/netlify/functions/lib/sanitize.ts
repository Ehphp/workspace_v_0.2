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
