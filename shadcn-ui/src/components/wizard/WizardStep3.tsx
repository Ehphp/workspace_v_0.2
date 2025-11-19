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
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadData();
  }, []);

  // Auto-trigger AI when data is loaded (only once)
  useEffect(() => {
    if (!loading && !aiUsed && !aiLoading && preset && data.description && data.selectedActivityCodes.length === 0) {
      handleAISuggest();
    }
  }, [loading, preset]);

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
    setAiStatus('analyzing');
    try {
      // Always try AI first (Netlify function handles server-side API key)
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

      // Check if the requirement is valid
      if (!suggestion.isValidRequirement) {
        console.warn('AI determined requirement is not valid:', suggestion.reasoning);
        // Fall back to preset defaults for invalid requirements
        onUpdate({
          selectedActivityCodes: preset.default_activity_codes,
          aiSuggestedActivityCodes: preset.default_activity_codes,
        });
        setAiUsed(true);
        setAiStatus('success');
        setAiLoading(false);
        return;
      }

      const suggestedCodes = suggestion.activityCodes;

      // If GPT didn't suggest any activities (e.g., description too short),
      // fall back to preset defaults
      if (!suggestedCodes || suggestedCodes.length === 0) {
        console.warn('AI returned no activities, using preset defaults');
        onUpdate({
          selectedActivityCodes: preset.default_activity_codes,
          aiSuggestedActivityCodes: preset.default_activity_codes,
        });
        setAiUsed(true);
        setAiStatus('success');
        setAiLoading(false);
        return;
      }

      onUpdate({
        selectedActivityCodes: suggestedCodes,
        aiSuggestedActivityCodes: suggestedCodes,
      });

      setAiUsed(true);
      setAiStatus('success');
    } catch (error) {
      console.error('AI suggestion failed, using preset defaults:', error);

      // Fallback to preset defaults on any error
      onUpdate({
        selectedActivityCodes: preset.default_activity_codes,
        aiSuggestedActivityCodes: preset.default_activity_codes,
      });
      setAiUsed(true);
      setAiStatus('error');
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
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Select Activities</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-xs">
                  Demo Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              AI is analyzing your requirement to suggest relevant activities
            </p>
          </div>
        </div>
      </div>

      {/* AI Status Banner */}
      {aiLoading && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                {isDemoMode ? '🎯 Analyzing Keywords...' : '🤖 AI is Thinking...'}
              </p>
              <p className="text-xs text-purple-700 mt-1">
                {isDemoMode
                  ? 'Scanning your description for relevant keywords and patterns'
                  : 'Analyzing requirement complexity and suggesting optimal activities'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Success Banner */}
      {aiUsed && aiStatus === 'success' && (
        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">
                ✨ {data.selectedActivityCodes.length} Activities Suggested
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Review and adjust the selection below as needed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Error Banner */}
      {aiUsed && aiStatus === 'error' && (
        <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Using Default Activities
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                AI unavailable - using preset recommendations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Activities List */}
      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2">
        {Object.entries(groupedActivities).map(([group, groupActivities]) => (
          <div key={group}>
            <h3 className="font-bold text-sm mb-3 text-slate-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
              {group}
            </h3>
            <div className="space-y-2">
              {groupActivities.map((activity) => {
                const isSelected = data.selectedActivityCodes.includes(activity.code);
                const isAiSuggested = data.aiSuggestedActivityCodes.includes(activity.code);

                return (
                  <div
                    key={activity.code}
                    className={`group flex items-start space-x-3 p-3 border-2 rounded-xl transition-all duration-300 cursor-pointer ${isSelected
                      ? 'border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 shadow-md'
                      : 'border-slate-200 hover:border-purple-200 hover:bg-purple-50/30'
                      }`}
                    onClick={() => toggleActivity(activity.code)}
                  >
                    <Checkbox
                      id={activity.code}
                      checked={isSelected}
                      onCheckedChange={() => toggleActivity(activity.code)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={activity.code} className="cursor-pointer">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition-colors">{activity.name}</span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {activity.base_days}d
                          </span>
                          {isAiSuggested && (
                            <Badge className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 border-0">
                              {isDemoMode ? '🎯 Suggested' : 'AI'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
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

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="hover:bg-slate-50">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={data.selectedActivityCodes.length === 0}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Next: Drivers & Risks</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}