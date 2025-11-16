import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { suggestActivities } from '@/lib/openai';
import type { Activity, TechnologyPreset, Driver, Risk } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep3Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep3({ data, onUpdate, onNext, onBack }: WizardStep3Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [preset, setPreset] = useState<TechnologyPreset | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load preset
    const { data: presetData } = await supabase
      .from('technology_presets')
      .select('*')
      .eq('id', data.techPresetId)
      .single();

    if (presetData) {
      setPreset(presetData);

      // Load activities for this tech category
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('*')
        .or(`tech_category.eq.${presetData.tech_category},tech_category.eq.MULTI`)
        .eq('active', true)
        .order('group');

      setActivities(activitiesData || []);
    }

    setLoading(false);
  };

  const handleAISuggest = async () => {
    if (!preset) return;

    setAiLoading(true);
    try {
      // Load all required data for AI
      const { data: driversData } = await supabase.from('drivers').select('*');
      const { data: risksData } = await supabase.from('risks').select('*');

      const suggestion = await suggestActivities({
        description: data.description,
        preset,
        activities,
        drivers: driversData || [],
        risks: risksData || [],
      });

      // Update wizard data with AI suggestions
      onUpdate({
        selectedActivityCodes: suggestion.activityCodes,
        aiSuggestedActivityCodes: suggestion.activityCodes,
        selectedDriverValues: suggestion.suggestedDrivers || preset.default_driver_values,
        selectedRiskCodes: suggestion.suggestedRisks || preset.default_risks,
      });

      setAiUsed(true);
    } catch (error) {
      console.error('AI suggestion error:', error);
      // Fallback to preset defaults
      onUpdate({
        selectedActivityCodes: preset.default_activity_codes,
        aiSuggestedActivityCodes: preset.default_activity_codes,
        selectedDriverValues: preset.default_driver_values,
        selectedRiskCodes: preset.default_risks,
      });
      setAiUsed(true);
    }
    setAiLoading(false);
  };

  const toggleActivity = (code: string) => {
    const newSelected = data.selectedActivityCodes.includes(code)
      ? data.selectedActivityCodes.filter((c) => c !== code)
      : [...data.selectedActivityCodes, code];
    onUpdate({ selectedActivityCodes: newSelected });
  };

  const groupedActivities = activities.reduce((acc, activity) => {
    if (!acc[activity.group]) {
      acc[activity.group] = [];
    }
    acc[activity.group].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

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
        <h2 className="text-2xl font-bold mb-2">Select Activities</h2>
        <p className="text-muted-foreground">
          Let AI suggest activities or select them manually.
        </p>
      </div>

      {!aiUsed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm mb-3">
            Click below to have AI analyze your requirement and suggest relevant activities based on
            the description and technology preset.
          </p>
          <Button onClick={handleAISuggest} disabled={aiLoading}>
            {aiLoading ? 'AI is analyzing...' : '🤖 Get AI Suggestions'}
          </Button>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(groupedActivities).map(([group, groupActivities]) => (
          <div key={group}>
            <h3 className="font-semibold text-lg mb-3">{group}</h3>
            <div className="space-y-2">
              {groupActivities.map((activity) => {
                const isSelected = data.selectedActivityCodes.includes(activity.code);
                const isAiSuggested = data.aiSuggestedActivityCodes.includes(activity.code);

                return (
                  <div
                    key={activity.code}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent"
                  >
                    <Checkbox
                      id={activity.code}
                      checked={isSelected}
                      onCheckedChange={() => toggleActivity(activity.code)}
                    />
                    <div className="flex-1">
                      <label htmlFor={activity.code} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{activity.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({activity.base_days} days)
                          </span>
                          {isAiSuggested && (
                            <Badge variant="secondary" className="text-xs">
                              AI
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={data.selectedActivityCodes.length === 0}>
          Next: Drivers & Risks
        </Button>
      </div>
    </div>
  );
}