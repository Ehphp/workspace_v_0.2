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
        <div className="space-y-6">
            {/* Result Header */}
            <div className="text-center relative py-8">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/60 to-transparent -z-10 rounded-3xl" />
                <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl mb-4 shadow-xl shadow-emerald-100 ring-4 ring-emerald-50">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-2 bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    {result.totalDays.toFixed(1)} <span className="text-2xl font-bold text-slate-400 tracking-normal">Days</span>
                </h3>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="w-8 h-[1px] bg-emerald-200"></span>
                    Estimated Effort
                    <span className="w-8 h-[1px] bg-emerald-200"></span>
                </p>
            </div>

            {/* Tabs for Details */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/80 p-1.5 rounded-2xl h-auto">
                    <TabsTrigger value="activities" className="rounded-xl py-2.5 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-medium">
                        <ListChecks className="w-4 h-4" /> Activities
                    </TabsTrigger>
                    <TabsTrigger value="breakdown" className="rounded-xl py-2.5 gap-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md transition-all font-medium">
                        <Calculator className="w-4 h-4" /> Breakdown
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activities" className="mt-0 space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedActivities.map((activity, idx) => (
                        <div key={idx} className="flex items-start justify-between p-4 bg-white/80 hover:bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group">
                            <div className="space-y-1.5">
                                <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">{activity.name}</div>
                                <Badge variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 px-2 py-0.5">
                                    {activity.code}
                                </Badge>
                            </div>
                            <span className="font-bold text-slate-700 text-sm whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
                                {activity.baseHours.toFixed(1)} h
                            </span>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="breakdown" className="mt-0">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 space-y-5 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                            <span className="text-slate-500 text-sm font-medium">Base Effort</span>
                            <span className="font-bold text-slate-900 text-lg">{result.baseDays.toFixed(1)} d</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    Multipliers
                                </span>
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg text-xs border border-blue-100">{result.driverMultiplier.toFixed(2)}x</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    Risk Factor
                                </span>
                                <span className="font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg text-xs border border-orange-100">+{result.riskScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 text-sm font-medium flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    Contingency
                                </span>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg text-xs border border-slate-200">{result.contingencyPercent}%</span>
                            </div>
                        </div>
                        <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-base">Total Estimate</span>
                            <span className="font-black text-2xl text-emerald-600 tracking-tight">{result.totalDays.toFixed(1)} Days</span>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* AI Analysis Note */}
            {aiReasoning && (
                <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-4 flex gap-3 shadow-sm">
                    <div className="p-2 bg-white rounded-lg shadow-sm h-fit ring-1 ring-blue-50">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide">AI Analysis</h4>
                        <p className="text-xs text-blue-800 leading-relaxed opacity-90">{aiReasoning}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
