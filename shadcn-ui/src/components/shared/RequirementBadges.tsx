import { StatusBadge, PRIORITY_STYLES, STATE_STYLES } from './StatusBadge';

interface PriorityBadgeProps {
    priority: string;
}

interface StateBadgeProps {
    state: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
    return <StatusBadge type="priority" value={priority} />;
}

export function StateBadge({ state }: StateBadgeProps) {
    return <StatusBadge type="state" value={state} />;
}

// Backward compat re-exports
export const PRIORITY_CONFIGS = PRIORITY_STYLES;
export const STATE_CONFIGS = STATE_STYLES;
