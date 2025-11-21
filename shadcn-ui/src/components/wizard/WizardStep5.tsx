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
  onBack: () => void;
  onReset: () => void;
}

export function WizardStep5({ data, onBack, onReset }: WizardStep5Props) {
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
    if (!data.description) {
      setGeneratedTitle('Untitled Requirement');
      setTitleLoading(false);
      return;
    }

    try {
      setTitleLoading(true);
      const title = await generateTitleFromDescription(data.description);
      setGeneratedTitle(title);
    } catch (error) {
      console.error('Error generating title:', error);
      setGeneratedTitle(data.description.substring(0, 100));
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
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-slate-600 mt-4">Calculating estimation...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Estimation Results</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
            <div className="mt-2">
              {titleLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-500 italic">Generating title with AI...</p>
                </div>
              ) : (
                <p className="text-sm text-slate-900 font-semibold">{generatedTitle}</p>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Your calculated effort estimation with full transparency
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-xl">
          <CardHeader className="pb-4 text-center">
            <div className="inline-block mx-auto px-4 py-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 text-white mb-3">
              <svg className="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">Estimated Total</span>
            </div>
            <CardTitle className="text-5xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
              {result.totalDays.toFixed(2)}
            </CardTitle>
            <p className="text-sm font-medium text-slate-600 mt-1">Working Days</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/60">
                <span className="text-slate-600 font-medium">Base Days:</span>
                <span className="font-bold text-slate-900">{result.baseDays.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/60">
                <span className="text-slate-600 font-medium">Driver Multiplier:</span>
                <span className="font-bold text-blue-600">{result.driverMultiplier.toFixed(3)}x</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/60">
                <span className="text-slate-600 font-medium">Subtotal:</span>
                <span className="font-bold text-slate-900">{result.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/60">
                <span className="text-slate-600 font-medium">Risk Score:</span>
                <span className="font-bold text-amber-600">{result.riskScore}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white/60">
                <span className="text-slate-600 font-medium">Contingency ({result.contingencyPercent}%):</span>
                <span className="font-bold text-slate-900">{result.contingencyDays.toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-green-300 pt-3 mt-3 flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-green-100 to-emerald-100">
                <span className="font-bold text-slate-900">Final Total:</span>
                <span className="text-2xl font-bold text-green-700">{result.totalDays.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 bg-white/60 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Breakdown Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 max-h-[240px] overflow-y-auto pr-2">
            <div>
              <h4 className="font-bold text-xs mb-1.5 text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                  {data.selectedActivityCodes.length}
                </div>
                Activities
              </h4>
              <div className="space-y-2 text-xs">
                {data.selectedActivityCodes.map((code) => {
                  const activity = activities.find((a) => a.code === code);
                  const isAi = data.aiSuggestedActivityCodes.includes(code);
                  return (
                    <div key={code} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <span className="text-slate-700 font-medium flex items-center gap-1">
                        {activity?.name || code}
                        {isAi && (
                          <span className="text-purple-600 font-semibold">
                            {isDemoMode ? '🎯' : '🤖'}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-900 font-bold bg-white px-2 py-0.5 rounded">{activity?.base_days}d</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs mb-1.5 text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                Drivers
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(data.selectedDriverValues).map(([code, value]) => {
                  const driver = drivers.find((d) => d.code === code);
                  const option = driver?.options.find((o) => o.value === value);
                  return (
                    <div key={code} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <span className="text-slate-700 font-medium">{driver?.name || code}</span>
                      <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                        {option?.label} ({option?.multiplier.toFixed(2)}x)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs mb-1.5 text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center text-white text-xs font-bold">
                  {data.selectedRiskCodes.length}
                </div>
                Risks
              </h4>
              <div className="space-y-2 text-xs">
                {data.selectedRiskCodes.map((code) => {
                  const risk = risks.find((r) => r.code === code);
                  return (
                    <div key={code} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <span className="text-slate-700 font-medium">{risk?.name || code}</span>
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">w: {risk?.weight}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            className="border-2 border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </Button>
          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            className="border-2 border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
        </div>

        {isDemoMode && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">Save Your Estimation</p>
                <p className="text-xs text-blue-700">Configure Supabase to enable authentication and save estimations to your account.</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={() => navigate('/register')}
          className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span className="font-semibold">Create Account to Save Estimation</span>
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onBack} className="border-2 hover:bg-slate-50">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
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