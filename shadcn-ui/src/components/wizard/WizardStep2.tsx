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
      const { data: presetsData, error } = await supabase
        .from('technology_presets')
        .select('*')
        .order('name');

      if (error || !presetsData || presetsData.length === 0) {
        setPresets(MOCK_TECHNOLOGY_PRESETS);
        setIsDemoMode(true);
      } else {
        setPresets(presetsData);
        setIsDemoMode(false);
      }
    } catch (error) {
      setPresets(MOCK_TECHNOLOGY_PRESETS);
      setIsDemoMode(true);
    }
    setLoading(false);
  };

  const canProceed = data.techPresetId !== '';

  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="flex-shrink-0 space-y-1 mb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Select Technology</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Choose the technology stack that best matches your requirement
            </p>
          </div>
        </div>

        {isDemoMode && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              <strong>Demo Mode:</strong> Using sample data. Configure Supabase to use real database.
            </span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600 mt-4">Loading presets...</p>
          </div>
        ) : (
          <RadioGroup
            value={data.techPresetId}
            onValueChange={(value) => onUpdate({ techPresetId: value })}
          >
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="group relative flex items-start space-x-3 p-3 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 cursor-pointer transition-all duration-300 hover:shadow-md"
                  onClick={() => onUpdate({ techPresetId: preset.id })}
                >
                  <RadioGroupItem value={preset.id} id={preset.id} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={preset.id} className="cursor-pointer">
                      <div className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {preset.name}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {preset.description}
                      </div>
                    </Label>
                  </div>
                  {data.techPresetId === preset.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </RadioGroup>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 pt-4 mt-4 bg-white">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="hover:bg-slate-50">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Button>

          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Next: Select Activities</span>
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
