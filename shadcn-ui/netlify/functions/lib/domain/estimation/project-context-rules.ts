/**
 * project-context-rules.ts — Deterministic project-context rules engine
 *
 * Pure functions that translate EstimationContext into concrete biases,
 * suggested drivers/risks, and traceability notes.
 *
 * NO side effects. NO database calls. NO AI. Fully testable.
 *
 * Rules are additive: if context is absent or null, the result is neutral
 * (empty biases, no suggestions, no notes) — backward compatible.
 */

import type {
    EstimationContext,
    EstimationProjectContext,
    ProjectType,
    ProjectScope,
    DeadlinePressure,
    Methodology,
} from '../types/estimation';

// ─── Output types ───────────────────────────────────────────────

export interface ProjectContextRuleSuggestion<T = string> {
    code: T;
    reason: string;
    source: 'project_context_rule';
    rule: string;
}

export interface ActivityBiases {
    /** Activity group names to boost in ranking */
    boostGroups?: string[];
    /** Keywords to boost activity relevance scoring */
    boostKeywords?: string[];
}

export interface ProjectContextRuleResult {
    activityBiases: ActivityBiases;
    suggestedDrivers: ProjectContextRuleSuggestion[];
    suggestedRisks: ProjectContextRuleSuggestion[];
    notes: string[];
}

// ─── Main entry point ───────────────────────────────────────────

/**
 * Evaluate all project-context rules and return a unified result.
 *
 * If context is missing/null, returns a neutral (empty) result.
 */
export function evaluateProjectContextRules(
    context?: EstimationContext | null,
): ProjectContextRuleResult {
    const result: ProjectContextRuleResult = {
        activityBiases: {},
        suggestedDrivers: [],
        suggestedRisks: [],
        notes: [],
    };

    if (!context?.project) return result;

    const p = context.project;

    applyScopeRules(p, result);
    applyDeadlinePressureRules(p, result);
    applyTeamSizeRules(p, result);
    applyProjectTypeRules(p, result);
    applyMethodologyRules(p, result);
    applyDomainRules(p, result);

    return result;
}

// ─── Scope rules ────────────────────────────────────────────────

function applyScopeRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (!p.scope) return;

    if (p.scope === 'LARGE' || p.scope === 'ENTERPRISE') {
        r.activityBiases.boostGroups = [...(r.activityBiases.boostGroups ?? []), 'ANALYSIS'];
        r.notes.push(
            `[scope_large] Scope is ${p.scope} — boosting analysis activities and extended estimation.`,
        );
    }

    if (p.scope === 'SMALL') {
        r.notes.push(
            '[scope_small] Scope is SMALL — lean estimation applied.',
        );
    }
}

// ─── Deadline pressure rules ────────────────────────────────────

function applyDeadlinePressureRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (!p.deadlinePressure) return;

    if (p.deadlinePressure === 'CRITICAL') {
        r.suggestedDrivers.push({
            code: 'TIMELINE_PRESSURE',
            reason: 'Deadline pressure is CRITICAL — timeline constraints affect estimation.',
            source: 'project_context_rule',
            rule: 'deadline_critical_driver',
        });
        r.suggestedRisks.push({
            code: 'TIMELINE_RISK',
            reason: 'Critical deadline increases risk of delays and quality trade-offs.',
            source: 'project_context_rule',
            rule: 'deadline_critical_risk',
        });
        r.notes.push(
            '[deadline_critical] Deadline pressure is CRITICAL — suggested timeline driver and risk.',
        );
    }

    if (p.deadlinePressure === 'TIGHT') {
        r.suggestedRisks.push({
            code: 'TIMELINE_RISK',
            reason: 'Tight deadline increases risk of scheduling pressure.',
            source: 'project_context_rule',
            rule: 'deadline_tight_risk',
        });
        r.notes.push(
            '[deadline_tight] Deadline pressure is TIGHT — suggested timeline risk.',
        );
    }
}

// ─── Team size rules ────────────────────────────────────────────

function applyTeamSizeRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (p.teamSize == null) return;

    if (p.teamSize === 1) {
        r.suggestedRisks.push({
            code: 'SINGLE_RESOURCE_RISK',
            reason: 'Single-person team: key-person dependency (SPOF) risk.',
            source: 'project_context_rule',
            rule: 'team_single_spof',
        });
        r.notes.push(
            '[team_single] Team size is 1 — suggested SPOF risk.',
        );
    }

    if (p.teamSize >= 8) {
        r.suggestedDrivers.push({
            code: 'TEAM_COORDINATION',
            reason: `Team of ${p.teamSize} people — coordination overhead likely increases effort.`,
            source: 'project_context_rule',
            rule: 'team_large_coordination',
        });
        r.notes.push(
            `[team_large] Team size is ${p.teamSize} — coordination overhead expected, suggested driver.`,
        );
    }
}

// ─── Project type rules ─────────────────────────────────────────

const PROJECT_TYPE_KEYWORDS: Record<ProjectType, string[]> = {
    MIGRATION: [
        'migration', 'migrazione', 'validation', 'validazione',
        'regression', 'regressione', 'data', 'import', 'export',
        'conversion', 'conversione', 'legacy', 'cutover',
    ],
    INTEGRATION: [
        'api', 'interface', 'interfaccia', 'integration',
        'integrazione', 'connector', 'connettore', 'endpoint',
        'webhook', 'middleware', 'bus', 'gateway',
    ],
    MAINTENANCE: [
        'analysis', 'analisi', 'impact', 'impatto',
        'bugfix', 'fix', 'regression', 'regressione',
        'hotfix', 'patch', 'incident', 'diagnosi',
    ],
    REFACTORING: [
        'analysis', 'analisi', 'cleanup', 'pulizia',
        'regression', 'regressione', 'testing', 'test',
        'refactor', 'ristrutturazione', 'debt', 'debito',
    ],
    NEW_DEVELOPMENT: [],
};

const PROJECT_TYPE_GROUPS: Record<ProjectType, string[]> = {
    MIGRATION: ['MIGRATION', 'DATA', 'VALIDATION', 'TESTING'],
    INTEGRATION: ['INTEGRATION', 'API', 'INTERFACE'],
    MAINTENANCE: ['ANALYSIS', 'BUGFIX', 'TESTING'],
    REFACTORING: ['ANALYSIS', 'TESTING', 'REFACTORING'],
    NEW_DEVELOPMENT: [],
};

function applyProjectTypeRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (!p.projectType) return;

    const keywords = PROJECT_TYPE_KEYWORDS[p.projectType];
    const groups = PROJECT_TYPE_GROUPS[p.projectType];

    if (keywords.length > 0) {
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            ...keywords,
        ];
    }
    if (groups.length > 0) {
        r.activityBiases.boostGroups = [
            ...(r.activityBiases.boostGroups ?? []),
            ...groups,
        ];
    }

    if (p.projectType === 'NEW_DEVELOPMENT') {
        r.notes.push(
            '[type_new_dev] Project type is NEW_DEVELOPMENT — neutral bias applied.',
        );
    } else {
        r.notes.push(
            `[type_${p.projectType.toLowerCase()}] Project type is ${p.projectType} — boosting related activity groups and keywords.`,
        );
    }
}

// ─── Methodology rules ──────────────────────────────────────────

const METHODOLOGY_KEYWORDS: Record<Methodology, string[]> = {
    WATERFALL: [
        'analysis', 'analisi', 'documentation', 'documentazione',
        'planning', 'pianificazione', 'design', 'progettazione',
    ],
    AGILE: [
        'iterative', 'iterativo', 'sprint', 'testing',
        'test', 'ci', 'continuous', 'delivery',
    ],
    HYBRID: [],
};

function applyMethodologyRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (!p.methodology) return;

    const keywords = METHODOLOGY_KEYWORDS[p.methodology];
    if (keywords.length > 0) {
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            ...keywords,
        ];
        r.notes.push(
            `[methodology_${p.methodology.toLowerCase()}] Methodology is ${p.methodology} — mild keyword bias applied.`,
        );
    } else {
        r.notes.push(
            `[methodology_${p.methodology.toLowerCase()}] Methodology is ${p.methodology} — neutral, no specific bias.`,
        );
    }
}

// ─── Domain rules ───────────────────────────────────────────────

function applyDomainRules(
    p: EstimationProjectContext,
    r: ProjectContextRuleResult,
): void {
    if (!p.domain) return;

    const normalized = p.domain.trim().toLowerCase();
    if (!normalized) return;

    // Extract meaningful domain keywords for activity boosting
    const domainTokens = normalized
        .split(/[^a-zA-ZÀ-ÿ0-9]+/)
        .filter((w) => w.length > 2);

    if (domainTokens.length > 0) {
        r.activityBiases.boostKeywords = [
            ...(r.activityBiases.boostKeywords ?? []),
            ...domainTokens,
        ];
    }

    r.notes.push(
        `[domain] Domain "${p.domain}" — added as boost keywords for activity matching.`,
    );
}
