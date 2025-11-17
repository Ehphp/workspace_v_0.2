import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';
import type { AIActivitySuggestion } from '@/types/estimation';

interface SuggestActivitiesInput {
  description: string;
  preset: TechnologyPreset;
  activities: Activity[];
  drivers: Driver[];
  risks: Risk[];
}

/**
 * Call the Netlify serverless function to get AI activity suggestions.
 * This keeps the OpenAI API key secure on the server side.
 */
export async function suggestActivities(
  input: SuggestActivitiesInput
): Promise<AIActivitySuggestion> {
  const { description, preset, activities, drivers, risks } = input;

  try {
    // Call Netlify function instead of OpenAI directly
    const response = await fetch('/.netlify/functions/ai-suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        preset,
        activities,
        drivers,
        risks,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const suggestion = await response.json() as AIActivitySuggestion;
    return suggestion;
  } catch (error) {
    console.error('Error calling AI suggestion API:', error);

    // Fallback to preset defaults
    return {
      activityCodes: preset.default_activity_codes,
      suggestedDrivers: preset.default_driver_values,
      suggestedRisks: preset.default_risks,
      reasoning: 'Using preset defaults due to AI service error',
    };
  }
}

/**
 * Generate a concise title from a requirement description using AI
 */
export async function generateTitleFromDescription(description: string): Promise<string> {
  try {
    const response = await fetch('/.netlify/functions/ai-suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate-title',
        description,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.title || description.substring(0, 100);
  } catch (error) {
    console.error('Error generating title with AI:', error);
    // Fallback: use first 100 chars of description
    return description.substring(0, 100).trim() + (description.length > 100 ? '...' : '');
  }
}