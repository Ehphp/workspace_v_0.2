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
    return (
        <div
            className={cn(
                'rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-4',
                'flex items-center gap-4 hover:shadow-md hover:border-slate-300 transition-all',
                className,
            )}
        >
            <div
                className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
                    'bg-gradient-to-br',
                    iconGradient,
                )}
            >
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                    {label}
                </p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
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
