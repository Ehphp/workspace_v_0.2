import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputState = 'default' | 'error' | 'success' | 'disabled';

export interface BaseInputProps {
    state?: InputState;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    helperText?: string;
    showHelperText?: boolean;
}

/**
 * Base input styles with consistent focus behavior on all four sides.
 * 
 * Key features:
 * - Unified focus ring that wraps all four sides (no per-side border overrides)
 * - Support for error, success, and disabled states
 * - WCAG-compliant contrast ratios
 * - Optional icons and helper text
 */
export const getBaseInputClasses = (state?: InputState, hasLeftIcon?: boolean, hasRightIcon?: boolean) => {
    const baseClasses = [
        // Layout & Typography
        'flex h-10 w-full rounded-md px-3 py-2 text-base md:text-sm',

        // Background & Colors
        'bg-background text-foreground',
        'placeholder:text-muted-foreground',

        // Border - consistent on all four sides
        'border border-input',

        // Focus state - ring appears on ALL FOUR SIDES
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2',
        'ring-offset-background',

        // Transitions
        'transition-colors duration-200',

        // File input styling
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
    ];

    // Icon padding adjustments
    if (hasLeftIcon) {
        baseClasses.push('pl-10');
    }
    if (hasRightIcon) {
        baseClasses.push('pr-10');
    }

    // State-specific styles
    switch (state) {
        case 'error':
            baseClasses.push(
                'border-destructive',
                'text-destructive',
                'focus-visible:ring-destructive',
                'focus-visible:border-destructive'
            );
            break;
        case 'success':
            baseClasses.push(
                'border-green-500',
                'focus-visible:ring-green-500',
                'focus-visible:border-green-500'
            );
            break;
        case 'disabled':
            baseClasses.push('cursor-not-allowed opacity-50');
            break;
        default:
            // Default state - standard focus behavior
            break;
    }

    return baseClasses.join(' ');
};

export const BaseInputWrapper = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & BaseInputProps
>(({ children, state, leftIcon, rightIcon, helperText, showHelperText = true, className, ...props }, ref) => {
    const showHelper = showHelperText && (helperText || state === 'error');

    return (
        <div ref={ref} className={cn('relative w-full', className)} {...props}>
            {leftIcon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
                    {leftIcon}
                </div>
            )}

            {children}

            {rightIcon && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
                    {rightIcon}
                </div>
            )}

            {showHelper && helperText && (
                <p
                    className={cn(
                        'mt-1.5 text-xs',
                        state === 'error' ? 'text-destructive' : state === 'success' ? 'text-green-600' : 'text-muted-foreground'
                    )}
                >
                    {helperText}
                </p>
            )}
        </div>
    );
});

BaseInputWrapper.displayName = 'BaseInputWrapper';
