import type React from 'react';
import { cn } from '@/lib/utils';
import { Header } from './Header';

interface PageShellProps {
    children: React.ReactNode;
    /** Larghezza max del container. Default: '7xl' */
    maxWidth?: '4xl' | '5xl' | '6xl' | '7xl';
    /** Sfondo pagina. Default: 'default' (bg-slate-50) */
    background?: 'default' | 'gradient';
    /** Padding verticale. Default: 'md' */
    paddingY?: 'sm' | 'md' | 'lg';
    /** Mostra Header. Default: true */
    showHeader?: boolean;
    /** Altezza fissa a viewport (h-screen). Default: false */
    fullHeight?: boolean;
    /** Classe aggiuntiva per il root container */
    className?: string;
    /** Classe aggiuntiva per il main content area */
    contentClassName?: string;
    /** Classi per il wrapper div attorno a Header (es. backdrop-blur, border-b). Se omesso, l'Header non viene wrappato. */
    headerClassName?: string;
    /** Elementi posizionati in modo assoluto nello sfondo (es. motion blobs, particles) */
    backgroundSlot?: React.ReactNode;
    /** Disabilita container/px/maxWidth/padding su main — la pagina gestisce il layout internamente */
    noContainer?: boolean;
}

const maxWidthMap = {
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
} as const;

const paddingMap = {
    sm: 'py-4',
    md: 'py-6',
    lg: 'py-10 lg:py-12',
} as const;

const backgroundMap = {
    default: 'bg-slate-50',
    gradient: 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50',
} as const;

export function PageShell({
    children,
    maxWidth = '7xl',
    background = 'default',
    paddingY = 'md',
    showHeader = true,
    fullHeight = false,
    className,
    contentClassName,
    headerClassName,
    backgroundSlot,
    noContainer = false,
}: PageShellProps) {
    const headerEl = showHeader ? (
        headerClassName ? (
            <div className={cn('flex-shrink-0', headerClassName)}>
                <Header />
            </div>
        ) : (
            <Header />
        )
    ) : null;

    return (
        <div
            className={cn(
                'min-h-screen flex flex-col',
                fullHeight && 'h-screen overflow-hidden',
                backgroundMap[background],
                className,
            )}
        >
            {backgroundSlot}
            {headerEl}
            <main
                id="main-content"
                className={cn(
                    'flex-1',
                    !noContainer && 'container mx-auto px-6',
                    !noContainer && maxWidthMap[maxWidth],
                    !noContainer && paddingMap[paddingY],
                    fullHeight && 'min-h-0 overflow-y-auto',
                    contentClassName,
                )}
            >
                {children}
            </main>
        </div>
    );
}
