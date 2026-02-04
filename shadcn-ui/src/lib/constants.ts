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
