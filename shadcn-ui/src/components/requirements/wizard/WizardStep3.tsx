import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { MOCK_ACTIVITIES, MOCK_TECHNOLOGY_PRESETS } from '@/lib/mockData';
import type { Activity, TechnologyPreset } from '@/types/database';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep3Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep3({ data, onUpdate, onNext, onBack }: WizardStep3Props) {
  const { user } = useAuth();
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
        // Build query to include:
        // 1. Standard activities matching tech_category or MULTI
        // 2. Custom activities created by the current user (any tech_category)
        let query = supabase
          .from('activities')
          .select('*')
          .eq('active', true)
          .order('group');

        if (user?.id) {
          // Include standard activities for tech OR custom activities by user
          query = query.or(
            `and(tech_category.eq.${currentPreset.tech_category},is_custom.is.null),` +
            `and(tech_category.eq.MULTI,is_custom.is.null),` +
            `and(is_custom.eq.true,created_by.eq.${user.id})`
          );
        } else {
          // No user logged in, only show standard activities
          query = query.or(`tech_category.eq.${currentPreset.tech_category},tech_category.eq.MULTI`);
        }

        const { data: activitiesData, error: activitiesError } = await query;

        let resolvedActivities: Activity[];
        let effectivePreset: TechnologyPreset | null = currentPreset;

        if (activitiesError || !activitiesData || activitiesData.length === 0) {
          resolvedActivities = MOCK_ACTIVITIES.filter(
            a => a.tech_category === currentPreset!.tech_category || a.tech_category === 'MULTI'
          );
          setIsDemoMode(true);
        } else {
          resolvedActivities = activitiesData;
        }

        if (!activitiesError && activitiesData && activitiesData.length > 0 && effectivePreset) {
          const { data: pivotData, error: pivotError } = await supabase
            .from('technology_preset_activities')
            .select('activity_id, position')
            .eq('tech_preset_id', effectivePreset.id);

          if (!pivotError && pivotData && pivotData.length > 0) {
            const activityById = new Map(resolvedActivities.map((a) => [a.id, a]));
            const codes = pivotData
              .sort((a, b) => {
                const pa = (a.position ?? Number.MAX_SAFE_INTEGER);
                const pb = (b.position ?? Number.MAX_SAFE_INTEGER);
                return pa - pb;
              })
              .map((row) => activityById.get(row.activity_id)?.code)
              .filter((code): code is string => Boolean(code));

            if (codes.length > 0) {
              effectivePreset = { ...effectivePreset, default_activity_codes: codes };
            }
          }
        }

        setPreset(effectivePreset);
        setActivities(resolvedActivities);
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
    setAiUsed(false);
    // Clear previous AI selections to avoid showing stale results
    onUpdate({ selectedActivityCodes: [], aiSuggestedActivityCodes: [] });
    try {
      const { suggestActivities } = await import('@/lib/openai');

      const suggestion = await suggestActivities({
        description: data.description,
        preset,
        activities,
      });
      console.log('AI activity suggestion response:', suggestion);

      if (!suggestion.isValidRequirement) {
        console.warn('AI determined requirement is not valid:', suggestion.reasoning);
        setAiUsed(true);
        setAiStatus('error');
        setAiLoading(false);
        throw new Error(suggestion.reasoning || 'Requirement description is not valid for AI estimation.');
      }

      const suggestedCodes = suggestion.activityCodes;

      if (!suggestedCodes || suggestedCodes.length === 0) {
        console.warn('AI returned no activities, using preset defaults');
        onUpdate({
          selectedActivityCodes: preset.default_activity_codes,
          aiSuggestedActivityCodes: preset.default_activity_codes,
          activitySuggestionResult: suggestion,
        });
        setAiUsed(true);
        setAiStatus('success');
        setAiLoading(false);
        return;
      }

      onUpdate({
        selectedActivityCodes: suggestedCodes,
        aiSuggestedActivityCodes: suggestedCodes,
        activitySuggestionResult: suggestion,
      });

      setAiUsed(true);
      setAiStatus('success');
    } catch (error) {
      console.error('AI suggestion failed:', error);
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

  // Sort activities within each group: AI-suggested first, then alphabetically by name
  const sortedGroupedActivities = Object.entries(groupedActivities).reduce((acc, [group, groupActivities]) => {
    const sorted = [...groupActivities].sort((a, b) => {
      const aIsAiSuggested = data.aiSuggestedActivityCodes.includes(a.code);
      const bIsAiSuggested = data.aiSuggestedActivityCodes.includes(b.code);

      // AI-suggested activities come first
      if (aIsAiSuggested && !bIsAiSuggested) return -1;
      if (!aIsAiSuggested && bIsAiSuggested) return 1;

      // Within same category (both AI or both non-AI), sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    acc[group] = sorted;
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
    <div className="flex flex-col h-full gap-3">
      <div className="flex-shrink-0 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg ring-2 ring-purple-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Select Activities</h2>
              {isDemoMode && (
                <Badge variant="secondary" className="text-[11px]">
                  Demo mode
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-600">
              Start from AI suggestions and fine tune the scope you need
            </p>
            {data.normalizationResult?.isValidRequirement && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Normalized Requirement
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAISuggest}
            disabled={aiLoading || !data.description || !preset}
            className="h-8 border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582a10 10 0 0114.837-2.765l-1.282 1.535a8 8 0 00-12.21 1.23H12v5H7.418a8 8 0 0012.21 1.23l1.282 1.535A10 10 0 013.418 11H4V6H2V4h2z" />
            </svg>
            Let AI pick activities
          </Button>
          <span className="text-[11px] text-slate-500">
            AI uses your description and preset to preselect activities.
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 space-y-2">
        {aiLoading && (
          <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-900">
                  {isDemoMode ? 'Analyzing keywords' : 'AI is thinking...'}
                </p>
                <p className="text-xs text-purple-700">
                  {isDemoMode
                    ? 'Scanning your description for the closest preset activities'
                    : 'Estimating complexity and recommending an initial set'}
                </p>
              </div>
            </div>
          </div>
        )}

        {aiUsed && aiStatus === 'success' && (
          <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900">
                  {data.selectedActivityCodes.length} activities suggested
                </p>
                <p className="text-xs text-green-700">
                  Adjust the selection to match the scope you want to deliver
                </p>
              </div>
            </div>
          </div>
        )}

        {aiUsed && aiStatus === 'error' && (
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Requirement not valid for AI
                </p>
                <p className="text-xs text-amber-700">
                  Please improve the description or adjust technology before continuing
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAISuggest}
                className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 bg-white/50"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="space-y-4">
          {Object.entries(sortedGroupedActivities).map(([group, groupActivities]) => (
            <div key={group}>
              <h3 className="font-semibold text-xs mb-2 text-slate-800 flex items-center gap-2 sticky top-0 bg-white py-1 z-10">
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
                      className={`group p-3 border-2 rounded-xl transition-all duration-200 cursor-pointer ${isSelected
                        ? 'border-purple-500 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 shadow-md ring-2 ring-purple-100'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm'
                        }`}
                      onClick={() => toggleActivity(activity.code)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 transition-all duration-200 flex items-center justify-center mt-0.5 ${isSelected
                          ? 'border-purple-500 bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                          : 'border-slate-300 text-slate-400 group-hover:border-purple-400'
                          }`}>
                          {isSelected && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`font-semibold text-sm transition-colors ${isSelected ? 'text-purple-900' : 'text-slate-900 group-hover:text-purple-700'
                              }`}>
                              {activity.name}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${isSelected
                              ? 'bg-purple-200 text-purple-800'
                              : 'bg-slate-100 text-slate-600'
                              }`}>
                              {activity.base_hours}h
                            </span>
                            {isAiSuggested && (
                              <Badge className="text-[10px] bg-gradient-to-r from-purple-600 to-pink-600 border-0 shadow-sm">
                                AI
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs leading-relaxed transition-colors ${isSelected ? 'text-purple-700' : 'text-slate-600'
                            }`}>
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
            disabled={data.selectedActivityCodes.length === 0 || aiStatus === 'error'}
            size="lg"
            className="h-11 px-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            <span className="font-semibold text-sm">Next: Drivers & Risks</span>
            <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
