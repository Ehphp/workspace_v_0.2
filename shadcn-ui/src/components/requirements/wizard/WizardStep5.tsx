import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_ACTIVITIES, MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import { calculateEstimation } from '@/lib/estimationEngine';
import { generateTitleFromDescription } from '@/lib/openai';
import type { Activity, Driver, Risk } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';
import type { EstimationResult } from '@/types/estimation';
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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [titleLoading, setTitleLoading] = useState(true);

  useEffect(() => {
    calculateResult();
    generateTitle();
  }, []);

  const generateTitle = async () => {
    // If user already provided a title in Step 1, use it
    if (data.title) {
      setGeneratedTitle(data.title);
      setTitleLoading(false);
      return;
    }

    if (!data.description) {
      setGeneratedTitle('Untitled requirement');
      setTitleLoading(false);
      return;
    }

    try {
      setTitleLoading(true);
      const title = await generateTitleFromDescription(data.description);
      setGeneratedTitle(title);
      // Save the generated title to the wizard state so it gets persisted
      onUpdate({ title });
    } catch (error) {
      console.error('Error generating title:', error);
      const fallbackTitle = data.description.substring(0, 100);
      setGeneratedTitle(fallbackTitle);
      onUpdate({ title: fallbackTitle });
    } finally {
      setTitleLoading(false);
    }
  };

  const calculateResult = async () => {
    try {
      const [activitiesResult, driversResult, risksResult] = await Promise.all([
        supabase.from('activities').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('risks').select('*'),
      ]);

      let allActivities: Activity[];
      let allDrivers: Driver[];
      let allRisks: Risk[];

      if (activitiesResult.error || !activitiesResult.data || activitiesResult.data.length === 0 ||
        driversResult.error || !driversResult.data || driversResult.data.length === 0 ||
        risksResult.error || !risksResult.data || risksResult.data.length === 0) {
        allActivities = MOCK_ACTIVITIES;
        allDrivers = MOCK_DRIVERS;
        allRisks = MOCK_RISKS;
        setIsDemoMode(true);
      } else {
        allActivities = activitiesResult.data;
        allDrivers = driversResult.data;
        allRisks = risksResult.data;
        setIsDemoMode(false);
      }

      setActivities(allActivities);
      setDrivers(allDrivers);
      setRisks(allRisks);

      const selectedActivities = data.selectedActivityCodes.map((code) => {
        const activity = allActivities.find((a) => a.code === code);
        return {
          code,
          baseDays: activity?.base_days || 0,
          isAiSuggested: data.aiSuggestedActivityCodes.includes(code),
        };
      });

      const selectedDrivers = Object.entries(data.selectedDriverValues).map(([code, value]) => {
        const driver = allDrivers.find((d) => d.code === code);
        const option = driver?.options.find((o) => o.value === value);
        return {
          code,
          value,
          multiplier: option?.multiplier || 1.0,
        };
      });

      const selectedRisks = data.selectedRiskCodes.map((code) => {
        const risk = allRisks.find((r) => r.code === code);
        return {
          code,
          weight: risk?.weight || 0,
        };
      });

      const estimationResult = calculateEstimation({
        activities: selectedActivities,
        drivers: selectedDrivers,
        risks: selectedRisks,
      });

      setResult(estimationResult);
    } catch (error) {
      const allActivities = MOCK_ACTIVITIES;
      const allDrivers = MOCK_DRIVERS;
      const allRisks = MOCK_RISKS;

      setActivities(allActivities);
      setDrivers(allDrivers);
      setRisks(allRisks);
      setIsDemoMode(true);

      const selectedActivities = data.selectedActivityCodes.map((code) => {
        const activity = allActivities.find((a) => a.code === code);
        return {
          code,
          baseDays: activity?.base_days || 0,
          isAiSuggested: data.aiSuggestedActivityCodes.includes(code),
        };
      });

      const selectedDrivers = Object.entries(data.selectedDriverValues).map(([code, value]) => {
        const driver = allDrivers.find((d) => d.code === code);
        const option = driver?.options.find((o) => o.value === value);
        return {
          code,
          value,
          multiplier: option?.multiplier || 1.0,
        };
      });

      const selectedRisks = data.selectedRiskCodes.map((code) => {
        const risk = allRisks.find((r) => r.code === code);
        return {
          code,
          weight: risk?.weight || 0,
        };
      });

      const estimationResult = calculateEstimation({
        activities: selectedActivities,
        drivers: selectedDrivers,
        risks: selectedRisks,
      });

      setResult(estimationResult);
    }

    setLoading(false);
  };

  const handleDownloadPDF = () => {
    alert('PDF export coming soon in Phase 2!');
  };

  const handleDownloadCSV = () => {
    alert('CSV export coming soon in Phase 2!');
  };

  if (loading || !result) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-600">Calculating estimation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Estimation Results</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-[11px]">
                  Demo mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600">Full breakdown of effort, drivers, and risks</p>
          </div>
        </div>
        <div className="text-right min-w-[160px]">
          {titleLoading ? (
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500 italic">
              <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Generating title...</span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-900 line-clamp-2">{generatedTitle}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-4xl font-bold text-green-800 leading-tight">
                {result.totalDays.toFixed(2)} days
              </CardTitle>
              <p className="text-xs text-slate-700">Working days including contingency</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <StatRow label="Base days" value={`${result.baseDays.toFixed(2)}`} />
              <StatRow label="Driver multiplier" value={`${result.driverMultiplier.toFixed(3)}x`} emphasize />
              <StatRow label="Subtotal" value={`${result.subtotal.toFixed(2)}`} />
              <StatRow label="Risk score" value={`${result.riskScore}`} emphasize />
              <StatRow label="Contingency" value={`${result.contingencyPercent}%`} />
              <StatRow label="Contingency days" value={`${result.contingencyDays.toFixed(2)}`} />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              <SectionList
                title={`Activities (${data.selectedActivityCodes.length})`}
                items={data.selectedActivityCodes.map((code) => {
                  const activity = activities.find((a) => a.code === code);
                  const isAi = data.aiSuggestedActivityCodes.includes(code);
                  return {
                    key: code,
                    left: activity?.name || code,
                    right: `${activity?.base_days ?? 0}h`,
                    badge: isAi ? 'AI' : undefined,
                  };
                })}
              />

              <SectionList
                title="Drivers"
                items={Object.entries(data.selectedDriverValues).map(([code, value]) => {
                  const driver = drivers.find((d) => d.code === code);
                  const option = driver?.options.find((o) => o.value === value);
                  return {
                    key: code,
                    left: driver?.name || code,
                    right: option ? `${option.label} (${option.multiplier.toFixed(2)}x)` : value,
                  };
                })}
              />

              <SectionList
                title={`Risks (${data.selectedRiskCodes.length})`}
                items={data.selectedRiskCodes.map((code) => {
                  const risk = risks.find((r) => r.code === code);
                  return {
                    key: code,
                    left: risk?.name || code,
                    right: `w: ${risk?.weight ?? 0}`,
                  };
                })}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex-shrink-0 space-y-3 border-t border-slate-200 pt-3 mt-1 bg-white">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="h-11 border-2 border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </Button>
          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            className="h-11 border-2 border-slate-300 hover:bg-slate-50"
          >
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

interface SectionListProps {
  title: string;
  items: { key: string; left: string; right: string; badge?: string }[];
}

function SectionList({ title, items }: SectionListProps) {
  return (
    <div className="space-y-1.5">
      <h4 className="font-bold text-xs text-slate-900">{title}</h4>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
            <span className="text-slate-700 flex items-center gap-1">
              {item.left}
              {item.badge && (
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </span>
            <span className="text-slate-900 font-semibold">{item.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
