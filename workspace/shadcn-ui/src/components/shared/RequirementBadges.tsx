import type React from 'react';

// Priority Badge Configurations
const PRIORITY_CONFIGS = {
    HIGH: {
        gradient: 'from-red-500 to-rose-500',
        bgGradient: 'from-red-50 to-rose-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200/50',
        leftBorder: 'border-l-red-500',
        icon: '🔴'
    },
    MEDIUM: {
        gradient: 'from-amber-500 to-orange-500',
        bgGradient: 'from-amber-50 to-orange-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200/50',
        leftBorder: 'border-l-amber-500',
        icon: '🟡'
    },
    LOW: {
        gradient: 'from-emerald-500 to-teal-500',
        bgGradient: 'from-emerald-50 to-teal-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200/50',
        leftBorder: 'border-l-emerald-500',
        icon: '🟢'
    },
} as const;

// State Badge Configurations (Standardized to 4 states)
const STATE_CONFIGS = {
    PROPOSED: {
        gradient: 'from-blue-500 to-indigo-500',
        bgGradient: 'from-blue-50 to-indigo-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200/50',
        icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
        )
    },
    SELECTED: {
        gradient: 'from-violet-500 to-purple-500',
        bgGradient: 'from-violet-50 to-purple-50',
        textColor: 'text-violet-700',
        borderColor: 'border-violet-200/50',
        icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        )
    },
    SCHEDULED: {
        gradient: 'from-orange-500 to-amber-500',
        bgGradient: 'from-orange-50 to-amber-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200/50',
        icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        )
    },
    DONE: {
        gradient: 'from-teal-500 to-cyan-500',
        bgGradient: 'from-teal-50 to-cyan-50',
        textColor: 'text-teal-700',
        borderColor: 'border-teal-200/50',
        icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    },
} as const;

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
type State = keyof typeof STATE_CONFIGS;

interface PriorityBadgeProps {
    priority: string;
}

interface StateBadgeProps {
    state: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
    const config = PRIORITY_CONFIGS[priority as Priority] || PRIORITY_CONFIGS.MEDIUM;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} shadow-sm`}>
            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${config.gradient} animate-pulse`}></div>
            <span className={`text-xs font-semibold ${config.textColor}`}>{priority}</span>
        </div>
    );
}

export function StateBadge({ state }: StateBadgeProps) {
    const config = STATE_CONFIGS[state as State] || STATE_CONFIGS.PROPOSED;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} shadow-sm transition-all duration-200 hover:shadow-md`}>
            <div className={config.textColor}>{config.icon}</div>
            <span className={`text-xs font-semibold ${config.textColor}`}>{state.replace('_', ' ')}</span>
        </div>
    );
}

// Export configs for other components that need access to styling
export { PRIORITY_CONFIGS, STATE_CONFIGS };
