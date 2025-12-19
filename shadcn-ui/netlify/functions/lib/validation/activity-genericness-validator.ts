/**
 * Activity Genericness Validator
 * 
 * Validates that generated activities are generic and reusable,
 * not project-specific.
 */

export interface ValidationResult {
    isGeneric: boolean;
    score: number; // 0-100, higher = more generic
    issues: string[];
    suggestions: string[];
}

export interface ActivityToValidate {
    title: string;
    description: string;
}

/**
 * Forbidden terms that indicate project-specific content
 */
const FORBIDDEN_PATTERNS = {
    businessEntities: [
        // Italian
        /\b(dipendent[ei]|employee)\b/gi,
        /\b(utent[ei]|users?)\b/gi,
        /\b(client[ei]|customers?)\b/gi,
        /\b(prodott[oi]|products?)\b/gi,
        /\b(ordin[ei]|orders?)\b/gi,
        /\b(fattur[ae]|invoices?)\b/gi,
        /\b(dipartiment[oi]|departments?)\b/gi,
        /\b(progett[oi]|projects?)\b/gi,
        /\b(attivit[àa]|tasks?)\b/gi,
        /\b(contratt[oi]|contracts?)\b/gi,
        /\b(document[oi]|documents?)\b/gi,
    ],
    specificFeatures: [
        /\b(login|signin|sign-in)\b/gi,
        /\b(registra(tion|zione))\b/gi,
        /\b(checkout|payment|pagamento)\b/gi,
        /\b(onboarding)\b/gi,
        /\b(dashboard|homepage|profile)\b/gi,
        /\b(admin panel|pannello admin)\b/gi,
        /\b(settings|impostazioni)\b/gi,
    ],
    specificFields: [
        /\b(nome|cognome|firstname|lastname)\b/gi,
        /\b(email|e-mail|mail)\b/gi,
        /\b(telefono|phone|cellulare)\b/gi,
        /\b(indirizzo|address)\b/gi,
        /\b(prezzo|price|costo|cost)\b/gi,
        /\b(quantit[àa]|quantity|qty)\b/gi,
        /\b(data|date)\b/gi,
        /\b(codice|code|id)\b/gi,
        /\b(matricola|badge)\b/gi,
        /\b(reparto|department)\b/gi,
    ],
    specificEndpoints: [
        /\/auth\/(login|register|logout)/gi,
        /\/api\/(users|products|orders)/gi,
        /\/admin\//gi,
        /\/(checkout|payment|cart)/gi,
    ],
};

/**
 * Generic indicators that suggest reusable content
 */
const GENERIC_INDICATORS = [
    /\bcustom\b/i,
    /\bgeneric[oa]?\b/i,
    /\btemplate\b/i,
    /\briusabile\b/i,
    /\bpattern\b/i,
    /\bentit[àa] (custom|generica)/i,
    /\bcomponente (riusabile|generico)/i,
    /\bservizio (generico|custom)/i,
];

/**
 * Validate activity genericness
 */
export function validateActivityGenericness(activity: ActivityToValidate): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    const titleLower = activity.title.toLowerCase();
    const descLower = activity.description.toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    // 1. Check for forbidden business entities
    for (const pattern of FORBIDDEN_PATTERNS.businessEntities) {
        const matches = combined.match(pattern);
        if (matches) {
            issues.push(`Contains specific business entity: "${matches[0]}"`);
            suggestions.push('Replace with generic term (e.g., "entità custom", "master data")');
            score -= 30;
        }
    }

    // 2. Check for specific features
    for (const pattern of FORBIDDEN_PATTERNS.specificFeatures) {
        const matches = combined.match(pattern);
        if (matches) {
            issues.push(`Contains specific feature name: "${matches[0]}"`);
            suggestions.push('Replace with generic pattern (e.g., "form autenticazione", "interfaccia utente")');
            score -= 25;
        }
    }

    // 3. Check for specific fields
    for (const pattern of FORBIDDEN_PATTERNS.specificFields) {
        const matches = titleLower.match(pattern); // Only in title, as description might explain
        if (matches) {
            issues.push(`Title contains specific field: "${matches[0]}"`);
            suggestions.push('Replace with "campi custom" or "campi standard"');
            score -= 20;
        }
    }

    // 4. Check for specific endpoints
    for (const pattern of FORBIDDEN_PATTERNS.specificEndpoints) {
        const matches = combined.match(pattern);
        if (matches) {
            issues.push(`Contains specific endpoint path: "${matches[0]}"`);
            suggestions.push('Replace with "endpoint REST" or "API endpoint"');
            score -= 20;
        }
    }

    // 5. Check title length (too long = likely too specific)
    if (activity.title.length > 80) {
        issues.push('Title too long (likely too specific)');
        suggestions.push('Shorten to essential technical pattern (40-70 chars)');
        score -= 10;
    }

    // 6. Check for multiple "and" conjunctions (sign of listing specifics)
    const andCount = (titleLower.match(/\b(e|and|con)\b/g) || []).length;
    if (andCount > 2) {
        issues.push('Title lists too many specific items');
        suggestions.push('Focus on one generic pattern per activity');
        score -= 15;
    }

    // 7. Check for generic indicators (bonus points)
    const hasGenericIndicator = GENERIC_INDICATORS.some(pattern => pattern.test(combined));
    if (hasGenericIndicator) {
        score = Math.min(100, score + 10); // Bonus for using generic terms
    } else if (score > 70) {
        suggestions.push('Consider adding generic qualifier (e.g., "custom", "riusabile", "generico")');
    }

    // 8. Check for parenthetical specifics in title
    const hasParenthetical = /\([^)]*(?:nome|email|employee|user|product)[^)]*\)/i.test(activity.title);
    if (hasParenthetical) {
        issues.push('Title contains specific examples in parentheses');
        suggestions.push('Remove specific examples from title, keep only generic pattern');
        score -= 20;
    }

    return {
        isGeneric: score >= 70, // Threshold: 70+ is considered generic enough
        score: Math.max(0, score),
        issues,
        suggestions,
    };
}

/**
 * Validate all activities in a preset
 */
export function validateActivities(activities: ActivityToValidate[]): {
    allGeneric: boolean;
    averageScore: number;
    results: Array<ValidationResult & { activity: ActivityToValidate }>;
    summary: {
        passed: number;
        failed: number;
        warnings: number;
    };
} {
    const results = activities.map(activity => ({
        activity,
        ...validateActivityGenericness(activity),
    }));

    const passed = results.filter(r => r.isGeneric).length;
    const failed = results.filter(r => !r.isGeneric).length;
    const warnings = results.filter(r => r.score >= 60 && r.score < 70).length;

    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    return {
        allGeneric: failed === 0,
        averageScore,
        results,
        summary: {
            passed,
            failed,
            warnings,
        },
    };
}

/**
 * Log validation results for monitoring
 */
export function logValidationResults(
    results: ReturnType<typeof validateActivities>,
    context: { requestId?: string; techCategory?: string }
): void {
    console.log('[activity-validation] Results:', {
        requestId: context.requestId,
        techCategory: context.techCategory,
        allGeneric: results.allGeneric,
        averageScore: results.averageScore.toFixed(1),
        summary: results.summary,
    });

    // Log failed activities for debugging
    results.results
        .filter(r => !r.isGeneric)
        .forEach((r, idx) => {
            console.warn(`[activity-validation] Failed #${idx + 1}:`, {
                title: r.activity.title.substring(0, 60),
                score: r.score,
                issuesCount: r.issues.length,
                issues: r.issues,
            });
        });
}
