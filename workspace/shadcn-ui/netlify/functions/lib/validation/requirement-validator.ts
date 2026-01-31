import { sanitizePromptInput } from '../../../../src/types/ai-validation';

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Lightweight, deterministic validation to avoid pointless AI calls
 * @param description - Requirement description to validate
 * @returns Validation result with reason if invalid
 */
export function validateRequirementDescription(description: string): ValidationResult {
    const normalized = description.trim();

    if (!normalized) {
        return { isValid: false, reason: 'Description is empty' };
    }

    if (normalized.length < 6) {
        return { isValid: false, reason: 'Description is too short to evaluate' };
    }

    if (!/[a-zA-Z\u00C0-\u017F]/.test(normalized)) {
        return { isValid: false, reason: 'Description must contain alphabetic characters' };
    }

    const testInputPatterns = /^(test|aaa+|bbb+|ccc+|qwerty|asdf|lorem ipsum|123+|\d+)$/i;
    if (testInputPatterns.test(normalized)) {
        return { isValid: false, reason: 'Description looks like placeholder or test input' };
    }

    // REMOVED: Verb check was too restrictive. AI will validate if requirement is actionable.

    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    if (words.length < 3) {
        return { isValid: false, reason: 'Description is too short or ambiguous' };
    }

    const hasTechnicalTarget = /(api|endpoint|service|servizio|microservice|database|db|table|tabella|campo|column|form|pagina|screen|ui|ux|workflow|processo|process|configurazione|report|dashboard|notifica|email|auth|login|registrazione|utente|profilo|integrazione|deploy|pipeline|script|query|data|model|schema|cache|log|monitor|cron|job|batch|trigger|webhook|storage|bucket|file|documento|pdf|excel|csv|import|export|frontend|front-end|backend|back-end|api-gateway|serverless|lambda|function|cloud)/i.test(normalized);
    // If no technical target found, still accept if there are at least 3 words (let AI decide if it's actionable)
    if (!hasTechnicalTarget) {
        if (words.length >= 3) {
            console.warn('Warning: No technical target detected, but accepting for flexibility.');
            return { isValid: true };
        }
        return { isValid: false, reason: 'Missing technical target (API, form, table, workflow, etc.)' };
    }

    if (/[?]{2,}$/.test(normalized)) {
        return { isValid: false, reason: 'Description contains too many question marks' };
    }
    // REMOVED: check for single '?' at end. We now allow it and let AI decide.

    return { isValid: true };
}

/**
 * Sanitize and validate requirement description
 * @param description - Raw requirement description
 * @returns Sanitized description and validation result
 */
export function sanitizeAndValidate(description: string): {
    sanitized: string;
    validation: ValidationResult;
} {
    const sanitized = sanitizePromptInput(description);
    const validation = validateRequirementDescription(sanitized);
    return { sanitized, validation };
}
