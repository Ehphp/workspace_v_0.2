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
      // Load preset
      const { data: presetData, error: presetError } = await supabase
        .from('technology_presets')
        .select('*')
        .eq('id', data.techPresetId)
        .single();

      let currentPreset: TechnologyPreset | null = null;

      if (presetError || !presetData) {
        // Fallback to mock preset
        currentPreset = MOCK_TECHNOLOGY_PRESETS.find(p => p.id === data.techPresetId) || MOCK_TECHNOLOGY_PRESETS[0];
        setIsDemoMode(true);
      } else {
        currentPreset = presetData;
        setIsDemoMode(false);
      }

      setPreset(currentPreset);

      if (currentPreset) {
        // Load activities for this tech category
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .or(`tech_category.eq.${currentPreset.tech_category},tech_category.eq.MULTI`)
          .eq('active', true)
          .order('group');

        if (activitiesError || !activitiesData || activitiesData.length === 0) {
          // Fallback to mock activities
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
      // Use mock data on error
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
      // Check if OpenAI is configured
      const hasOpenAI = import.meta.env.VITE_OPENAI_API_KEY && 
                        import.meta.env.VITE_OPENAI_API_KEY !== 'sk-placeholder-replace-with-your-openai-key';

      let suggestedCodes: string[];

      if (hasOpenAI && !isDemoMode) {
        // Try to use real AI
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

          // Update wizard data with AI suggestions
          onUpdate({
            selectedActivityCodes: suggestedCodes,
            aiSuggestedActivityCodes: suggestedCodes,
            selectedDriverValues: suggestion.suggestedDrivers || preset.default_driver_values,
            selectedRiskCodes: suggestion.suggestedRisks || preset.default_risks,
          });
        } catch (error) {
          console.error('AI suggestion failed, using smart mock:', error);
          suggestedCodes = getMockAISuggestions(data.description, preset);
          onUpdate({
            selectedActivityCodes: suggestedCodes,
            aiSuggestedActivityCodes: suggestedCodes,
            selectedDriverValues: preset.default_driver_values,
            selectedRiskCodes: preset.default_risks,
          });
        }
      } else {
        // Use smart mock suggestions
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
      console.error('AI suggestion error:', error);
      // Ultimate fallback to preset defaults
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
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold">Select Activities</h2>
          {isDemoMode && (
            <Badge variant="secondary" className="text-xs">
              Demo Mode
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Let AI suggest activities or select them manually.
        </p>
      </div>

      {!aiUsed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm mb-3">
            {isDemoMode 
              ? '🎯 Click below to get smart suggestions based on keywords in your description (Demo Mode - no AI required)'
              : '🤖 Click below to have AI analyze your requirement and suggest relevant activities'}
          </p>
          <Button onClick={handleAISuggest} disabled={aiLoading}>
            {aiLoading ? 'Analyzing...' : isDemoMode ? '🎯 Get Smart Suggestions' : '🤖 Get AI Suggestions'}
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
                              {isDemoMode ? '🎯' : 'AI'}
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