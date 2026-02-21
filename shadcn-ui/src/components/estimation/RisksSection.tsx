import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2 } from 'lucide-react';
import type { Risk } from '@/types/database';

interface RisksSectionProps {
    risks: Risk[];
    selectedRiskIds: string[];
    onRiskToggle: (riskId: string) => void;
    currentRiskScore: number;
    isExpanded?: boolean;
    onToggle?: () => void;
}

export function RisksSection({
    risks,
    selectedRiskIds,
    onRiskToggle,
    currentRiskScore,
}: RisksSectionProps) {
    const getRiskLevel = (score: number) => {
        if (score <= 0) return { label: 'Nessuno', color: 'text-slate-500 bg-slate-50' };
        if (score <= 10) return { label: 'Basso', color: 'text-green-600 bg-green-50' };
        if (score <= 20) return { label: 'Medio', color: 'text-amber-600 bg-amber-50' };
        if (score <= 30) return { label: 'Alto', color: 'text-orange-600 bg-orange-50' };
        return { label: 'Critico', color: 'text-red-600 bg-red-50' };
    };

    const riskLevel = getRiskLevel(currentRiskScore);

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-rose-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">3</span>
                    Fattori di Rischio
                </h3>
                <div className="text-right flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500">Punteggio</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${riskLevel.color}`}>
                        {currentRiskScore} {riskLevel.label}
                    </span>
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                <div className="grid grid-cols-2 gap-1">
                    {risks.map((risk) => {
                        const isSelected = selectedRiskIds.includes(risk.id);
                        return (
                            <div
                                key={risk.id}
                                className={`cursor-pointer rounded p-1.5 text-[10px] flex items-center gap-1.5 transition-all ${isSelected ? 'bg-red-50 border border-red-200' : 'bg-white/80 border border-slate-200 hover:border-red-200'}`}
                                onClick={() => onRiskToggle(risk.id)}
                            >
                                <div className={`w-3 h-3 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 bg-white'}`}>
                                    {isSelected && <CheckCircle2 className="h-2 w-2 text-white" />}
                                </div>
                                <span className={`font-medium truncate ${isSelected ? 'text-red-800' : 'text-slate-600'}`} title={risk.name}>
                                    {risk.name}
                                </span>
                                <span className="text-[8px] text-slate-400 shrink-0">+{risk.weight}</span>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
