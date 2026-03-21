import type { LucideIcon } from 'lucide-react';
import { MetricCard } from '@/components/shared/MetricCard';

interface KpiCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    /** @deprecated Unused — kept for backward compatibility */
    gradient?: string;
    iconGradient: string;
    subtitle?: string;
}

export function KpiCard({ gradient: _gradient, ...props }: KpiCardProps) {
    return <MetricCard {...props} />;
}
