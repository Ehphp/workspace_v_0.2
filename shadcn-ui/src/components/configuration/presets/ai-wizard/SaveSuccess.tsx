/**
 * Save Success Component
 * 
 * Confirmation screen after successful preset save.
 */

import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface SaveSuccessProps {
    presetName: string;
    onClose: () => void;
    onCreateAnother: () => void;
}

export function SaveSuccess({
    presetName,
    onClose,
    onCreateAnother
}: SaveSuccessProps) {
    // Fire confetti on mount
    useEffect(() => {
        const duration = 2000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#3b82f6', '#6366f1', '#8b5cf6']
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#3b82f6', '#6366f1', '#8b5cf6']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };

        frame();
    }, []);

    return (
        <div className="space-y-8 max-w-2xl mx-auto py-12 text-center">
            {/* Success Icon */}
            <div className="flex justify-center">
                <div className="relative">
                    {/* Outer ring animation */}
                    <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-ping" />

                    {/* Success circle */}
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl flex items-center justify-center">
                        <CheckCircle2 className="w-16 h-16 text-white" />
                    </div>
                </div>
            </div>

            {/* Success Message */}
            <div className="space-y-3">
                <h2 className="text-3xl font-bold text-slate-900">
                    Preset Creato con Successo! 🎉
                </h2>
                <p className="text-lg text-slate-600">
                    Il preset <span className="font-semibold text-blue-600">"{presetName}"</span> è stato salvato ed è pronto per l'uso
                </p>
            </div>

            {/* Features List */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 space-y-3">
                <h3 className="font-semibold text-slate-900">Cosa puoi fare ora:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Usare questo preset per nuovi requisiti</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Modificare attività e driver dalla pagina preset</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Duplicare il preset per creare varianti</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Condividerlo con il tuo team</span>
                    </li>
                </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    onClick={onCreateAnother}
                    size="lg"
                    variant="outline"
                    className="flex-1 gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Crea Altro Preset
                </Button>
                <Button
                    onClick={onClose}
                    size="lg"
                    className="flex-1 gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                    Vai ai Preset
                    <ArrowRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Thank You Note */}
            <div className="text-xs text-slate-500 pt-6 border-t border-slate-200">
                Grazie per aver usato l'AI Wizard! Il preset è stato generato con intelligenza artificiale e ottimizzato per il tuo progetto.
            </div>
        </div>
    );
}
