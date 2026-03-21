import type React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                'border-2 border-dashed border-slate-200 rounded-lg p-8',
                className,
            )}
        >
            <Icon className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">{title}</p>
            {description && (
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{description}</p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
