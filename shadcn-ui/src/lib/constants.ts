// Application constants

export const PRIORITY = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
} as const;

export const STATE = {
    PROPOSED: 'PROPOSED',
    SELECTED: 'SELECTED',
    SCHEDULED: 'SCHEDULED',
    DONE: 'DONE',
} as const;

export const LIST_STATUS = {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED',
} as const;

export type Priority = typeof PRIORITY[keyof typeof PRIORITY];
export type State = typeof STATE[keyof typeof STATE];
export type ListStatus = typeof LIST_STATUS[keyof typeof LIST_STATUS];

export const PRIORITY_VARIANTS = {
    [PRIORITY.HIGH]: 'destructive',
    [PRIORITY.MEDIUM]: 'default',
    [PRIORITY.LOW]: 'secondary',
} as const;

export const STATE_VARIANTS = {
    [STATE.PROPOSED]: 'outline',
    [STATE.SELECTED]: 'secondary',
    [STATE.SCHEDULED]: 'default',
    [STATE.DONE]: 'default',
} as const;

export const LIST_STATUS_VARIANTS = {
    [LIST_STATUS.DRAFT]: 'secondary',
    [LIST_STATUS.ACTIVE]: 'default',
    [LIST_STATUS.ARCHIVED]: 'outline',
} as const;

/** Canonical chart color palette — matches Tailwind palette */
export const CHART_COLORS = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
    '#a855f7', // purple-500
    '#f97316', // orange-500
] as const;

/** Status-specific chart colors */
export const STATUS_CHART_COLORS = {
    PROPOSED: '#3b82f6',
    APPROVED: '#10b981',
    ESTIMATED: '#8b5cf6',
    ARCHIVED: '#64748b',
    SELECTED: '#f59e0b',
    SCHEDULED: '#8b5cf6',
    DONE: '#10b981',
} as const;

/** Priority-specific chart colors */
export const PRIORITY_CHART_COLORS = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#10b981',
} as const;
