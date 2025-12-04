import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';
import type { AIActivitySuggestion } from '@/types/estimation';
import { sanitizePromptInput } from '@/types/ai-validation';
import { supabase } from '@/lib/supabase';
import { buildFunctionUrl } from '@/lib/netlify';

interface SuggestActivitiesInput {
  description: string;
  preset: TechnologyPreset;
  activities: Activity[];
  drivers?: Driver[];
  risks?: Risk[];
  baseUrl?: string; // Optional base URL for testing
  testMode?: boolean; // Disable cache and increase temperature for variance testing
}

export interface NormalizationResult {
  isValidRequirement: boolean;
  confidence: number;
  originalDescription: string;
  normalizedDescription: string;
  validationIssues: string[];
  transformNotes: string[];
}

/**
 * Call the Netlify serverless function to get AI activity suggestions.
 * This keeps the OpenAI API key secure on the server side.
 */

export async function suggestActivities(
  input: SuggestActivitiesInput
): Promise<AIActivitySuggestion> {
  const { description, preset, activities, drivers, risks, baseUrl = '', testMode = false } = input;

  try {
    // Fetch current session token (if available) to authenticate serverless call
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authHeader = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    // Sanitize input to prevent injection attacks
    const sanitizedDescription = sanitizePromptInput(description);

    // Call Netlify function instead of OpenAI directly
    const apiUrl = buildFunctionUrl('ai-suggest', baseUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        description: sanitizedDescription,
        preset,
        activities,
        drivers,
        risks,
        testMode, // Pass test mode to function
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
      isValidRequirement: false,
      activityCodes: preset.default_activity_codes,
      reasoning: 'Using preset defaults due to AI service error',
    };
  }
}

/**
 * Generate a concise title from a requirement description using AI
 */
export async function generateTitleFromDescription(description: string): Promise<string> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authHeader = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    // Sanitize input
    const sanitizedDescription = sanitizePromptInput(description);

    const response = await fetch(buildFunctionUrl('ai-suggest'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        action: 'generate-title',
        description: sanitizedDescription,
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


/**
 * Normalize and validate a requirement description using AI
 */
export async function normalizeRequirement(description: string): Promise<NormalizationResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authHeader = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};

    const sanitizedDescription = sanitizePromptInput(description);

    const response = await fetch(buildFunctionUrl('ai-suggest'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        action: 'normalize-requirement',
        description: sanitizedDescription,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error normalizing requirement:', error);
    throw error;
  }
}
