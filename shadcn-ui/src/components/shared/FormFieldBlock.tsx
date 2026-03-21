import type React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldBlockProps {
    label: string;
    htmlFor?: string;
    required?: boolean;
    help?: string;
    children: React.ReactNode;
    className?: string;
}

export function FormFieldBlock({
    label,
    htmlFor,
    required,
    help,
    children,
    className,
}: FormFieldBlockProps) {
    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={htmlFor} className="text-slate-700 font-medium">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
            {help && <p className="text-xs text-muted-foreground">{help}</p>}
        </div>
    );
}
