import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    const { data: presetsData, error } = await supabase
      .from('technology_presets')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading presets:', error);
    } else {
      setPresets(presetsData || []);
    }
    setLoading(false);
  };

  const canProceed = data.techPresetId !== '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Technology</h2>
        <p className="text-muted-foreground">
          Choose the technology stack that best matches your requirement.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <RadioGroup value={data.techPresetId} onValueChange={(value) => onUpdate({ techPresetId: value })}>
          <div className="space-y-3">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent cursor-pointer"
                onClick={() => onUpdate({ techPresetId: preset.id })}
              >
                <RadioGroupItem value={preset.id} id={preset.id} />
                <div className="flex-1">
                  <Label htmlFor={preset.id} className="cursor-pointer">
                    <div className="font-semibold">{preset.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">{preset.description}</div>
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next: AI Suggestions
        </Button>
      </div>
    </div>
  );
}