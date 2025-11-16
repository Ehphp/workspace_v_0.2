import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_DRIVERS, MOCK_RISKS } from '@/lib/mockData';
import type { Driver, Risk } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep4Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep4({ data, onUpdate, onNext, onBack }: WizardStep4Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [driversResult, risksResult] = await Promise.all([
        supabase.from('drivers').select('*').order('code'),
        supabase.from('risks').select('*').order('code'),
      ]);

      if (driversResult.error || !driversResult.data || driversResult.data.length === 0 ||
          risksResult.error || !risksResult.data || risksResult.data.length === 0) {
        setDrivers(MOCK_DRIVERS);
        setRisks(MOCK_RISKS);
        setIsDemoMode(true);
      } else {
        setDrivers(driversResult.data);
        setRisks(risksResult.data);
        setIsDemoMode(false);
      }
    } catch (error) {
      setDrivers(MOCK_DRIVERS);
      setRisks(MOCK_RISKS);
      setIsDemoMode(true);
    }

    setLoading(false);
  };

  const updateDriverValue = (driverCode: string, value: string) => {
    onUpdate({
      selectedDriverValues: {
        ...data.selectedDriverValues,
        [driverCode]: value,
      },
    });
  };

  const toggleRisk = (riskCode: string) => {
    const newRisks = data.selectedRiskCodes.includes(riskCode)
      ? data.selectedRiskCodes.filter((c) => c !== riskCode)
      : [...data.selectedRiskCodes, riskCode];
    onUpdate({ selectedRiskCodes: newRisks });
  };

  const calculateRiskScore = () => {
    return data.selectedRiskCodes.reduce((sum, code) => {
      const risk = risks.find((r) => r.code === code);
      return sum + (risk?.weight || 0);
    }, 0);
  };

  const getContingency = (riskScore: number) => {
    if (riskScore <= 10) return 10;
    if (riskScore <= 20) return 15;
    if (riskScore <= 30) return 20;
    return 25;
  };

  const riskScore = calculateRiskScore();
  const contingency = getContingency(riskScore);

  if (loading) {
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
          <h2 className="text-lg font-semibold text-slate-900">Drivers & Risks</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs h-5">
              Demo
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Configure estimation drivers and select relevant risks.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Drivers Section */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-slate-900">Drivers (Multipliers)</h3>
          {drivers.map((driver) => {
            const selectedValue = data.selectedDriverValues[driver.code];
            const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

            return (
              <div key={driver.code} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor={driver.code} className="text-sm font-medium">{driver.name}</Label>
                  {selectedOption && (
                    <span className="text-xs text-slate-500">
                      {selectedOption.multiplier.toFixed(2)}x
                    </span>
                  )}
                </div>
                <Select
                  value={selectedValue}
                  onValueChange={(value) => updateDriverValue(driver.code, value)}
                >
                  <SelectTrigger id={driver.code} className="h-9">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    {driver.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.multiplier.toFixed(2)}x)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">{driver.description}</p>
              </div>
            );
          })}
        </div>

        {/* Risks Section */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-slate-900">Risks</h3>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
            {risks.map((risk) => {
              const isSelected = data.selectedRiskCodes.includes(risk.code);

              return (
                <div
                  key={risk.code}
                  className="flex items-start space-x-2.5 p-2 border border-slate-200 rounded hover:bg-slate-50"
                >
                  <Checkbox
                    id={risk.code}
                    checked={isSelected}
                    onCheckedChange={() => toggleRisk(risk.code)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={risk.code} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{risk.name}</span>
                        <span className="text-xs text-slate-500">(w: {risk.weight})</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{risk.description}</p>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <div className="flex justify-between items-center text-sm">
              <div>
                <p className="font-medium text-slate-900">Risk Score: {riskScore}</p>
                <p className="text-xs text-slate-600">Contingency: {contingency}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} size="sm">
          Back
        </Button>
        <Button onClick={onNext} size="sm">
          Next: View Results
        </Button>
      </div>
    </div>
  );
}