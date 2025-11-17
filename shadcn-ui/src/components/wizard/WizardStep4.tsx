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
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Drivers & Risks</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Configure complexity multipliers and identify project risks
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Drivers Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-base text-slate-900">Drivers (Multipliers)</h3>
          </div>
          {drivers.map((driver) => {
            const selectedValue = data.selectedDriverValues[driver.code];
            const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

            return (
              <div key={driver.code} className="space-y-2 p-4 rounded-xl border-2 border-slate-200 bg-white/50 hover:border-blue-300 transition-all duration-300">
                <div className="flex justify-between items-center">
                  <Label htmlFor={driver.code} className="text-sm font-bold text-slate-900">{driver.name}</Label>
                  {selectedOption && (
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {selectedOption.multiplier.toFixed(2)}x
                    </span>
                  )}
                </div>
                <Select
                  value={selectedValue}
                  onValueChange={(value) => updateDriverValue(driver.code, value)}
                >
                  <SelectTrigger id={driver.code} className="h-11 border-slate-300 focus:border-blue-500">
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
                <p className="text-xs text-slate-600">{driver.description}</p>
              </div>
            );
          })}
        </div>

        {/* Risks Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-bold text-base text-slate-900">Project Risks</h3>
          </div>
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
            {risks.map((risk) => {
              const isSelected = data.selectedRiskCodes.includes(risk.code);

              return (
                <div
                  key={risk.code}
                  className={`group flex items-start space-x-3 p-3 border-2 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                      ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-red-50 shadow-md'
                      : 'border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
                    }`}
                  onClick={() => toggleRisk(risk.code)}
                >
                  <Checkbox
                    id={risk.code}
                    checked={isSelected}
                    onCheckedChange={() => toggleRisk(risk.code)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={risk.code} className="cursor-pointer">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">{risk.name}</span>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          weight: {risk.weight}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{risk.description}</p>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900 mb-1">Risk Assessment</p>
                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-xs text-slate-600">Score: </span>
                    <span className="text-lg font-bold text-amber-700">{riskScore}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-600">Contingency: </span>
                    <span className="text-lg font-bold text-amber-700">{contingency}%</span>
                  </div>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="hover:bg-slate-50">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <span>View Results</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </Button>
      </div>
    </div>
  );
}