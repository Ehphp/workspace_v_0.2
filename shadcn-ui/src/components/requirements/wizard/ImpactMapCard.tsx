/**
 * Presentational card for reviewing an ImpactMap artifact.
 * Pure display component — all actions delegated through callbacks.
 */

import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type { ImpactMap, ImpactItem, ImpactLayer, ImpactAction } from '@/types/impact-map';

interface ImpactMapCardProps {
    impactMap: ImpactMap;
}

const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-emerald-600' : c >= 0.5 ? 'text-amber-600' : 'text-red-600';

const layerLabel: Record<ImpactLayer, string> = {
    frontend: 'Frontend',
    logic: 'Logica',
    data: 'Dati',
    integration: 'Integrazione',
    automation: 'Automazione',
    configuration: 'Configurazione',
    ai_pipeline: 'AI Pipeline',
};

const actionBadge: Record<ImpactAction, { label: string; className: string }> = {
    read: { label: 'Read', className: 'bg-slate-50 text-slate-600 border-slate-200' },
    configure: { label: 'Configure', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    modify: { label: 'Modify', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    create: { label: 'Create', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function ImpactItemRow({ item }: { item: ImpactItem }) {
    const action = actionBadge[item.action];
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-1.5">
            {/* Layer + Action + Confidence */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">
                    {layerLabel[item.layer] ?? item.layer}
                </span>
                <Badge variant="outline" className={action.className}>
                    {action.label}
                </Badge>
                <span className={`ml-auto text-[11px] font-medium ${confidenceColor(item.confidence)}`}>
                    {Math.round(item.confidence * 100)}%
                </span>
            </div>

            {/* Components */}
            <div className="flex flex-wrap gap-1">
                {item.components.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {c}
                    </Badge>
                ))}
            </div>

            {/* Reason */}
            <p className="text-[11px] text-slate-500 leading-relaxed">{item.reason}</p>
        </div>
    );
}

export function ImpactMapCard({ impactMap }: ImpactMapCardProps) {
    return (
        <div className="space-y-3 text-sm">
            {/* Summary */}
            <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">Sommario architetturale</span>
                <p className="text-xs text-slate-600 leading-relaxed pl-0">
                    {impactMap.summary}
                </p>
            </div>

            {/* Impacts list */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">
                    Impatti ({impactMap.impacts.length})
                </span>
                {impactMap.impacts.map((item, i) => (
                    <ImpactItemRow key={i} item={item} />
                ))}
            </div>

            {/* Overall confidence */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                <CheckCircle2 className={`w-3.5 h-3.5 ${confidenceColor(impactMap.overallConfidence)}`} />
                <span className="text-xs font-semibold text-slate-700">Confidenza complessiva:</span>
                <span className={`text-xs font-bold ${confidenceColor(impactMap.overallConfidence)}`}>
                    {Math.round(impactMap.overallConfidence * 100)}%
                </span>
            </div>
        </div>
    );
}
