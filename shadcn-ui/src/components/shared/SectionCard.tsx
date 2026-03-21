import type React from 'react';
import { cn } from '@/lib/utils';

type SectionCardVariant = 'default' | 'elevated' | 'flat';

interface SectionCardProps {
    variant?: SectionCardVariant;
    children: React.ReactNode;
    className?: string;
    padding?: 'sm' | 'md' | 'lg' | 'none';
}

const variantClasses: Record<SectionCardVariant, string> = {
    default: 'rounded-xl border border-slate-200 bg-white shadow-sm',
    elevated: 'rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-lg',
    flat: 'rounded-xl border border-slate-200 bg-white',
};

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

export function SectionCard({
    variant = 'default',
    children,
    className,
    padding = 'md',
}: SectionCardProps) {
    return (
        <div className={cn(variantClasses[variant], paddingClasses[padding], className)}>
            {children}
        </div>
    );
}
