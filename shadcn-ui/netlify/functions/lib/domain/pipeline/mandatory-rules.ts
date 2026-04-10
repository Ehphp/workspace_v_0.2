/**
 * Mandatory Keyword Rules — Deterministic activity inclusion based on description/answer keywords
 *
 * Extracted from the LLM SYSTEM_PROMPT rules:
 *
 *   1. "email", "notifica", "invio", "flusso automatico" → FLOW activities
 *   2. "form", "schermata", "interfaccia", "UI" → FORM activities
 *   3. "dati", "campi", "tabella", "entità" → FIELD/DATA activities
 *   4. "test", "validazione", "UAT" → TEST activities
 *   5. "deploy", "rilascio", "ambiente" → DEPLOY activities
 *
 * Rules are tech-specific: a POWER_PLATFORM project resolves to PP_* prefixes,
 * a BACKEND project to BE_* prefixes, etc.
 *
 * @module mandatory-rules
 */

import type { Activity } from '../../activities';
import type { MandatoryKeywordRule, MandatoryInclusion, InterviewAnswerLike } from './decision-engine.types';

// ─────────────────────────────────────────────────────────────────────────────
// Default Rules (per tech category)
// ─────────────────────────────────────────────────────────────────────────────

const RULES_POWER_PLATFORM: MandatoryKeywordRule[] = [
    {
        keywords: ['email', 'notifica', 'invio', 'flusso automatico', 'mail', 'workflow'],
        activityPrefix: 'PP_FLOW',
        source: 'both',
    },
    {
        keywords: ['form', 'schermata', 'interfaccia', 'ui', 'maschera', 'vista'],
        activityPrefix: 'PP_DV_FORM',
        source: 'both',
    },
    {
        keywords: ['dati', 'campi', 'tabella', 'entità', 'campo', 'colonna', 'entity', 'dataverse'],
        activityPrefix: 'PP_DV_FIELD',
        source: 'both',
    },
    {
        keywords: ['test', 'validazione', 'uat', 'collaudo', 'verifica funzionale'],
        activityPrefix: 'PP_E2E_TEST',
        source: 'both',
    },
    {
        keywords: ['deploy', 'rilascio', 'ambiente', 'pubblicazione', 'go-live', 'produzione'],
        activityPrefix: 'PP_DEPLOY',
        source: 'both',
    },
];

const RULES_BACKEND: MandatoryKeywordRule[] = [
    {
        keywords: ['email', 'notifica', 'invio', 'flusso automatico', 'mail', 'workflow'],
        activityPrefix: 'BE_API',
        source: 'both',
    },
    {
        keywords: ['form', 'schermata', 'interfaccia', 'ui', 'endpoint', 'rest', 'api'],
        activityPrefix: 'BE_API',
        source: 'both',
    },
    {
        keywords: ['dati', 'campi', 'tabella', 'entità', 'campo', 'database', 'schema', 'migrazione'],
        activityPrefix: 'BE_DB',
        source: 'both',
    },
    {
        keywords: ['test', 'validazione', 'uat', 'collaudo', 'integration test'],
        activityPrefix: 'BE_INT_TEST',
        source: 'both',
    },
    {
        keywords: ['deploy', 'rilascio', 'ambiente', 'pubblicazione', 'go-live', 'ci/cd', 'pipeline'],
        activityPrefix: 'BE_DEPLOY',
        source: 'both',
    },
];

const RULES_FRONTEND: MandatoryKeywordRule[] = [
    {
        keywords: ['form', 'schermata', 'interfaccia', 'ui', 'maschera', 'input'],
        activityPrefix: 'FE_FORM',
        source: 'both',
    },
    {
        keywords: ['componente', 'widget', 'elemento', 'bottone', 'card', 'component'],
        activityPrefix: 'FE_UI_COMPONENT',
        source: 'both',
    },
    {
        keywords: ['api', 'fetch', 'chiamata', 'integrazione', 'rest', 'backend'],
        activityPrefix: 'FE_API_INTEGRATION',
        source: 'both',
    },
];

/**
 * Get default mandatory rules for a given tech category.
 */
export function getDefaultRules(techCategory: string): MandatoryKeywordRule[] {
    switch (techCategory.toUpperCase()) {
        case 'POWER_PLATFORM':
            return RULES_POWER_PLATFORM;
        case 'BACKEND':
            return RULES_BACKEND;
        case 'FRONTEND':
            return RULES_FRONTEND;
        case 'MULTI':
            // MULTI uses combined rules (PP + BE + FE)
            return [...RULES_POWER_PLATFORM, ...RULES_BACKEND, ...RULES_FRONTEND];
        default:
            return RULES_POWER_PLATFORM; // fallback
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan description and/or answers for mandatory keywords.
 * For each triggered rule, find the best matching activity in the catalog.
 * Pure function, no IO.
 */
export function evaluateMandatoryRules(
    description: string,
    answers: Record<string, InterviewAnswerLike>,
    rules: MandatoryKeywordRule[],
    catalog: Activity[],
): MandatoryInclusion[] {
    const inclusions: MandatoryInclusion[] = [];
    const alreadyIncludedPrefixes = new Set<string>();

    const descLower = description.toLowerCase();
    const answerTexts = collectAnswerTexts(answers);

    for (const rule of rules) {
        // Skip if we already triggered a rule with the same prefix
        if (alreadyIncludedPrefixes.has(rule.activityPrefix)) continue;

        const matchedKeyword = findKeywordMatch(rule, descLower, answerTexts);
        if (!matchedKeyword) continue;

        // Find the best matching activity in catalog
        const matchingActivity = findBestActivity(rule.activityPrefix, catalog);
        if (!matchingActivity) continue;

        inclusions.push({
            code: matchingActivity.code,
            rule: `${rule.activityPrefix} ← [${rule.keywords.join(', ')}]`,
            matchedKeyword,
        });

        alreadyIncludedPrefixes.add(rule.activityPrefix);
    }

    return inclusions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectAnswerTexts(answers: Record<string, InterviewAnswerLike>): string[] {
    const texts: string[] = [];
    for (const answer of Object.values(answers)) {
        if (typeof answer.value === 'string') {
            texts.push(answer.value.toLowerCase());
        } else if (Array.isArray(answer.value)) {
            for (const v of answer.value) {
                texts.push(String(v).toLowerCase());
            }
        }
    }
    return texts;
}

function findKeywordMatch(
    rule: MandatoryKeywordRule,
    descLower: string,
    answerTexts: string[],
): string | null {
    for (const kw of rule.keywords) {
        const kwLower = kw.toLowerCase();
        if (rule.source === 'description' || rule.source === 'both') {
            if (descLower.includes(kwLower)) return kw;
        }
        if (rule.source === 'answers' || rule.source === 'both') {
            for (const text of answerTexts) {
                if (text.includes(kwLower)) return kw;
            }
        }
    }
    return null;
}

/**
 * Find the best activity matching a prefix.
 */
function findBestActivity(prefix: string, catalog: Activity[]): Activity | null {
    const candidates = catalog.filter(a => a.code.startsWith(prefix));
    if (candidates.length === 0) return null;

    // Prefer exact prefix match
    const exact = candidates.find(a => a.code === prefix);
    if (exact) return exact;

    // Fallback to first match
    return candidates[0];
}
