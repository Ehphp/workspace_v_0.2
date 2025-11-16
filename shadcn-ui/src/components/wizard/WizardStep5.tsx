import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    calculateResult();
  }, []);

  const calculateResult = async () => {
    // Load all data
    const [activitiesResult, driversResult, risksResult] = await Promise.all([
      supabase.from('activities').select('*'),
      supabase.from('drivers').select('*'),
      supabase.from('risks').select('*'),
    ]);

    const allActivities = activitiesResult.data || [];
    const allDrivers = driversResult.data || [];
    const allRisks = risksResult.data || [];

    setActivities(allActivities);
    setDrivers(allDrivers);
    setRisks(allRisks);

    // Prepare input for estimation engine
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
    setLoading(false);
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export coming soon!');
  };

  const handleDownloadCSV = () => {
    // TODO: Implement CSV export
    alert('CSV export coming soon!');
  };

  if (loading || !result) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Estimation Results</h2>
        <p className="text-muted-foreground">
          Here's the calculated effort for your requirement.
        </p>
      </div>

      {/* Summary Card */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="text-center text-3xl">
            {result.totalDays.toFixed(2)} Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Days:</span>
              <span className="font-medium">{result.baseDays.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Driver Multiplier:</span>
              <span className="font-medium">{result.driverMultiplier.toFixed(3)}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">{result.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Risk Score:</span>
              <span className="font-medium">{result.riskScore}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contingency ({result.contingencyPercent}%):</span>
              <span className="font-medium">{result.contingencyDays.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold">
              <span>Total Days:</span>
              <span>{result.totalDays.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Selected Activities ({data.selectedActivityCodes.length})</h4>
              <div className="space-y-1 text-sm">
                {data.selectedActivityCodes.map((code) => {
                  const activity = activities.find((a) => a.code === code);
                  const isAi = data.aiSuggestedActivityCodes.includes(code);
                  return (
                    <div key={code} className="flex justify-between">
                      <span>
                        {activity?.name || code}
                        {isAi && <span className="text-blue-600 ml-2">🤖</span>}
                      </span>
                      <span className="text-muted-foreground">{activity?.base_days} days</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Drivers</h4>
              <div className="space-y-1 text-sm">
                {Object.entries(data.selectedDriverValues).map(([code, value]) => {
                  const driver = drivers.find((d) => d.code === code);
                  const option = driver?.options.find((o) => o.value === value);
                  return (
                    <div key={code} className="flex justify-between">
                      <span>{driver?.name || code}</span>
                      <span className="text-muted-foreground">
                        {option?.label} ({option?.multiplier.toFixed(2)}x)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Risks ({data.selectedRiskCodes.length})</h4>
              <div className="space-y-1 text-sm">
                {data.selectedRiskCodes.map((code) => {
                  const risk = risks.find((r) => r.code === code);
                  return (
                    <div key={code} className="flex justify-between">
                      <span>{risk?.name || code}</span>
                      <span className="text-muted-foreground">weight: {risk?.weight}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} variant="outline" className="flex-1">
            📄 Download PDF
          </Button>
          <Button onClick={handleDownloadCSV} variant="outline" className="flex-1">
            📊 Download CSV
          </Button>
        </div>

        <Button onClick={() => navigate('/register')} className="w-full" size="lg">
          Create Account to Save This Estimation
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button variant="outline" onClick={onReset} className="flex-1">
            Start New Estimation
          </Button>
        </div>
      </div>
    </div>
  );
}