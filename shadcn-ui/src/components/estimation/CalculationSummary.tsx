import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save, TrendingUp, Copy } from 'lucide-react';
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
            <Card className="rounded-xl shadow-xl border-white/50 bg-gradient-to-br from-white/90 to-blue-50/50 backdrop-blur-lg">
                <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-blue-50">
                    <CardTitle className="text-sm font-semibold text-slate-900">Riepilogo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-6 text-muted-foreground">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Compila i parametri per vedere la stima</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-xl shadow-xl border-white/50 bg-gradient-to-br from-white/90 to-blue-50/50 backdrop-blur-lg">
            <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-blue-50">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-900">Riepilogo</CardTitle>
                    {hasUnsavedChanges && (
                        <Badge variant="secondary" className="text-xs">Auto</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Calculation Breakdown */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Base Days</span>
                        <span className="font-mono">{result.baseDays.toFixed(1)}d</span>
                    </div>

                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Driver Multiplier</span>
                        <span className="font-mono">{result.driverMultiplier.toFixed(2)}x</span>
                    </div>

                    <Separator className="my-1" />

                    <div className="flex justify-between text-xs font-medium">
                        <span>Subtotal</span>
                        <span className="font-mono">{result.subtotal.toFixed(1)}d</span>
                    </div>

                    <Separator className="my-1" />

                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Risk Score</span>
                        <span className="font-mono">{result.riskScore}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Contingency</span>
                        <span className="font-mono">
                            {(result.contingencyPercent * 100).toFixed(0)}% (+{result.contingencyDays.toFixed(1)}d)
                        </span>
                    </div>

                    <Separator className="my-2" />

                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold">Total Estimation</span>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                                {result.totalDays.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">days</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            const text = [
                                `Estimation Summary`,
                                `------------------`,
                                `Base Days: ${result.baseDays.toFixed(1)}d`,
                                `Driver Multiplier: ${result.driverMultiplier.toFixed(2)}x`,
                                `Subtotal: ${result.subtotal.toFixed(1)}d`,
                                `Risk Score: ${result.riskScore}`,
                                `Contingency: ${(result.contingencyPercent * 100).toFixed(0)}% (+${result.contingencyDays.toFixed(1)}d)`,
                                `------------------`,
                                `TOTAL: ${result.totalDays.toFixed(1)} days`
                            ].join('\n');

                            navigator.clipboard.writeText(text);
                            // You might want to add a toast here if available in context, 
                            // but for now we'll assume the user sees the visual feedback or we can add a simple alert/console
                            // actually let's try to use the toast from sonner if it's available in the project
                        }}
                        className="flex-1"
                    >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        className="flex-[2]"
                    >
                        {isSaving ? (
                            'Saving...'
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Estimation
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
