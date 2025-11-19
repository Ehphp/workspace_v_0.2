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
                className="pb-3 bg-gradient-to-r from-rose-50 to-orange-50 cursor-pointer border-b border-rose-100"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <AlertTriangle className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold text-slate-900">Risk Factors</CardTitle>
                                    <CardDescription className="text-xs">
                                        {selectedRiskIds.length > 0 ? `${selectedRiskIds.length} selected` : 'Identify potential risks'}
                                    </CardDescription>
                                </div>
                                <div className="text-right mr-8">
                                    <div className="text-xs text-slate-500">Score</div>
                                    <div className="flex items-center gap-2 justify-end transition-all duration-300">
                                        <div className="text-xl font-bold bg-gradient-to-r from-rose-600 to-orange-600 bg-clip-text text-transparent">{currentRiskScore}</div>
                                        <Badge variant={riskLevel.variant} className="transition-all duration-300">{riskLevel.label}</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-rose-600" /> : <ChevronDown className="h-4 w-4 text-rose-600" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="pt-4">
                    <div className="grid gap-2 md:grid-cols-2">
                        {risks.map((risk) => {
                            const isSelected = selectedRiskIds.includes(risk.id);

                            return (
                                <div
                                    key={risk.id}
                                    className={`group flex items-start space-x-3 p-3 border-2 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                                            ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-orange-50 shadow-md'
                                            : 'border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
                                        }`}
                                    onClick={() => onRiskToggle(risk.id)}
                                >
                                    <Checkbox
                                        id={risk.id}
                                        checked={isSelected}
                                        onCheckedChange={() => onRiskToggle(risk.id)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <label htmlFor={risk.id} className="cursor-pointer">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">
                                                    {risk.name}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                    +{risk.weight}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                                                {risk.description}
                                            </p>
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
