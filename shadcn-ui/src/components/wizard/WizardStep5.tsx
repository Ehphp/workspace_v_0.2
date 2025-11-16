import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_ACTIVITIES, MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import { calculateEstimation } from '@/lib/estimationEngine';
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

  useEffect(() => {
    calculateResult();
  }, []);

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
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-slate-900">Estimation Results</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs h-5">
              Demo
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Calculated effort estimation for your requirement.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Summary Card */}
        <Card className="border-primary border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-2xl font-semibold">
              {result.totalDays.toFixed(2)} Days
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Base Days:</span>
                <span className="font-medium">{result.baseDays.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Driver Multiplier:</span>
                <span className="font-medium">{result.driverMultiplier.toFixed(3)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium">{result.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Risk Score:</span>
                <span className="font-medium">{result.riskScore}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Contingency ({result.contingencyPercent}%):</span>
                <span className="font-medium">{result.contingencyDays.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex justify-between text-sm font-semibold">
                <span>Total Days:</span>
                <span>{result.totalDays.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 max-h-[280px] overflow-y-auto">
            <div>
              <h4 className="font-medium text-xs mb-1.5 text-slate-900">Activities ({data.selectedActivityCodes.length})</h4>
              <div className="space-y-1 text-xs">
                {data.selectedActivityCodes.map((code) => {
                  const activity = activities.find((a) => a.code === code);
                  const isAi = data.aiSuggestedActivityCodes.includes(code);
                  return (
                    <div key={code} className="flex justify-between">
                      <span className="text-slate-700">
                        {activity?.name || code}
                        {isAi && <span className="text-blue-600 ml-1">{isDemoMode ? '🎯' : '🤖'}</span>}
                      </span>
                      <span className="text-slate-500">{activity?.base_days}d</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-xs mb-1.5 text-slate-900">Drivers</h4>
              <div className="space-y-1 text-xs">
                {Object.entries(data.selectedDriverValues).map(([code, value]) => {
                  const driver = drivers.find((d) => d.code === code);
                  const option = driver?.options.find((o) => o.value === value);
                  return (
                    <div key={code} className="flex justify-between">
                      <span className="text-slate-700">{driver?.name || code}</span>
                      <span className="text-slate-500">
                        {option?.label} ({option?.multiplier.toFixed(2)}x)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-xs mb-1.5 text-slate-900">Risks ({data.selectedRiskCodes.length})</h4>
              <div className="space-y-1 text-xs">
                {data.selectedRiskCodes.map((code) => {
                  const risk = risks.find((r) => r.code === code);
                  return (
                    <div key={code} className="flex justify-between">
                      <span className="text-slate-700">{risk?.name || code}</span>
                      <span className="text-slate-500">w: {risk?.weight}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleDownloadPDF} variant="outline" size="sm">
            📄 PDF
          </Button>
          <Button onClick={handleDownloadCSV} variant="outline" size="sm">
            📊 CSV
          </Button>
        </div>

        {isDemoMode && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            <strong>Save this estimation:</strong> Configure Supabase to enable authentication and save to your account.
          </div>
        )}

        <Button onClick={() => navigate('/register')} className="w-full" size="sm">
          Create Account to Save
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onBack} size="sm">
            Back
          </Button>
          <Button variant="outline" onClick={onReset} size="sm">
            New Estimation
          </Button>
        </div>
      </div>
    </div>
  );
}