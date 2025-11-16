import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { MOCK_ACTIVITIES, MOCK_TECHNOLOGY_PRESETS, MOCK_DRIVERS, MOCK_RISKS, getMockAISuggestions } from '@/lib/mockData';
import type { Activity, TechnologyPreset } from '@/types/database';
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
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: presetData, error: presetError } = await supabase
        .from('technology_presets')
        .select('*')
        .eq('id', data.techPresetId)
        .single();

      let currentPreset: TechnologyPreset | null = null;

      if (presetError || !presetData) {
        currentPreset = MOCK_TECHNOLOGY_PRESETS.find(p => p.id === data.techPresetId) || MOCK_TECHNOLOGY_PRESETS[0];
        setIsDemoMode(true);
      } else {
        currentPreset = presetData;
        setIsDemoMode(false);
      }

      setPreset(currentPreset);

      if (currentPreset) {
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .or(`tech_category.eq.${currentPreset.tech_category},tech_category.eq.MULTI`)
          .eq('active', true)
          .order('group');

        if (activitiesError || !activitiesData || activitiesData.length === 0) {
          const mockActivities = MOCK_ACTIVITIES.filter(
            a => a.tech_category === currentPreset!.tech_category || a.tech_category === 'MULTI'
          );
          setActivities(mockActivities);
          setIsDemoMode(true);
        } else {
          setActivities(activitiesData);
        }
      }
    } catch (error) {
      const currentPreset = MOCK_TECHNOLOGY_PRESETS.find(p => p.id === data.techPresetId) || MOCK_TECHNOLOGY_PRESETS[0];
      setPreset(currentPreset);
      const mockActivities = MOCK_ACTIVITIES.filter(
        a => a.tech_category === currentPreset.tech_category || a.tech_category === 'MULTI'
      );
      setActivities(mockActivities);
      setIsDemoMode(true);
    }

    setLoading(false);
  };

  const handleAISuggest = async () => {
    if (!preset) return;

    setAiLoading(true);
    try {
      const hasOpenAI = import.meta.env.VITE_OPENAI_API_KEY && 
                        import.meta.env.VITE_OPENAI_API_KEY !== 'sk-placeholder-replace-with-your-openai-key';

      let suggestedCodes: string[];

      if (hasOpenAI && !isDemoMode) {
        try {
          const { suggestActivities } = await import('@/lib/openai');
          const { data: driversData } = await supabase.from('drivers').select('*');
          const { data: risksData } = await supabase.from('risks').select('*');

          const suggestion = await suggestActivities({
            description: data.description,
            preset,
            activities,
            drivers: driversData || MOCK_DRIVERS,
            risks: risksData || MOCK_RISKS,
          });

          suggestedCodes = suggestion.activityCodes;

          onUpdate({
            selectedActivityCodes: suggestedCodes,
            aiSuggestedActivityCodes: suggestedCodes,
            selectedDriverValues: suggestion.suggestedDrivers || preset.default_driver_values,
            selectedRiskCodes: suggestion.suggestedRisks || preset.default_risks,
          });
        } catch (error) {
          suggestedCodes = getMockAISuggestions(data.description, preset);
          onUpdate({
            selectedActivityCodes: suggestedCodes,
            aiSuggestedActivityCodes: suggestedCodes,
            selectedDriverValues: preset.default_driver_values,
            selectedRiskCodes: preset.default_risks,
          });
        }
      } else {
        suggestedCodes = getMockAISuggestions(data.description, preset);
        onUpdate({
          selectedActivityCodes: suggestedCodes,
          aiSuggestedActivityCodes: suggestedCodes,
          selectedDriverValues: preset.default_driver_values,
          selectedRiskCodes: preset.default_risks,
        });
      }

      setAiUsed(true);
    } catch (error) {
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
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-slate-900">Select Activities</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs h-5">
              Demo
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Let AI suggest activities or select them manually.
        </p>
      </div>

      {!aiUsed && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-xs mb-2 text-slate-700">
            {isDemoMode 
              ? '🎯 Get smart suggestions based on keywords in your description (Demo Mode)'
              : '🤖 Have AI analyze your requirement and suggest relevant activities'}
          </p>
          <Button onClick={handleAISuggest} disabled={aiLoading} size="sm">
            {aiLoading ? 'Analyzing...' : isDemoMode ? '🎯 Get Smart Suggestions' : '🤖 Get AI Suggestions'}
          </Button>
        </div>
      )}

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {Object.entries(groupedActivities).map(([group, groupActivities]) => (
          <div key={group}>
            <h3 className="font-medium text-sm mb-2 text-slate-900">{group}</h3>
            <div className="space-y-1.5">
              {groupActivities.map((activity) => {
                const isSelected = data.selectedActivityCodes.includes(activity.code);
                const isAiSuggested = data.aiSuggestedActivityCodes.includes(activity.code);

                return (
                  <div
                    key={activity.code}
                    className="flex items-start space-x-2.5 p-2 border border-slate-200 rounded hover:bg-slate-50"
                  >
                    <Checkbox
                      id={activity.code}
                      checked={isSelected}
                      onCheckedChange={() => toggleActivity(activity.code)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={activity.code} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-slate-900">{activity.name}</span>
                          <span className="text-xs text-slate-500">
                            ({activity.base_days}d)
                          </span>
                          {isAiSuggested && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              {isDemoMode ? '🎯' : 'AI'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
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

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} size="sm">
          Back
        </Button>
        <Button onClick={onNext} disabled={data.selectedActivityCodes.length === 0} size="sm">
          Next: Drivers & Risks
        </Button>
      </div>
    </div>
  );
}