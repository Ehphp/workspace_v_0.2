import { cn } from '@/lib/utils';

// ---- Priority configs ----
const PRIORITY_STYLES = {
    HIGH: { bg: 'from-red-50 to-rose-50', text: 'text-red-700', border: 'border-red-200/50', dot: 'from-red-500 to-rose-500', icon: '🔴' },
    MEDIUM: { bg: 'from-amber-50 to-orange-50', text: 'text-amber-700', border: 'border-amber-200/50', dot: 'from-amber-500 to-orange-500', icon: '🟡' },
    LOW: { bg: 'from-emerald-50 to-teal-50', text: 'text-emerald-700', border: 'border-emerald-200/50', dot: 'from-emerald-500 to-teal-500', icon: '🟢' },
} as const;

// ---- State configs ----
const STATE_STYLES = {
    PROPOSED: { bg: 'from-blue-50 to-indigo-50', text: 'text-blue-700', border: 'border-blue-200/50' },
    SELECTED: { bg: 'from-violet-50 to-purple-50', text: 'text-violet-700', border: 'border-violet-200/50' },
    SCHEDULED: { bg: 'from-orange-50 to-amber-50', text: 'text-orange-700', border: 'border-orange-200/50' },
    DONE: { bg: 'from-teal-50 to-cyan-50', text: 'text-teal-700', border: 'border-teal-200/50' },
} as const;

// ---- List status configs ----
const LIST_STATUS_STYLES = {
    DRAFT: { bg: 'from-slate-50 to-gray-50', text: 'text-slate-600', border: 'border-slate-200/50' },
    ACTIVE: { bg: 'from-emerald-50 to-green-50', text: 'text-emerald-700', border: 'border-emerald-200/50' },
    ARCHIVED: { bg: 'from-gray-50 to-slate-50', text: 'text-gray-500', border: 'border-gray-200/50' },
} as const;

type StatusType = 'priority' | 'state' | 'listStatus';

interface StatusBadgeProps {
    type: StatusType;
    value: string;
    className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
    const styles =
        type === 'priority'
            ? PRIORITY_STYLES[value as keyof typeof PRIORITY_STYLES]
            : type === 'state'
                ? STATE_STYLES[value as keyof typeof STATE_STYLES]
                : LIST_STATUS_STYLES[value as keyof typeof LIST_STATUS_STYLES];

    if (!styles) return <span className="text-xs text-slate-500">{value}</span>;

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                'bg-gradient-to-r border shadow-sm',
                styles.bg,
                styles.border,
                className,
            )}
        >
            {type === 'priority' && 'dot' in styles && (
                <div className={cn('w-1.5 h-1.5 rounded-full bg-gradient-to-r animate-pulse', styles.dot)} />
            )}
            <span className={cn('text-xs font-semibold', styles.text)}>
                {value.replace('_', ' ')}
            </span>
        </div>
    );
}

export { PRIORITY_STYLES, STATE_STYLES, LIST_STATUS_STYLES };
