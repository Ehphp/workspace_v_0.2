import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [driversResult, risksResult] = await Promise.all([
      supabase.from('drivers').select('*').order('code'),
      supabase.from('risks').select('*').order('code'),
    ]);

    setDrivers(driversResult.data || []);
    setRisks(risksResult.data || []);
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
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Drivers & Risks</h2>
        <p className="text-muted-foreground">
          Configure estimation drivers and select relevant risks.
        </p>
      </div>

      {/* Drivers Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Drivers (Multipliers)</h3>
        {drivers.map((driver) => {
          const selectedValue = data.selectedDriverValues[driver.code];
          const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

          return (
            <div key={driver.code} className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor={driver.code}>{driver.name}</Label>
                {selectedOption && (
                  <span className="text-sm text-muted-foreground">
                    {selectedOption.multiplier.toFixed(2)}x
                  </span>
                )}
              </div>
              <Select
                value={selectedValue}
                onValueChange={(value) => updateDriverValue(driver.code, value)}
              >
                <SelectTrigger id={driver.code}>
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
              <p className="text-sm text-muted-foreground">{driver.description}</p>
            </div>
          );
        })}
      </div>

      {/* Risks Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Risks</h3>
        <div className="space-y-2">
          {risks.map((risk) => {
            const isSelected = data.selectedRiskCodes.includes(risk.code);

            return (
              <div
                key={risk.code}
                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent"
              >
                <Checkbox
                  id={risk.code}
                  checked={isSelected}
                  onCheckedChange={() => toggleRisk(risk.code)}
                />
                <div className="flex-1">
                  <label htmlFor={risk.code} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{risk.name}</span>
                      <span className="text-sm text-muted-foreground">(weight: {risk.weight})</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Risk Score: {riskScore}</p>
              <p className="text-sm text-muted-foreground">Contingency: {contingency}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next: View Results
        </Button>
      </div>
    </div>
  );
}