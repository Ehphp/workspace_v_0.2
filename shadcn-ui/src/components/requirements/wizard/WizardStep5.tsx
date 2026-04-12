import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { fetchEstimationMasterData } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { calculateEstimation } from '@/lib/estimationEngine';
import type { Activity, Driver, Risk } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';
import type { EstimationResult } from '@/types/estimation';
import type { ExportableEstimation } from '@/types/export';
import { ExportDialog } from '@/components/export/ExportDialog';
import { useNavigate } from 'react-router-dom';

interface WizardStep5Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onBack: () => void;
  onReset: () => void;
  onSave?: (result: EstimationResult) => void;
}

export function WizardStep5({ data, onUpdate, onBack, onReset, onSave }: WizardStep5Props) {
  const navigate = useNavigate();
  const [result, setResult] = useState<EstimationResult | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Title: use the interview-generated title, or local fallback
  const generatedTitle = data.title
    || (data.description ? data.description.substring(0, 100) : 'Untitled requirement');

  // ── Load master data on mount ──
  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const masterData = await fetchEstimationMasterData();
      let allActivities: Activity[] = masterData.activities;

      // Merge project-scoped activities so PRJ_* codes resolve to their base_hours
      if (data.projectId) {
        const { data: paRows } = await supabase
          .from('project_activities')
          .select('id, code, name, base_hours, "group", intervention_type')
          .eq('project_id', data.projectId)
          .eq('is_enabled', true);
        if (paRows && paRows.length > 0) {
          const projActs = paRows.map(pa => ({
            ...pa,
            tech_category: 'PROJECT',
          })) as unknown as Activity[];
          allActivities = [...allActivities, ...projActs];
        }
      }

      setActivities(allActivities);
      setDrivers(masterData.drivers);
      setRisks(masterData.risks);
    } catch (err) {
      console.error('[WizardStep5] Failed to load master data:', err);
    }
    setLoading(false);
  };

  // ── Pre-fill drivers/risks from AI suggestions (once, after master data loads) ──
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || loading || drivers.length === 0) return;
    prefilled.current = true;

    const hasDriverSelections = Object.keys(data.selectedDriverValues).length > 0;
    if (!hasDriverSelections && data.suggestedDrivers && data.suggestedDrivers.length > 0) {
      const prefillDrivers: Record<string, string> = {};
      for (const suggestion of data.suggestedDrivers) {
        const catalogDriver = drivers.find(d => d.code === suggestion.code);
        if (catalogDriver) {
          const matchingOption = catalogDriver.options.find(
            (o: { value: string }) => o.value === suggestion.suggestedValue
          );
          if (matchingOption) {
            prefillDrivers[suggestion.code] = suggestion.suggestedValue;
          }
        }
      }
      if (Object.keys(prefillDrivers).length > 0) {
        onUpdate({ selectedDriverValues: prefillDrivers });
      }
    }

    const hasRiskSelections = data.selectedRiskCodes.length > 0;
    if (!hasRiskSelections && data.suggestedRisks && data.suggestedRisks.length > 0) {
      const validRiskCodes = data.suggestedRisks.filter(
        code => risks.some(r => r.code === code)
      );
      if (validRiskCodes.length > 0) {
        onUpdate({ selectedRiskCodes: validRiskCodes });
      }
    }
  }, [loading, drivers, risks]);

  // ── Recalculate estimation whenever inputs change ──
  const recalculate = useCallback(() => {
    if (activities.length === 0) return;

    const selectedActs = data.selectedActivityCodes.map((code) => {
      const activity = activities.find((a) => a.code === code);
      return {
        code,
        baseHours: activity?.base_hours || 0,
        isAiSuggested: data.aiSuggestedActivityCodes.includes(code),
      };
    });

    const selectedDrvs = Object.entries(data.selectedDriverValues).map(([code, value]) => {
      const driver = drivers.find((d) => d.code === code);
      const option = driver?.options.find((o) => o.value === value);
      return { code, value, multiplier: option?.multiplier || 1.0 };
    });

    const selectedRsks = data.selectedRiskCodes.map((code) => {
      const risk = risks.find((r) => r.code === code);
      return { code, weight: risk?.weight || 0 };
    });

    setResult(calculateEstimation({
      activities: selectedActs,
      drivers: selectedDrvs,
      risks: selectedRsks,
    }));
  }, [activities, drivers, risks, data.selectedActivityCodes, data.aiSuggestedActivityCodes, data.selectedDriverValues, data.selectedRiskCodes]);

  useEffect(() => {
    if (!loading) recalculate();
  }, [loading, recalculate]);

  // ── Driver / Risk editing ──
  const updateDriverValue = (driverCode: string, value: string) => {
    onUpdate({
      selectedDriverValues: { ...data.selectedDriverValues, [driverCode]: value },
    });
  };

  const toggleRisk = (riskCode: string) => {
    const newRisks = data.selectedRiskCodes.includes(riskCode)
      ? data.selectedRiskCodes.filter((c) => c !== riskCode)
      : [...data.selectedRiskCodes, riskCode];
    onUpdate({ selectedRiskCodes: newRisks });
  };

  const riskScore = data.selectedRiskCodes.reduce((sum, code) => {
    const risk = risks.find((r) => r.code === code);
    return sum + (risk?.weight || 0);
  }, 0);
  const contingency = riskScore <= 0 ? 0 : riskScore <= 10 ? 10 : riskScore <= 20 ? 15 : riskScore <= 30 ? 20 : 25;

  const handleExport = () => {
    setExportDialogOpen(true);
  };

  // Build exportable estimation for dialog
  const getExportableEstimation = (): ExportableEstimation | null => {
    if (!result) return null;

    return {
      requirement: {
        id: 'wizard-temp',
        reqId: data.reqId || 'NEW',
        title: generatedTitle || data.title || 'Untitled',
        description: data.description,
        priority: (data.priority as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
        state: data.state || 'PROPOSED',
      },
      estimation: {
        totalDays: result.totalDays,
        baseDays: result.baseDays,
        driverMultiplier: result.driverMultiplier,
        subtotal: result.subtotal,
        riskScore: result.riskScore,
        contingencyPercent: result.contingencyPercent,
        contingencyDays: result.contingencyDays,
      },
      technology: data.technologyId ? {
        name: data.technologyId,
        category: 'Custom',
      } : undefined,
      activities: data.selectedActivityCodes.map(code => {
        const activity = activities.find(a => a.code === code);
        return {
          code,
          name: activity?.name || code,
          group: activity?.group || 'DEV',
          hours: activity?.base_hours || 0,
          isAiSuggested: data.aiSuggestedActivityCodes.includes(code),
        };
      }),
      drivers: Object.entries(data.selectedDriverValues).map(([code, value]) => {
        const driver = drivers.find(d => d.code === code);
        const option = driver?.options.find(o => o.value === value);
        return {
          code,
          name: driver?.name || code,
          value,
          label: option?.label || value,
          multiplier: option?.multiplier || 1.0,
        };
      }),
      risks: data.selectedRiskCodes.map(code => {
        const risk = risks.find(r => r.code === code);
        return {
          code,
          name: risk?.name || code,
          weight: risk?.weight || 0,
        };
      }),
    };
  };

  if (loading || !result) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-600">Calculating estimation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Estimation Results</h2>
            </div>
            <p className="text-xs text-slate-600">Tune drivers & risks — the estimate updates live</p>
          </div>
        </div>
        <div className="text-right min-w-[160px]">
          <p className="text-sm font-semibold text-slate-900 line-clamp-2">{generatedTitle}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {/* ── Summary card ── */}
        <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-4xl font-bold text-green-800 leading-tight">
              {result.totalDays.toFixed(2)} days
            </CardTitle>
            <p className="text-xs text-slate-700">Working days including contingency</p>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 text-sm">
            <StatRow label="Base days" value={`${result.baseDays.toFixed(2)}`} />
            <StatRow label="Driver ×" value={`${result.driverMultiplier.toFixed(3)}x`} emphasize />
            <StatRow label="Subtotal" value={`${result.subtotal.toFixed(2)}`} />
            <StatRow label="Risk score" value={`${result.riskScore}`} emphasize />
            <StatRow label="Contingency" value={`${result.contingencyPercent}%`} />
            <StatRow label="+ days" value={`${result.contingencyDays.toFixed(2)}`} />
          </CardContent>
        </Card>

        {/* ── Activities (read-only) ── */}
        <div className="space-y-1.5">
          <h3 className="font-bold text-xs text-slate-900">
            Activities ({data.selectedActivityCodes.length})
          </h3>
          <div className="space-y-1">
            {data.selectedActivityCodes.map((code) => {
              const activity = activities.find((a) => a.code === code);
              const isAi = data.aiSuggestedActivityCodes.includes(code);
              return (
                <div key={code} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                  <span className="text-slate-700 flex items-center gap-1">
                    {activity?.name || code}
                    {isAi && (
                      <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">AI</span>
                    )}
                  </span>
                  <span className="text-slate-900 font-semibold">{activity?.base_hours ?? 0}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Drivers (editable) ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-xs text-slate-900">Drivers</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {drivers.map((driver) => {
              const selectedValue = data.selectedDriverValues[driver.code];
              const selectedOption = driver.options.find((opt) => opt.value === selectedValue);
              return (
                <div key={driver.code} className="space-y-1 p-2.5 rounded-xl border border-slate-200 bg-white/80 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={driver.code} className="text-xs font-bold text-slate-900">{driver.name}</Label>
                    {selectedOption && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {selectedOption.multiplier.toFixed(2)}x
                      </span>
                    )}
                  </div>
                  <Select
                    value={selectedValue}
                    onValueChange={(value) => updateDriverValue(driver.code, value)}
                  >
                    <SelectTrigger id={driver.code} className="h-8 border-slate-300 focus:border-blue-500 text-xs">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-md">
                      {driver.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} ({option.multiplier.toFixed(2)}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Risks (editable) ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-bold text-xs text-slate-900">Risks</h3>
          </div>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
            {risks.map((risk) => {
              const isSelected = data.selectedRiskCodes.includes(risk.code);
              return (
                <div
                  key={risk.code}
                  className={`group flex items-start space-x-2 p-2 border rounded-xl transition-all cursor-pointer ${isSelected
                    ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-red-50 shadow-sm'
                    : 'border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
                    }`}
                  onClick={() => toggleRisk(risk.code)}
                >
                  <Checkbox
                    id={risk.code}
                    checked={isSelected}
                    onCheckedChange={() => toggleRisk(risk.code)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={risk.code} className="cursor-pointer">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-rose-700 transition-colors">{risk.name}</span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">w: {risk.weight}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{risk.description}</p>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Risk assessment summary */}
          <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 mb-0.5">Risk assessment</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] text-slate-600">Score: <span className="text-sm font-bold text-amber-700">{riskScore}</span></span>
                  <span className="text-[10px] text-slate-600">Contingency: <span className="text-sm font-bold text-amber-700">{contingency}%</span></span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 space-y-3 border-t border-slate-200 pt-3 mt-1 bg-white">
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleExport} variant="outline" className="h-11 border-2 border-slate-300 hover:bg-slate-50">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </Button>
          <Button onClick={handleExport} variant="outline" className="h-11 border-2 border-slate-300 hover:bg-slate-50">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
        </div>

        {onSave ? (
          <Button
            onClick={() => result && onSave(result)}
            className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all duration-300"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="font-semibold">Save Requirement</span>
          </Button>
        ) : (
          <Button
            onClick={() => navigate('/register')}
            className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all duration-300"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="font-semibold">Create Account to Save Estimation</span>
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onBack} className="h-11 border-2 hover:bg-slate-50">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            className="h-11 border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Estimation
          </Button>
        </div>
      </div>

      {/* Export Dialog */}
      {getExportableEstimation() && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          estimations={[getExportableEstimation()!]}
        />
      )}
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  emphasize?: boolean;
}

function StatRow({ label, value, emphasize }: StatRowProps) {
  return (
    <div className="p-2 rounded-lg bg-white/70 flex items-center justify-between">
      <span className="text-xs text-slate-600">{label}</span>
      <span className={`text-sm font-semibold ${emphasize ? 'text-blue-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}
