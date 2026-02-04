import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    gradient: string;
    iconGradient: string;
    subtitle?: string;
}

export function KpiCard({ icon: Icon, label, value, trend, gradient, iconGradient, subtitle }: KpiCardProps) {
    return (
        <Card className={`group relative overflow-hidden border-0 bg-gradient-to-br ${gradient} backdrop-blur-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`}>
            {/* Decorative background */}
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br opacity-[0.15] blur-2xl" style={{ background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))` }} />

            <CardContent className="p-4 flex items-center gap-4 relative z-10">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
                        {trend && (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${trend.isPositive ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'}`}>
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
