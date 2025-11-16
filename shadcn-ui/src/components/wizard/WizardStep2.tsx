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
        // Fallback to mock data
        console.log('Using mock data for technology presets');
        setPresets(MOCK_TECHNOLOGY_PRESETS);
        setIsDemoMode(true);
      } else {
        setPresets(presetsData);
        setIsDemoMode(false);
      }
    } catch (error) {
      // If Supabase is not configured or connection fails, use mock data
      console.log('Supabase connection failed, using mock data');
      setPresets(MOCK_TECHNOLOGY_PRESETS);
      setIsDemoMode(true);
    }
    setLoading(false);
  };

  const canProceed = data.techPresetId !== '';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold">Select Technology</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs">
              Demo Mode
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Choose the technology stack that best matches your requirement.
        </p>
        {isDemoMode && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="text-amber-800">
              <strong>Demo Mode:</strong> Using sample data. Configure Supabase in .env to use real database.
            </p>
          </div>
        )}
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