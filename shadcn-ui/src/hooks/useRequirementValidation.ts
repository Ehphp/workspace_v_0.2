/**
 * Hook: useRequirementValidation
 *
 * Manages the requirement validation gate state in the wizard.
 * Calls the dual-layer validation (heuristic + AI) and exposes
 * the result for UI feedback in WizardStep1.
 */

import { useState, useCallback } from 'react';
import { validateRequirementDescription } from '@/lib/requirement-validation-api';
import type { RequirementValidationResult } from '@/types/ai-validation';

interface UseRequirementValidationReturn {
    /** Trigger validation for a description */
    validate: (description: string) => Promise<RequirementValidationResult>;
    /** Latest validation result */
    validationResult: RequirementValidationResult | null;
    /** Whether validation is in progress */
    isValidating: boolean;
    /** Clear the validation result */
    resetValidation: () => void;
}

/**
 * High-confidence block threshold.
 * If isValid===false AND confidence >= this, the user is blocked.
 * Below this threshold, a warning is shown but the user can proceed.
 */
export const VALIDATION_BLOCK_THRESHOLD = 0.7;

export function useRequirementValidation(): UseRequirementValidationReturn {
    const [validationResult, setValidationResult] = useState<RequirementValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    const validate = useCallback(async (description: string): Promise<RequirementValidationResult> => {
        setIsValidating(true);
        try {
            const result = await validateRequirementDescription(description);
            setValidationResult(result);
            return result;
        } catch (err) {
            console.error('[useRequirementValidation] Unexpected error:', err);
            // Fail-open
            const fallback: RequirementValidationResult = {
                isValid: true,
                confidence: 0,
                reason: '',
                category: 'valid',
            };
            setValidationResult(fallback);
            return fallback;
        } finally {
            setIsValidating(false);
        }
    }, []);

    const resetValidation = useCallback(() => {
        setValidationResult(null);
    }, []);

    return {
        validate,
        validationResult,
        isValidating,
        resetValidation,
    };
}
