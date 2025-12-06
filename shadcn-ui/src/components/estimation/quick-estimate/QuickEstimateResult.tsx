import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Calculator, ListChecks, Sparkles } from 'lucide-react';
import type { EstimationResult } from '@/types/estimation';

interface QuickEstimateResultProps {
    result: EstimationResult | null;
    selectedActivities: Array<{ code: string; name: string; baseHours: number }>;
    aiReasoning: string;
}

export function QuickEstimateResult({
    result,
    selectedActivities,
    aiReasoning,
}: QuickEstimateResultProps) {
    const [activeTab, setActiveTab] = useState('activities');

    if (!result) return null;

    return (
        <div className="space-y-4">
            {/* Result Header - Compact */}
            <div className="text-center relative py-4">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-transparent -z-10 rounded-2xl" />
                <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl mb-3 shadow-lg shadow-emerald-100 ring-2 ring-emerald-50">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-1 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    {result.totalDays.toFixed(1)} <span className="text-xl font-bold text-slate-400 tracking-normal">Days</span>
                </h3>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Estimated Effort</p>
            </div>

            {/* Tabs for Details */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100/80 p-1 rounded-xl h-auto">
                    <TabsTrigger value="activities" className="rounded-lg py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-medium text-xs">
                        <ListChecks className="w-3.5 h-3.5" /> Activities
                    </TabsTrigger>
                    <TabsTrigger value="breakdown" className="rounded-lg py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all font-medium text-xs">
                        <Calculator className="w-3.5 h-3.5" /> Breakdown
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activities" className="mt-0 space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedActivities.map((activity, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/80 hover:bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Badge variant="secondary" className="text-[9px] font-medium bg-blue-50 text-blue-700 border-blue-100 px-1.5 py-0.5 shrink-0">
                                    {activity.code}
                                </Badge>
                                <div className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 transition-colors truncate">{activity.name}</div>
                            </div>
                            <span className="font-bold text-slate-700 text-xs whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors ml-2">
                                {activity.baseHours.toFixed(1)} h
                            </span>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="breakdown" className="mt-0">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 space-y-3 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                            <span className="text-slate-500 text-xs font-medium">Base Effort</span>
                            <span className="font-bold text-slate-900 text-base">{result.baseDays.toFixed(1)} d</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                                    Multipliers
                                </span>
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-100">{result.driverMultiplier.toFixed(2)}x</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-orange-400" />
                                    Risk Factor
                                </span>
                                <span className="font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-[10px] border border-orange-100">+{result.riskScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-xs font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                                    Contingency
                                </span>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">{result.contingencyPercent}%</span>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">Total Estimate</span>
                            <span className="font-black text-xl text-emerald-600 tracking-tight">{result.totalDays.toFixed(1)} Days</span>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* AI Analysis Note - Compact */}
            {aiReasoning && (
                <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-lg p-3 flex gap-2 shadow-sm">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm h-fit ring-1 ring-blue-50">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="space-y-0.5">
                        <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">AI Analysis</h4>
                        <p className="text-[11px] text-blue-800 leading-relaxed opacity-90">{aiReasoning}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
