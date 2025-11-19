import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Risk } from '@/types/database';

interface RisksSectionProps {
    risks: Risk[];
    selectedRiskIds: string[];
    onRiskToggle: (riskId: string) => void;
    currentRiskScore: number;
    isExpanded: boolean;
    onToggle: () => void;
}

export function RisksSection({
    risks,
    selectedRiskIds,
    onRiskToggle,
    currentRiskScore,
    isExpanded,
    onToggle,
}: RisksSectionProps) {
    const getRiskLevel = (score: number) => {
        if (score <= 10) return { label: 'Low', variant: 'default' as const };
        if (score <= 20) return { label: 'Medium', variant: 'secondary' as const };
        if (score <= 30) return { label: 'High', variant: 'destructive' as const };
        return { label: 'Critical', variant: 'destructive' as const };
    };

    const riskLevel = getRiskLevel(currentRiskScore);

    return (
        <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader
                className="pb-3 bg-gradient-to-r from-slate-50 to-blue-50 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900">Rischi PP</CardTitle>
                                <CardDescription className="text-xs">
                                    Identify risks that may impact the estimation
                                </CardDescription>
                            </div>
                            <div className="text-right mr-8">
                                <div className="text-xs text-muted-foreground">Score</div>
                                <div className="flex items-center gap-2 justify-end">
                                    <div className="text-xl font-bold">{currentRiskScore}</div>
                                    <Badge variant={riskLevel.variant}>{riskLevel.label}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                        {risks.map((risk) => {
                            const isSelected = selectedRiskIds.includes(risk.id);

                            return (
                                <div
                                    key={risk.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-200/50 hover:bg-orange-50/50 hover:border-orange-300/50 transition-all duration-200"
                                >
                                    <Checkbox
                                        id={risk.id}
                                        checked={isSelected}
                                        onCheckedChange={() => onRiskToggle(risk.id)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                                            <label
                                                htmlFor={risk.id}
                                                className="text-sm font-medium cursor-pointer"
                                            >
                                                {risk.name}
                                            </label>
                                            <Badge variant="outline" className="text-xs">
                                                +{risk.weight}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {risk.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
