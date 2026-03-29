import type React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface MetricCardProps {
    icon: LucideIcon;
    iconGradient: string;
    label: string;
    value: string | number;
    trend?: { value: number; isPositive: boolean };
    subtitle?: string;
    className?: string;
}

export function MetricCard({
    icon: Icon,
    iconGradient,
    label,
    value,
    trend,
    subtitle,
    className,
}: MetricCardProps) {
    // Derive flat icon colors from the gradient prop
    const getIconColors = (gradient: string) => {
        if (gradient.includes('blue') || gradient.includes('indigo')) return 'bg-blue-50 text-blue-600';
        if (gradient.includes('emerald') || gradient.includes('teal')) return 'bg-emerald-50 text-emerald-600';
        if (gradient.includes('purple') || gradient.includes('pink')) return 'bg-purple-50 text-purple-600';
        if (gradient.includes('amber') || gradient.includes('orange')) return 'bg-amber-50 text-amber-600';
        if (gradient.includes('red') || gradient.includes('rose')) return 'bg-red-50 text-red-600';
        return 'bg-slate-100 text-slate-500';
    };

    const iconColors = getIconColors(iconGradient);

    return (
        <div
            className={cn(
                'rounded-lg border border-slate-200 bg-white px-3 py-2.5',
                'flex items-center gap-3 hover:shadow-sm transition-all',
                className,
            )}
        >
            <div
                className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    iconColors,
                )}
            >
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    {label}
                </p>
                <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
                    {trend && (
                        <span
                            className={cn(
                                'text-xs font-semibold px-1.5 py-0.5 rounded',
                                trend.isPositive
                                    ? 'text-emerald-700 bg-emerald-100'
                                    : 'text-red-700 bg-red-100',
                            )}
                        >
                            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
                )}
            </div>
        </div>
    );
}
