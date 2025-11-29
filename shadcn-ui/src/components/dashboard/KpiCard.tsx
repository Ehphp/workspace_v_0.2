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
}

export function KpiCard({ icon: Icon, label, value, trend, gradient, iconGradient }: KpiCardProps) {
    return (
        <Card className={`border-slate-200/50 bg-gradient-to-br ${gradient} backdrop-blur-sm hover:shadow-md transition-all duration-300`}>
            <CardContent className="p-2 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-600 mb-0">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-lg font-bold text-slate-900">{value}</p>
                        {trend && (
                            <span className={`text-[10px] font-semibold ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
