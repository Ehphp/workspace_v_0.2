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
        <Card className="rounded-lg shadow-sm border-slate-200 bg-white">
            <CardHeader
                className="pb-2 pt-3 px-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="h-3 w-3 text-orange-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xs font-semibold text-slate-900">Risk Factors</CardTitle>
                                    {selectedRiskIds.length > 0 && (
                                        <CardDescription className="text-[10px]">{selectedRiskIds.length} selected</CardDescription>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500">Score</div>
                                    <div className="flex items-center gap-1 justify-end">
                                        <div className="text-sm font-bold text-orange-600">{currentRiskScore}</div>
                                        <Badge variant={riskLevel.variant} className="text-[10px] h-4 px-1">{riskLevel.label}</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="px-3 pb-3 pt-0">
                    <div className="grid gap-1.5 md:grid-cols-2">
                        {risks.map((risk) => {
                            const isSelected = selectedRiskIds.includes(risk.id);

                            return (
                                <div
                                    key={risk.id}
                                    className={`flex items-start gap-2 p-2 border rounded cursor-pointer text-xs transition-colors ${isSelected
                                            ? 'border-orange-300 bg-orange-50'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    onClick={() => onRiskToggle(risk.id)}
                                >
                                    <Checkbox
                                        id={risk.id}
                                        checked={isSelected}
                                        onCheckedChange={() => onRiskToggle(risk.id)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <label htmlFor={risk.id} className="cursor-pointer">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-slate-900">{risk.name}</span>
                                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                                    +{risk.weight}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{risk.description}</p>
                                        </label>
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
