import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save, TrendingUp, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { EstimationResult } from '@/types/estimation';

interface CalculationSummaryProps {
    result: EstimationResult | null;
    onSave: () => void;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
}

export function CalculationSummary({
    result,
    onSave,
    isSaving,
    hasUnsavedChanges,
}: CalculationSummaryProps) {
    if (!result) {
        return (
            <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs mb-3">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">5</span>
                    Riepilogo
                </h3>
                <div className="text-center py-6 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-[10px]">Compila i parametri per vedere la stima</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">5</span>
                    Riepilogo
                </h3>
                {hasUnsavedChanges && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Non salvato</span>
                )}
            </div>

            {/* Calculation Breakdown */}
            <div className="space-y-1.5 bg-white/80 rounded-lg border border-slate-200 p-2">
                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Giorni Base</span>
                    <span className="font-mono font-medium text-slate-700">{result.baseDays.toFixed(1)}g</span>
                </div>

                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Molt. Driver</span>
                    <span className="font-mono font-medium text-orange-600">{result.driverMultiplier.toFixed(2)}x</span>
                </div>

                <Separator className="my-1" />

                <div className="flex justify-between text-[10px] font-medium">
                    <span className="text-slate-700">Subtotale</span>
                    <span className="font-mono">{result.subtotal.toFixed(1)}g</span>
                </div>

                <Separator className="my-1" />

                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Rischio</span>
                    <span className="font-mono font-medium text-red-600">{result.riskScore}</span>
                </div>

                <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Contingenza</span>
                    <span className="font-mono text-slate-600">
                        {(result.contingencyPercent * 100).toFixed(0)}% (+{result.contingencyDays.toFixed(1)}g)
                    </span>
                </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200 p-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-semibold text-green-800">STIMA TOTALE</span>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-green-700">
                            {result.totalDays.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-green-600">giorni</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const text = [
                            `Riepilogo Stima`,
                            `------------------`,
                            `Giorni Base: ${result.baseDays.toFixed(1)}g`,
                            `Moltiplicatore Driver: ${result.driverMultiplier.toFixed(2)}x`,
                            `Subtotale: ${result.subtotal.toFixed(1)}g`,
                            `Punteggio Rischio: ${result.riskScore}`,
                            `Contingenza: ${(result.contingencyPercent * 100).toFixed(0)}% (+${result.contingencyDays.toFixed(1)}g)`,
                            `------------------`,
                            `TOTALE: ${result.totalDays.toFixed(1)} giorni`
                        ].join('\n');

                        navigator.clipboard.writeText(text);
                        toast.success('Riepilogo copiato negli appunti');
                    }}
                    className="flex-1 h-7 text-[10px] border-slate-200"
                >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                </Button>

                <Button
                    onClick={onSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    size="sm"
                    className="flex-[2] h-7 text-[10px] bg-green-600 hover:bg-green-700"
                >
                    {isSaving ? (
                        'Salvataggio...'
                    ) : (
                        <>
                            <Save className="h-3 w-3 mr-1" />
                            Salva Stima
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
