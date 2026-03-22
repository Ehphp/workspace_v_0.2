import type { Activity, Driver, Risk, Technology } from '@/types/database';
import type { AIActivitySuggestion } from '@/types/estimation';
import { sanitizePromptInput } from '@/types/ai-validation';
import { supabase } from '@/lib/supabase';
import { buildFunctionUrl } from '@/lib/netlify';

// ── AI Service Error Types (Sprint 3 — S3-3) ────────────────────────────

export interface AIServiceError {
  /** Structured error code from the backend */
  code: string; // AI_UNAVAILABLE | AI_RATE_LIMITED | TIMEOUT | INTERNAL_ERROR
  /** Human-readable message */
  message: string;
  /** Seconds to wait before retrying (from Retry-After header) */
  retryAfterSeconds?: number;
  /** Whether the frontend should offer a retry option */
  isRetryable: boolean;
}

/**
 * Parse a non-ok response into a structured AIServiceError.
 * Works with the error format emitted by createAIHandler.
 */
export function parseAIError(response: Response, errorData: any): AIServiceError {
  const code: string = errorData?.error?.code || 'INTERNAL_ERROR';
  const retryAfterRaw = response.headers.get('Retry-After');
  const retryAfter = retryAfterRaw ? parseInt(retryAfterRaw, 10) : undefined;

  return {
    code,
    message: errorData?.error?.message || `HTTP ${response.status}`,
    retryAfterSeconds: (retryAfter && !Number.isNaN(retryAfter)) ? retryAfter : undefined,
    isRetryable: ['AI_UNAVAILABLE', 'AI_RATE_LIMITED', 'TIMEOUT'].includes(code),
  };
}


export interface NormalizationResult {
  isValidRequirement: boolean;
  confidence: number;
  originalDescription: string;
  normalizedDescription: string;
  validationIssues: string[];
  transformNotes: string[];
  generatedTitle?: string;
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
      const errorData = await response.json().catch(() => ({}));
      const aiError = parseAIError(response, errorData);
      throw new Error(aiError.message);
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
      const errorData = await response.json().catch(() => ({}));
      const aiError = parseAIError(response, errorData);
      throw new Error(aiError.message);
    }

    return await response.json();
  } catch (error) {
    console.error('Error normalizing requirement:', error);
    throw error;
  }
}
