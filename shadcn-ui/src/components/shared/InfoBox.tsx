import type React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const variants = {
    info: {
        container: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-600',
        text: 'text-blue-800',
        Icon: Info,
    },
    warning: {
        container: 'bg-amber-50 border-amber-200',
        icon: 'text-amber-600',
        text: 'text-amber-800',
        Icon: AlertTriangle,
    },
    success: {
        container: 'bg-emerald-50 border-emerald-200',
        icon: 'text-emerald-600',
        text: 'text-emerald-800',
        Icon: CheckCircle2,
    },
    error: {
        container: 'bg-red-50 border-red-200',
        icon: 'text-red-600',
        text: 'text-red-800',
        Icon: XCircle,
    },
} as const;

interface InfoBoxProps {
    variant?: keyof typeof variants;
    children: React.ReactNode;
    className?: string;
}

export function InfoBox({ variant = 'info', children, className }: InfoBoxProps) {
    const v = variants[variant];
    return (
        <div className={cn('flex items-start gap-2 p-3 border rounded-xl', v.container, className)}>
            <v.Icon className={cn('h-4 w-4 shrink-0 mt-0.5', v.icon)} />
            <div className={cn('text-xs', v.text)}>{children}</div>
        </div>
    );
}
