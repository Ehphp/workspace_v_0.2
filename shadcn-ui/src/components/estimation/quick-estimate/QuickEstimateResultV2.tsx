import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    CheckCircle2,
    Calculator,
    ListChecks,
    Sparkles,
    ChevronDown,
    AlertTriangle,
    Shield,
    Layers,
    Brain,
} from 'lucide-react';
import type { QuickEstimationV2Result } from '@/hooks/useQuickEstimationV2';

interface QuickEstimateResultV2Props {
    result: QuickEstimationV2Result;
}

export function QuickEstimateResultV2({ result }: QuickEstimateResultV2Props) {
    const [activeTab, setActiveTab] = useState('activities');
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { estimation, activities, reasoning, confidenceScore, suggestedDrivers, suggestedRisks, artifacts, trace, shouldEscalate, escalationReason } = result;

    const confidenceColor = confidenceScore >= 0.80
        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : confidenceScore >= 0.60
            ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-red-600 bg-red-50 border-red-200';

    return (
        <div className="space-y-4">
            {/* Escalation alert */}
            {shouldEscalate && (
                <Alert className="border-amber-200 bg-amber-50/80">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800">
                        {escalationReason}
                    </AlertDescription>
                </Alert>
            )}

            {/* Result Header */}
            <div className="text-center relative py-4">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-transparent -z-10 rounded-2xl" />
                <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl mb-3 shadow-lg shadow-emerald-100 ring-2 ring-emerald-50">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-1 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    {estimation.totalDays.toFixed(1)} <span className="text-xl font-bold text-slate-400 tracking-normal">Days</span>
                </h3>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <Badge className={`text-[10px] font-semibold border ${confidenceColor}`}>
                        Confidence: {Math.round(confidenceScore * 100)}%
                    </Badge>
                    {result.generatedTitle && (
                        <Badge variant="secondary" className="text-[10px] font-medium max-w-[200px] truncate">
                            {result.generatedTitle}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4 bg-slate-100/80 p-1 rounded-xl h-auto">
                    <TabsTrigger value="activities" className="rounded-lg py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-medium text-xs">
                        <ListChecks className="w-3.5 h-3.5" /> Activities
                    </TabsTrigger>
                    <TabsTrigger value="breakdown" className="rounded-lg py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-medium text-xs">
                        <Calculator className="w-3.5 h-3.5" /> Breakdown
                    </TabsTrigger>
                    <TabsTrigger value="drivers" className="rounded-lg py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-medium text-xs">
                        <Shield className="w-3.5 h-3.5" /> Drivers
                    </TabsTrigger>
                </TabsList>

                {/* Activities tab */}
                <TabsContent value="activities" className="mt-0 space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {activities.map((activity, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/80 hover:bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge variant="secondary" className="text-[9px] font-medium bg-blue-50 text-blue-700 border-blue-100 px-1.5 py-0.5 shrink-0">
                                    {activity.code}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 transition-colors truncate">{activity.name}</div>
                                    {activity.reason && (
                                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{activity.reason}</div>
                                    )}
                                </div>
                            </div>
                            <span className="font-bold text-slate-700 text-xs whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors ml-2">
                                {activity.baseHours.toFixed(1)} h
                            </span>
                        </div>
                    ))}
                </TabsContent>

                {/* Breakdown tab */}
                <TabsContent value="breakdown" className="mt-0">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 space-y-3 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                            <span className="text-slate-500 text-xs font-medium">Base Effort</span>
                            <span className="font-bold text-slate-900 text-base">{estimation.baseDays.toFixed(1)} d</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    Multipliers
                                </span>
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100">{estimation.driverMultiplier.toFixed(2)}x</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-orange-400" />
                                    Risk Factor
                                </span>
                                <span className="font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-[10px] border border-orange-100">+{estimation.riskScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                                    Contingency
                                </span>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">{estimation.contingencyPercent}%</span>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">Total Estimate</span>
                            <span className="font-black text-xl text-emerald-600 tracking-tight">{estimation.totalDays.toFixed(1)} Days</span>
                        </div>
                    </div>
                </TabsContent>

                {/* Drivers & Risks tab */}
                <TabsContent value="drivers" className="mt-0 space-y-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {suggestedDrivers && suggestedDrivers.length > 0 ? (
                        <>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggested Drivers</h4>
                            {suggestedDrivers.map((d, i) => (
                                <div key={i} className="p-2.5 bg-white/80 rounded-lg border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <Badge variant="outline" className="text-[9px]">{d.code}</Badge>
                                        <Badge className="text-[9px] bg-blue-50 text-blue-700 border-blue-100">{d.suggestedValue}</Badge>
                                    </div>
                                    {d.reason && <p className="text-[10px] text-slate-500 leading-relaxed">{d.reason}</p>}
                                </div>
                            ))}
                        </>
                    ) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">Nessun driver suggerito — valori neutri applicati</p>
                    )}
                    {suggestedRisks && suggestedRisks.length > 0 && (
                        <>
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4">Suggested Risks</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestedRisks.map((r, i) => (
                                    <Badge key={i} variant="secondary" className="text-[9px] bg-orange-50 text-orange-700 border-orange-100">{r}</Badge>
                                ))}
                            </div>
                        </>
                    )}
                </TabsContent>
            </Tabs>

            {/* AI Reasoning */}
            {reasoning && (
                <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-lg p-3 flex gap-2 shadow-sm">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm h-fit ring-1 ring-blue-50">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">AI Analysis</h4>
                        <p className="text-[11px] text-blue-800 leading-relaxed opacity-90">{reasoning}</p>
                    </div>
                </div>
            )}

            {/* AI Details collapsible */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors py-1">
                    <Brain className="w-3.5 h-3.5" />
                    Dettagli AI Pipeline
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                    {/* Understanding summary */}
                    {artifacts.understanding && (
                        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Layers className="w-3 h-3 text-violet-500" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Understanding</span>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed">{artifacts.understanding.businessObjective}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {artifacts.understanding.functionalPerimeter.slice(0, 4).map((p, i) => (
                                    <Badge key={i} variant="secondary" className="text-[8px] bg-violet-50 text-violet-600 border-violet-100">{p}</Badge>
                                ))}
                                {artifacts.understanding.functionalPerimeter.length > 4 && (
                                    <Badge variant="secondary" className="text-[8px]">+{artifacts.understanding.functionalPerimeter.length - 4}</Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Impact Map summary */}
                    {artifacts.impactMap && (
                        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Layers className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Impact Map</span>
                                <Badge variant="secondary" className="text-[8px] ml-auto">{artifacts.impactMap.impacts.length} layers</Badge>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-2">{artifacts.impactMap.summary}</p>
                        </div>
                    )}

                    {/* Blueprint summary */}
                    {artifacts.blueprint && (
                        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Layers className="w-3 h-3 text-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Blueprint</span>
                                <Badge variant="secondary" className="text-[8px] ml-auto">
                                    conf: {Math.round((artifacts.blueprint.overallConfidence ?? 0) * 100)}%
                                </Badge>
                            </div>
                            {artifacts.blueprint.reasoning && (
                                <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-2">{artifacts.blueprint.reasoning}</p>
                            )}
                        </div>
                    )}

                    {/* Pipeline trace */}
                    <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Pipeline Trace</span>
                            <Badge variant="secondary" className="text-[8px] ml-auto">{Math.round(trace.totalDurationMs)}ms</Badge>
                        </div>
                        <div className="space-y-1">
                            {trace.steps.map((s, i) => (
                                <div key={i} className="flex items-center gap-2 text-[10px]">
                                    <div className={`w-1.5 h-1.5 rounded-full ${s.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    <span className="text-slate-600 flex-1">{s.step}</span>
                                    <span className="text-slate-400 font-mono">{Math.round(s.durationMs)}ms</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
