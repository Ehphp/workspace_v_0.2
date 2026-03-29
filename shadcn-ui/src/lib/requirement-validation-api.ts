/**
 * API Client for Requirement Validation Gate
 *
 * Frontend wrapper for the ai-validate-requirement Netlify function.
 * Includes client-side heuristic pre-check (Layer 1) to avoid
 * unnecessary API calls for obviously invalid input.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput, heuristicRequirementCheck } from '@/types/ai-validation';
import type { RequirementValidationResult } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';

export type { RequirementValidationResult } from '@/types/ai-validation';

/**
 * Validate whether a description is a legitimate software requirement.
 *
 * Layer 1: Client-side heuristic (free, instant) — catches empty, too short, all-same-word
 * Layer 2: AI lightweight validation (~100 tokens, ~200-400ms) — semantic classification
 *
 * @param description - Raw requirement description
 * @returns Validation result with category, confidence, reason
 */
export async function validateRequirementDescription(
    description: string
): Promise<RequirementValidationResult> {
    // Layer 1: Client-side heuristic pre-check
    const sanitized = sanitizePromptInput(description);
    const heuristicResult = heuristicRequirementCheck(sanitized);
    if (heuristicResult) {
        return heuristicResult;
    }

    // Layer 2: AI validation via backend
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    try {
        const response = await fetch(buildFunctionUrl('ai-validate-requirement'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({ description: sanitized }),
        });

        if (!response.ok) {
            // Fail-open: if the validation service is down, let the user proceed
            console.warn(`[requirement-validation-api] HTTP ${response.status} — fail-open`);
            return {
                isValid: true,
                confidence: 0,
                reason: '',
                category: 'valid',
            };
        }

        const data = await response.json();

        if (data.success && data.validation) {
            return data.validation as RequirementValidationResult;
        }

        // Unexpected shape — fail-open
        console.warn('[requirement-validation-api] Unexpected response shape — fail-open');
        return {
            isValid: true,
            confidence: 0,
            reason: '',
            category: 'valid',
        };
    } catch (err) {
        // Network error — fail-open
        console.warn('[requirement-validation-api] Network error — fail-open', err);
        return {
            isValid: true,
            confidence: 0,
            reason: '',
            category: 'valid',
        };
    }
}
