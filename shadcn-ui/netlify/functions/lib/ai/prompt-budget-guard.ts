/**
 * Prompt Budget Guard
 *
 * Trims SDD or context blocks to fit within the prompt budget
 * for Pass 2 and Pass 3. Applied AFTER consolidation, BEFORE
 * the LLM call, so the pipeline always stays within context limits.
 */

/** Max size of serialized SDD fed into Pass 2 prompt (bytes) */
export const PASS2_SDD_BUDGET = 25_000;

/** Max size of context block fed into Pass 3 prompt (bytes) */
export const PASS3_CONTEXT_BUDGET = 8_000;

/**
 * Trim a serialized SDD string to fit within the given budget.
 *
 * Strategy: tries JSON-intact truncation first (removing trailing
 * array items from the longest arrays), then falls back to
 * hard-cut + closing bracket.
 */
export function trimSDDForBudget(
    sddJson: string,
    budget: number = PASS2_SDD_BUDGET,
): string {
    if (sddJson.length <= budget) return sddJson;

    // Try to trim by reducing array fields on the parsed object
    try {
        const obj = JSON.parse(sddJson);
        const arrayFields = [
            'keyPassages',
            'functionalAreas',
            'businessEntities',
            'externalSystems',
            'technicalConstraints',
            'nonFunctionalRequirements',
            'ambiguities',
        ];

        // Iteratively trim the largest array until under budget
        for (let attempt = 0; attempt < 20; attempt++) {
            const current = JSON.stringify(obj, null, 2);
            if (current.length <= budget) return current;

            // Find the longest array field
            let maxLen = 0;
            let maxField = '';
            for (const field of arrayFields) {
                if (Array.isArray(obj[field]) && obj[field].length > maxLen) {
                    maxLen = obj[field].length;
                    maxField = field;
                }
            }

            if (maxLen <= 1) break; // Can't trim further
            obj[maxField] = obj[maxField].slice(0, Math.ceil(maxLen * 0.7));
        }

        const result = JSON.stringify(obj, null, 2);
        if (result.length <= budget) return result;
    } catch {
        // Parse failed: fall through to hard cut
    }

    // Hard cut: slice + truncation marker
    console.warn(`[prompt-budget] Hard-cutting SDD from ${sddJson.length} to ${budget} chars`);
    return sddJson.slice(0, budget - 50) + '\n... [SDD troncato per limiti di contesto] }';
}

/**
 * Trim a text context block to fit within the given budget.
 *
 * Strategy: Keep the first `budget` characters and append a
 * truncation marker.
 */
export function trimContextForBudget(
    contextBlock: string,
    budget: number = PASS3_CONTEXT_BUDGET,
): string {
    if (contextBlock.length <= budget) return contextBlock;

    console.warn(`[prompt-budget] Trimming context from ${contextBlock.length} to ${budget} chars`);
    return contextBlock.slice(0, budget - 40) + '\n[... contesto troncato ...]';
}
