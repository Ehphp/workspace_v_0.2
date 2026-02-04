/**
 * AI Wizard Design System
 * 
 * Unified design tokens for consistent styling across all wizard components.
 * Use these constants instead of hardcoded values for maintainability.
 */

export const WIZARD_DESIGN = {
    // Color Gradients for Icons/Headers
    gradients: {
        primary: 'from-blue-500 to-indigo-600',      // Main wizard gradient
        success: 'from-emerald-500 to-teal-600',     // Success states
        progress: 'from-indigo-500 to-purple-600',   // Progress indicators
    },

    // Container Widths
    containers: {
        narrow: 'max-w-2xl',    // Progress screens
        medium: 'max-w-3xl',    // Input forms
        wide: 'max-w-4xl',      // Review/questionnaire
    },

    // Spacing
    spacing: {
        section: 'space-y-6',      // Between major sections
        card: 'space-y-4',         // Within cards
        items: 'space-y-3',        // Between list items
        tight: 'space-y-2',        // Between related elements
    },

    // Typography
    typography: {
        title: 'text-2xl font-bold text-slate-900',
        subtitle: 'text-slate-600',
        questionTitle: 'text-lg font-semibold text-slate-900',
        label: 'text-sm font-semibold text-slate-700',
        description: 'text-sm text-slate-600',
        help: 'text-xs text-slate-500',
    },

    // Border & Shadow Styles
    borders: {
        card: 'border border-slate-200 rounded-2xl shadow-sm',
        option: 'border border-slate-200 rounded-lg',
        optionHover: 'hover:border-blue-300 hover:bg-blue-50/30',
        optionSelected: 'border-blue-500 bg-blue-50/50',
    },

    // Interactive States
    interactive: {
        transition: 'transition-all duration-200',
        cursor: 'cursor-pointer',
        focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
    },

    // Icon Sizes
    icons: {
        small: 'w-4 h-4',
        medium: 'w-5 h-5',
        large: 'w-7 h-7',
        xlarge: 'w-16 h-16',
    },

    // Badge Colors
    badges: {
        primary: 'bg-blue-100 text-blue-700 border-blue-200',
        success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        warning: 'bg-amber-100 text-amber-700 border-amber-200',
        neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    },

    // Progress Indicators
    progress: {
        height: 'h-2',
        colors: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    },

    // Animations
    animations: {
        pulse: 'animate-pulse',
        spin: 'animate-spin',
        fadeIn: 'animate-in fade-in duration-300',
        slideIn: 'animate-in slide-in-from-bottom-4 duration-300',
    },
} as const;

// Helper function to combine design tokens
export function combineClasses(...classes: (string | undefined | false)[]): string {
    return classes.filter(Boolean).join(' ');
}

// Helper to get confidence badge color
export function getConfidenceBadgeColor(confidence: number): string {
    if (confidence >= 0.8) return WIZARD_DESIGN.badges.success;
    if (confidence >= 0.6) return WIZARD_DESIGN.badges.primary;
    return WIZARD_DESIGN.badges.warning;
}

// Helper to get priority icon color
export function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
    switch (priority) {
        case 'high': return 'text-red-600';
        case 'medium': return 'text-blue-600';
        case 'low': return 'text-slate-600';
        default: return 'text-slate-600';
    }
}
