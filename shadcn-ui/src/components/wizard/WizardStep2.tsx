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
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-slate-900">Select Technology</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs h-5">
              Demo
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Choose the technology stack that best matches your requirement.
        </p>
        {isDemoMode && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>Demo Mode:</strong> Using sample data. Configure Supabase in .env to use real database.
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <RadioGroup value={data.techPresetId} onValueChange={(value) => onUpdate({ techPresetId: value })}>
          <div className="space-y-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-start space-x-2.5 p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                onClick={() => onUpdate({ techPresetId: preset.id })}
              >
                <RadioGroupItem value={preset.id} id={preset.id} className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor={preset.id} className="cursor-pointer">
                    <div className="font-medium text-sm text-slate-900">{preset.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{preset.description}</div>
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} size="sm">
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed} size="sm">
          Next: AI Suggestions
        </Button>
      </div>
    </div>
  );
}