import OpenAI from 'openai';
import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';
import type { AIActivitySuggestion } from '@/types/estimation';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Note: In production, use a backend proxy
});

interface SuggestActivitiesInput {
  description: string;
  preset: TechnologyPreset;
  activities: Activity[];
  drivers: Driver[];
  risks: Risk[];
}

export async function suggestActivities(
  input: SuggestActivitiesInput
): Promise<AIActivitySuggestion> {
  const { description, preset, activities, drivers, risks } = input;

  // Filter activities relevant to the preset's tech category
  const relevantActivities = activities.filter(
    (a) => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
  );

  const systemPrompt = `You are an expert software estimation assistant. Your role is to suggest which activities should be included in an estimation based on a requirement description.

IMPORTANT: You only suggest activities. You DO NOT calculate effort or days. The calculation is done by a deterministic engine.

Technology Preset: ${preset.name} (${preset.tech_category})
Description: ${preset.description}

Available activities for this technology:
${relevantActivities.map((a) => `- ${a.code}: ${a.name} (${a.base_days} days, ${a.group})`).join('\n')}

Available drivers:
${drivers.map((d) => `- ${d.code}: ${d.name}`).join('\n')}

Available risks:
${risks.map((r) => `- ${r.code}: ${r.name} (weight: ${r.weight})`).join('\n')}

Based on the requirement description, suggest:
1. Which activity codes should be selected (array of codes)
2. Optionally, suggested driver values (object with driver codes as keys)
3. Optionally, suggested risk codes (array of codes)

Return your response as a JSON object with this structure:
{
  "activityCodes": ["CODE1", "CODE2", ...],
  "suggestedDrivers": {"COMPLEXITY": "HIGH", ...},
  "suggestedRisks": ["R_CODE1", ...],
  "reasoning": "Brief explanation of your suggestions"
}`;

  const userPrompt = `Requirement description:
${description}

Please suggest which activities, drivers, and risks are relevant for this requirement.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const suggestion = JSON.parse(content) as AIActivitySuggestion;

    // Validate that suggested activity codes exist
    const validActivityCodes = relevantActivities.map((a) => a.code);
    suggestion.activityCodes = suggestion.activityCodes.filter((code) =>
      validActivityCodes.includes(code)
    );

    return suggestion;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    // Fallback to preset defaults
    return {
      activityCodes: preset.default_activity_codes,
      suggestedDrivers: preset.default_driver_values,
      suggestedRisks: preset.default_risks,
      reasoning: 'Using preset defaults due to AI error',
    };
  }
}