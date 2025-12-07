import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_TECHNOLOGY_PRESETS } from '@/lib/mockData';
import type { TechnologyPreset } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep2Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep2({ data, onUpdate, onNext, onBack }: WizardStep2Props) {
  const [presets, setPresets] = useState<TechnologyPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPresets = async () => {
    try {
      const [{ data: presetsData, error: presetsError }, { data: pivotData, error: pivotError }] = await Promise.all([
        supabase
          .from('technology_presets')
          .select('*')
          .order('name'),
        supabase
          .from('technology_preset_activities')
          .select('tech_preset_id, position, activities(code)'),
      ]);

      if (presetsError || !presetsData || presetsData.length === 0) {
        setPresets(MOCK_TECHNOLOGY_PRESETS);
        setIsDemoMode(true);
      } else {
        type PivotRow = { tech_preset_id: string; position: number | null; activities?: { code: string | null } };
        const grouped: Record<string, { code: string | null; position: number | null }[]> = {};
        (pivotData as PivotRow[] | null || []).forEach((row) => {
          const position = row.position ?? null;
          grouped[row.tech_preset_id] = grouped[row.tech_preset_id] || [];
          grouped[row.tech_preset_id].push({
            code: row.activities?.code ?? null,
            position,
          });
        });

        const normalizedPresets = presetsData.map((p) => {
          const rows = grouped[p.id] || [];
          if (rows.length === 0) return p;
          const codes = rows
            .sort((a, b) => {
              const pa = a.position ?? Number.MAX_SAFE_INTEGER;
              const pb = b.position ?? Number.MAX_SAFE_INTEGER;
              return pa - pb;
            })
            .map((r) => r.code)
            .filter((code): code is string => Boolean(code));
          if (codes.length === 0) return p;
          return { ...p, default_activity_codes: codes };
        });

        setPresets(normalizedPresets);
        setIsDemoMode(false);
        if (pivotError) {
          console.warn('Pivot load warning (fallback to presets defaults):', pivotError);
        }
      }
    } catch (error) {
      setPresets(MOCK_TECHNOLOGY_PRESETS);
      setIsDemoMode(true);
    }
    setLoading(false);
  };

  const canProceed = data.techPresetId !== '';

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">Select Technology</h2>
            <p className="text-xs text-slate-600">Pick the closest technology to keep activities relevant</p>
          </div>
        </div>
        {isDemoMode && (
          <Badge variant="secondary" className="text-[11px]">
            Demo mode
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-600 mt-3 font-medium">Loading technologies...</p>
          </div>
        ) : (
          <RadioGroup
            value={data.techPresetId}
            onValueChange={(value) => onUpdate({ techPresetId: value })}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {presets.map((preset) => {
                const isSelected = data.techPresetId === preset.id;
                const defaultCount = preset.default_activity_codes?.length || 0;
                return (
                  <div
                    key={preset.id}
                    className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected
                      ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 shadow-md ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    onClick={() => onUpdate({ techPresetId: preset.id })}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-lg border-2 flex items-center justify-center ${isSelected
                        ? 'border-indigo-500 bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                        : 'border-slate-300 text-slate-500 bg-white'
                        }`}>
                        {isSelected ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <Label htmlFor={preset.id} className="cursor-pointer">
                          <div className={`font-semibold text-base mb-1 transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-900 group-hover:text-indigo-700'
                            }`}>
                            {preset.name}
                          </div>
                          <div className={`text-sm leading-relaxed transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-600'
                            }`}>
                            {preset.description}
                          </div>
                        </Label>
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {preset.tech_category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                            {defaultCount} default activities
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/0 to-purple-500/0 transition-opacity duration-200 pointer-events-none ${!isSelected ? 'group-hover:from-indigo-500/5 group-hover:to-purple-500/5' : ''
                      }`} />

                    <RadioGroupItem value={preset.id} id={preset.id} className="sr-only" />
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 pt-3 mt-1 bg-white">
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={onBack}
            size="lg"
            className="h-11 hover:bg-slate-50 border-slate-300 group"
          >
            <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold text-sm">Back</span>
          </Button>

          <Button
            onClick={onNext}
            disabled={!canProceed}
            size="lg"
            className="h-11 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            <span className="font-semibold text-sm">Next: Select Activities</span>
            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
