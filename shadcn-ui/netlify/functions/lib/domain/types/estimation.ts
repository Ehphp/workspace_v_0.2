/**
 * Domain estimation types — the canonical source of truth.
 *
 * These types define the contract for the pure estimation engine.
 * They live in the domain layer so backend code never imports from src/.
 *
 * Frontend consumers should import from '@/types/estimation',
 * which re-exports everything from here.
 */

// ─── Project Context (canonical domain enums) ───────────────────

export type ProjectType =
    | 'NEW_DEVELOPMENT'
    | 'MAINTENANCE'
    | 'MIGRATION'
    | 'INTEGRATION'
    | 'REFACTORING';

export type ProjectScope =
    | 'SMALL'
    | 'MEDIUM'
    | 'LARGE'
    | 'ENTERPRISE';

export type DeadlinePressure =
    | 'RELAXED'
    | 'NORMAL'
    | 'TIGHT'
    | 'CRITICAL';

export type Methodology =
    | 'AGILE'
    | 'WATERFALL'
    | 'HYBRID';

export interface EstimationProjectContext {
    name?: string;
    description?: string;
    owner?: string;
    projectType?: ProjectType | null;
    domain?: string | null;
    scope?: ProjectScope | null;
    teamSize?: number | null;
    deadlinePressure?: DeadlinePressure | null;
    methodology?: Methodology | null;
}

/**
 * Unified context for deterministic estimation decisions.
 * Wraps technology info + project context for the rules engine.
 */
export interface EstimationContext {
    technologyId?: string | null;
    techCategory?: string | null;
    project?: EstimationProjectContext | null;
}

// ─── Core estimation types ──────────────────────────────────────

export interface SelectedActivity {
    code: string;
    baseHours: number;
    isAiSuggested: boolean;
}

export interface SelectedDriver {
    code: string;
    value: string;
    multiplier: number;
}

export interface SelectedRisk {
    code: string;
    weight: number;
}

export interface EstimationInput {
    activities: SelectedActivity[];
    drivers: SelectedDriver[];
    risks: SelectedRisk[];
}

export interface EstimationResult {
    baseDays: number;
    driverMultiplier: number;
    subtotal: number;
    riskScore: number;
    contingencyPercent: number;
    contingencyDays: number;
    totalDays: number;
    breakdown: {
        byGroup: Record<string, number>;
        byTech: Record<string, number>;
    };
}
