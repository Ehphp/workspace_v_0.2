/**
 * Presentational card for reviewing an EstimationBlueprint artifact.
 * Pure display component — all actions delegated through callbacks.
 */

import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type {
    EstimationBlueprint,
    BlueprintComponent,
    BlueprintIntegration,
    BlueprintDataEntity,
    BlueprintTestingScope,
    BlueprintLayer,
    InterventionType,
    Complexity,
    TestCriticality,
} from '@/types/estimation-blueprint';

interface EstimationBlueprintCardProps {
    blueprint: EstimationBlueprint;
}

const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-emerald-600' : c >= 0.5 ? 'text-amber-600' : 'text-red-600';

const layerLabel: Record<BlueprintLayer, string> = {
    frontend: 'Frontend',
    logic: 'Logica',
    data: 'Dati',
    integration: 'Integrazione',
    automation: 'Automazione',
    configuration: 'Configurazione',
    ai_pipeline: 'AI Pipeline',
};

const interventionBadge: Record<InterventionType, { label: string; className: string }> = {
    new_development: { label: 'Nuovo sviluppo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    modification: { label: 'Modifica', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    configuration: { label: 'Configurazione', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    integration: { label: 'Integrazione', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    migration: { label: 'Migrazione', className: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const complexityBadge: Record<Complexity, { label: string; className: string }> = {
    LOW: { label: 'Bassa', className: 'bg-green-50 text-green-700 border-green-200' },
    MEDIUM: { label: 'Media', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    HIGH: { label: 'Alta', className: 'bg-red-50 text-red-700 border-red-200' },
};

const criticalityBadge: Record<TestCriticality, { label: string; className: string }> = {
    LOW: { label: 'Bassa', className: 'bg-green-50 text-green-700 border-green-200' },
    MEDIUM: { label: 'Media', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    HIGH: { label: 'Alta', className: 'bg-red-50 text-red-700 border-red-200' },
    CRITICAL: { label: 'Critica', className: 'bg-red-100 text-red-800 border-red-300' },
};

// ── Sub-components ──

function ComponentRow({ item }: { item: BlueprintComponent }) {
    const intervention = interventionBadge[item.interventionType];
    const complexity = complexityBadge[item.complexity];
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    {layerLabel[item.layer] ?? item.layer}
                </Badge>
                <Badge variant="outline" className={`text-[10px] ${intervention.className}`}>
                    {intervention.label}
                </Badge>
                <Badge variant="outline" className={`text-[10px] ${complexity.className}`}>
                    {complexity.label}
                </Badge>
            </div>
            {item.notes && (
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.notes}</p>
            )}
        </div>
    );
}

function IntegrationRow({ item }: { item: BlueprintIntegration }) {
    return (
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-800">{item.target}</span>
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                    {item.type}
                </Badge>
                {item.direction && (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                        {item.direction}
                    </Badge>
                )}
            </div>
            {item.notes && (
                <p className="text-[11px] text-slate-500 leading-relaxed">{item.notes}</p>
            )}
        </div>
    );
}

function DataEntityRow({ item }: { item: BlueprintDataEntity }) {
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="text-xs font-medium text-slate-800">{item.entity}</span>
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                {item.operation}
            </Badge>
            {item.notes && (
                <span className="text-[11px] text-slate-500">— {item.notes}</span>
            )}
        </div>
    );
}

function TestingScopeRow({ item }: { item: BlueprintTestingScope }) {
    const crit = item.criticality ? criticalityBadge[item.criticality] : null;
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="text-xs font-medium text-slate-800">{item.area}</span>
            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                {item.testType}
            </Badge>
            {crit && (
                <Badge variant="outline" className={`text-[10px] ${crit.className}`}>
                    {crit.label}
                </Badge>
            )}
        </div>
    );
}

function StringList({ label, items, emptyMessage }: { label: string; items: string[]; emptyMessage?: string }) {
    if (!items || items.length === 0) {
        return emptyMessage ? (
            <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">{label}</span>
                <p className="text-[11px] text-slate-400 italic">{emptyMessage}</p>
            </div>
        ) : null;
    }
    return (
        <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">{label}</span>
            <ul className="space-y-0.5 pl-3">
                {items.map((item, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-relaxed list-disc">
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Main card ──

export function EstimationBlueprintCard({ blueprint }: EstimationBlueprintCardProps) {
    return (
        <div className="space-y-3 text-sm">
            {/* Summary */}
            <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700">Sintesi tecnica</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                    {blueprint.summary}
                </p>
            </div>

            {/* Components */}
            <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">
                    Componenti ({blueprint.components.length})
                </span>
                {blueprint.components.map((item, i) => (
                    <ComponentRow key={i} item={item} />
                ))}
            </div>

            {/* Integrations */}
            {blueprint.integrations.length > 0 && (
                <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-700">
                        Integrazioni ({blueprint.integrations.length})
                    </span>
                    {blueprint.integrations.map((item, i) => (
                        <IntegrationRow key={i} item={item} />
                    ))}
                </div>
            )}

            {/* Data Entities */}
            {blueprint.dataEntities.length > 0 && (
                <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-700">
                        Entità dati ({blueprint.dataEntities.length})
                    </span>
                    {blueprint.dataEntities.map((item, i) => (
                        <DataEntityRow key={i} item={item} />
                    ))}
                </div>
            )}

            {/* Testing Scope */}
            {blueprint.testingScope.length > 0 && (
                <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-700">
                        Scope di testing ({blueprint.testingScope.length})
                    </span>
                    {blueprint.testingScope.map((item, i) => (
                        <TestingScopeRow key={i} item={item} />
                    ))}
                </div>
            )}

            {/* Assumptions / Exclusions / Uncertainties */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
                <StringList label="Assunzioni" items={blueprint.assumptions} />
                <StringList label="Esclusioni" items={blueprint.exclusions} />
                <StringList label="Incertezze" items={blueprint.uncertainties} />
            </div>

            {/* Reasoning */}
            {blueprint.reasoning && (
                <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Ragionamento</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        {blueprint.reasoning}
                    </p>
                </div>
            )}

            {/* Overall confidence */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                <CheckCircle2 className={`w-3.5 h-3.5 ${confidenceColor(blueprint.overallConfidence)}`} />
                <span className="text-xs font-semibold text-slate-700">Confidenza complessiva:</span>
                <span className={`text-xs font-bold ${confidenceColor(blueprint.overallConfidence)}`}>
                    {Math.round(blueprint.overallConfidence * 100)}%
                </span>
            </div>
        </div>
    );
}
