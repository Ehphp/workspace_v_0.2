/**
 * Deterministic Rules for AI Activity Selection
 * 
 * These rules ensure consistent activity selection across all AI endpoints.
 * They reduce variance by providing explicit mapping rules based on keywords.
 * 
 * Used by:
 * - ai-suggest.ts (suggest-activities)
 * - ai-estimate-from-interview.ts
 * - ai-bulk-estimate-with-answers.ts
 */

/**
 * Keyword patterns that trigger specific activity categories.
 * When a requirement description contains these keywords, the corresponding
 * activity types should be included in the suggestion.
 */
export const ACTIVITY_TRIGGER_KEYWORDS: Record<string, string[]> = {
    // Flow/Automation activities
    FLOW: [
        'email', 'notifica', 'notification', 'invio', 'send',
        'flusso', 'flow', 'automatico', 'automatic', 'workflow',
        'trigger', 'scheduled', 'pianificato', 'reminder', 'promemoria',
        'approval', 'approvazione', 'escalation'
    ],

    // Form/UI activities
    FORM: [
        'form', 'schermata', 'screen', 'interfaccia', 'interface',
        'ui', 'ux', 'pagina', 'page', 'vista', 'view',
        'canvas', 'app', 'modulo', 'module', 'dashboard'
    ],

    // Data/Entity activities
    DATA: [
        'dati', 'data', 'campi', 'field', 'tabella', 'table',
        'entità', 'entity', 'colonna', 'column', 'record',
        'dataverse', 'database', 'db', 'schema', 'modello'
    ],

    // Integration activities
    INTEGRATION: [
        'api', 'rest', 'soap', 'integrazione', 'integration',
        'connettore', 'connector', 'endpoint', 'webhook',
        'sincronizzazione', 'sync', 'import', 'export',
        'esterno', 'external', 'terze parti', 'third party'
    ],

    // Testing activities
    TEST: [
        'test', 'testing', 'validazione', 'validation',
        'uat', 'collaudo', 'verifica', 'verify',
        'qa', 'quality', 'scenario', 'case'
    ],

    // Deployment activities
    DEPLOY: [
        'deploy', 'rilascio', 'release', 'ambiente', 'environment',
        'produzione', 'production', 'staging', 'dev',
        'pubblicazione', 'publish', 'go-live', 'migration'
    ],

    // Security activities
    SECURITY: [
        'sicurezza', 'security', 'autenticazione', 'authentication',
        'autorizzazione', 'authorization', 'permessi', 'permission',
        'ruolo', 'role', 'rls', 'row level', 'business unit'
    ],

    // Report activities
    REPORT: [
        'report', 'reporting', 'grafico', 'chart', 'graph',
        'analytics', 'analisi', 'kpi', 'metrica', 'metric',
        'power bi', 'dashboard', 'cruscotto'
    ]
};

/**
 * Keywords that indicate small (_SM) vs large (_LG) activity variants.
 * Used to select the appropriate effort level.
 */
export const SIZE_VARIANT_KEYWORDS = {
    SMALL: [
        'semplice', 'simple', 'pochi', 'few', '1-2', '1', '2',
        'base', 'basic', 'minimo', 'minimum', 'piccolo', 'small',
        'standard', 'normale', 'normal', 'leggero', 'light'
    ],
    LARGE: [
        'complesso', 'complex', 'molti', 'many', '5+', '10+',
        'avanzato', 'advanced', 'multipli', 'multiple',
        'esteso', 'extended', 'pesante', 'heavy', 'grande', 'large',
        'enterprise', 'scalabile', 'scalable'
    ]
};

/**
 * Confidence score thresholds based on response completeness.
 * Returns a deterministic score to reduce AI variance.
 */
export const CONFIDENCE_THRESHOLDS = {
    COMPLETE: 0.90,    // All questions answered clearly
    HIGH: 0.80,        // 80%+ questions answered clearly
    MEDIUM: 0.70,      // 60-80% questions answered clearly
    LOW: 0.60,         // Less than 60% answered clearly
};

/**
 * Check if a text contains any of the trigger keywords for an activity category.
 */
export function matchesActivityCategory(text: string, category: keyof typeof ACTIVITY_TRIGGER_KEYWORDS): boolean {
    const normalizedText = text.toLowerCase();
    const keywords = ACTIVITY_TRIGGER_KEYWORDS[category];
    return keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()));
}

/**
 * Get all activity categories that should be included based on the description.
 */
export function getTriggeredCategories(description: string): string[] {
    const categories: string[] = [];
    for (const [category, keywords] of Object.entries(ACTIVITY_TRIGGER_KEYWORDS)) {
        if (matchesActivityCategory(description, category as keyof typeof ACTIVITY_TRIGGER_KEYWORDS)) {
            categories.push(category);
        }
    }
    return categories;
}

/**
 * Determine size variant (_SM, _LG, or base) from answer text.
 */
export function determineSizeVariant(answerText: string): 'SM' | 'LG' | 'BASE' {
    const normalizedText = answerText.toLowerCase();

    // Check for small indicators
    if (SIZE_VARIANT_KEYWORDS.SMALL.some(kw => normalizedText.includes(kw.toLowerCase()))) {
        return 'SM';
    }

    // Check for large indicators
    if (SIZE_VARIANT_KEYWORDS.LARGE.some(kw => normalizedText.includes(kw.toLowerCase()))) {
        return 'LG';
    }

    // Default to base variant
    return 'BASE';
}

/**
 * Select the appropriate activity code with size variant.
 * Example: PP_DV_FORM + SM -> PP_DV_FORM_SM (if exists)
 */
export function selectActivityWithVariant(
    baseCode: string,
    variant: 'SM' | 'LG' | 'BASE',
    availableCodes: string[]
): string {
    if (variant === 'BASE') {
        return baseCode;
    }

    const variantCode = `${baseCode}_${variant}`;

    // Return variant if it exists, otherwise return base
    return availableCodes.includes(variantCode) ? variantCode : baseCode;
}

/**
 * Calculate confidence score based on answered questions percentage.
 */
export function calculateConfidenceScore(
    totalQuestions: number,
    answeredQuestions: number,
    clearAnswers: number
): number {
    if (totalQuestions === 0) return CONFIDENCE_THRESHOLDS.MEDIUM;

    const answerRate = answeredQuestions / totalQuestions;
    const clarityRate = answeredQuestions > 0 ? clearAnswers / answeredQuestions : 0;

    // Combined score based on both completion and clarity
    const combinedRate = (answerRate + clarityRate) / 2;

    if (combinedRate >= 0.9) return CONFIDENCE_THRESHOLDS.COMPLETE;
    if (combinedRate >= 0.8) return CONFIDENCE_THRESHOLDS.HIGH;
    if (combinedRate >= 0.6) return CONFIDENCE_THRESHOLDS.MEDIUM;
    return CONFIDENCE_THRESHOLDS.LOW;
}

/**
 * Rules for prompt injection - to be included in AI system prompts.
 * This provides GPT with explicit, deterministic rules.
 */
export const DETERMINISTIC_RULES_PROMPT = `
⚠️ REGOLE DETERMINISTICHE PER RIDURRE VARIANZA ⚠️

SELEZIONE ATTIVITÀ OBBLIGATORIE (se il requisito le richiede):
1. Se menziona "email", "notifica", "invio", "flusso automatico" → INCLUDI attività FLOW
2. Se menziona "form", "schermata", "interfaccia", "UI" → INCLUDI attività FORM
3. Se menziona "dati", "campi", "tabella", "entità" → INCLUDI attività DATA/FIELD
4. Se menziona "API", "integrazione", "connettore" → INCLUDI attività INTEGRATION
5. Se menziona "test", "validazione", "UAT" → INCLUDI attività TEST
6. Se menziona "deploy", "rilascio", "ambiente" → INCLUDI attività DEPLOY
7. Se menziona "sicurezza", "permessi", "ruoli" → INCLUDI attività SECURITY
8. Se menziona "report", "grafico", "analytics" → INCLUDI attività REPORT

SCELTA VARIANTE _SM vs _LG (BASATA SULLE RISPOSTE, NON SUL TUO GIUDIZIO):
- Se la risposta indica "semplice", "pochi", "1-2", "base", "minimo" → USA variante _SM
- Se la risposta indica "complesso", "molti", "5+", "avanzato", "multipli" → USA variante _LG  
- Se la risposta è neutra o assente → USA la variante BASE (senza suffisso)

REGOLE DI COERENZA:
- Per lo STESSO tipo di requisito con le STESSE risposte, seleziona SEMPRE le stesse attività
- NON aggiungere attività "per sicurezza" - includi SOLO quelle giustificate
- Se non sei sicuro, usa la variante BASE (senza _SM/_LG)

CONFIDENCE SCORE (DETERMINISTICO):
- 0.90: Tutte le domande hanno risposta chiara e coerente
- 0.80: 80%+ domande con risposta chiara
- 0.70: 60-80% domande con risposta chiara
- 0.60: Meno del 60% domande con risposta chiara
`;

/**
 * Compact version of rules for bulk prompts (token-optimized).
 */
export const DETERMINISTIC_RULES_COMPACT = `
REGOLE:
- email/notifica→FLOW, form/UI→FORM, dati/tabella→DATA, API→INTEGRATION, test→TEST, deploy→DEPLOY
- "semplice/pochi/1-2"→_SM, "complesso/molti/5+"→_LG, neutro→BASE
- Confidence: 0.90(completo), 0.80(80%+), 0.70(60-80%), 0.60(<60%)
`;
