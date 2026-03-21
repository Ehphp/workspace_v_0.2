import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WizardStepShellProps {
    /** Icona Lucide per l'header */
    icon: LucideIcon;
    /** Gradiente per il box icona (es. "from-blue-500 to-cyan-500") */
    iconGradient: string;
    /** Titolo dello step */
    title: string;
    /** Sottotitolo descrittivo */
    subtitle: string;
    /** Badge opzionale (es. "Confermato") a destra */
    badge?: React.ReactNode;
    /** Contenuto scrollabile dello step */
    children: React.ReactNode;
    /** Pulsante Indietro handler */
    onBack?: () => void;
    /** Azioni nel footer (area destra) */
    footerActions?: React.ReactNode;
    /** Label per il pulsante Indietro. Default: "Indietro" */
    backLabel?: string;
    /** Disabilita il pulsante Indietro */
    backDisabled?: boolean;
    /** Classe aggiuntiva per il root */
    className?: string;
}

export function WizardStepShell({
    icon: Icon,
    iconGradient,
    title,
    subtitle,
    badge,
    children,
    onBack,
    footerActions,
    backLabel = 'Indietro',
    backDisabled = false,
    className,
}: WizardStepShellProps) {
    return (
        <div className={cn('flex flex-col h-full gap-3', className)}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br',
                            iconGradient,
                        )}
                    >
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
                        <p className="text-xs text-slate-600">{subtitle}</p>
                    </div>
                </div>
                {badge}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto pr-1">{children}</div>

            {/* Footer */}
            {(onBack || footerActions) && (
                <div className="flex-shrink-0 border-t border-slate-200 pt-3 mt-1">
                    <div className="flex items-center justify-between gap-2">
                        {onBack ? (
                            <Button variant="outline" size="sm" onClick={onBack} disabled={backDisabled}>
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                {backLabel}
                            </Button>
                        ) : (
                            <div />
                        )}
                        {footerActions && <div className="flex items-center gap-2">{footerActions}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
