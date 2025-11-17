import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save, TrendingUp } from 'lucide-react';
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
            <Card className="rounded-lg shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Riepilogo</CardTitle>
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
        <Card className="rounded-lg shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Riepilogo</CardTitle>
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

                {/* Formula Explanation */}
                <div className="bg-muted/30 p-2 rounded text-[10px] space-y-0.5">
                    <div className="font-semibold mb-1 text-xs">Formula:</div>
                    <div className="font-mono">
                        Subtotal = Base Days × Driver Multiplier
                    </div>
                    <div className="font-mono">
                        = {result.baseDays.toFixed(1)} × {result.driverMultiplier.toFixed(2)}
                        = {result.subtotal.toFixed(1)}d
                    </div>
                    <Separator className="my-2" />
                    <div className="font-mono">
                        Total = Subtotal × (1 + Contingency%)
                    </div>
                    <div className="font-mono">
                        = {result.subtotal.toFixed(1)} × (1 + {(result.contingencyPercent * 100).toFixed(0)}%)
                        = {result.totalDays.toFixed(1)}d
                    </div>
                </div>

                {/* Save Button */}
                <Button
                    onClick={onSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="w-full"
                    size="lg"
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
            </CardContent>
        </Card>
    );
}
