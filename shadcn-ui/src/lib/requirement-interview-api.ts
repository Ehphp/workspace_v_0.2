/**
 * API Client for Requirement Technical Interview
 * 
 * Handles communication with interview question generation and estimate endpoints.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type {
    RequirementInterviewRequest,
    RequirementInterviewResponse,
    RequirementInterviewResponseSchema,
    EstimationFromInterviewRequest,
    EstimationFromInterviewResponse,
    InterviewAnswer,
} from '@/types/requirement-interview';


/**
 * Generate technical interview questions based on requirement description
 * 
 * @param request - The interview request with description and tech preset
 * @returns Promise with generated questions or error
 */
export async function generateInterviewQuestions(
    request: RequirementInterviewRequest
): Promise<RequirementInterviewResponse> {
    // 1. Client-side sanitization
    const sanitizedDescription = sanitizePromptInput(request.description);

    // 2. Basic validation
    if (!sanitizedDescription || sanitizedDescription.length < 15) {
        return {
            success: false,
            questions: [],
            reasoning: '',
            estimatedComplexity: 'MEDIUM',
            suggestedActivities: [],
            error: 'La descrizione deve contenere almeno 15 caratteri.',
        };
    }

    if (sanitizedDescription.length > 2000) {
        return {
            success: false,
            questions: [],
            reasoning: '',
            estimatedComplexity: 'MEDIUM',
            suggestedActivities: [],
            error: 'La descrizione è troppo lunga (max 2000 caratteri).',
        };
    }

    if (!request.techCategory) {
        return {
            success: false,
            questions: [],
            reasoning: '',
            estimatedComplexity: 'MEDIUM',
            suggestedActivities: [],
            error: 'La categoria tecnologica è obbligatoria.',
        };
    }

    // 3. Get auth token if available
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend endpoint
    try {
        const response = await fetch(buildFunctionUrl('ai-requirement-interview'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                description: sanitizedDescription,
                techPresetId: request.techPresetId,
                techCategory: request.techCategory,
                projectContext: request.projectContext,
                ...(request.requirementUnderstanding ? { requirementUnderstanding: request.requirementUnderstanding } : {}),
                ...(request.impactMap ? { impactMap: request.impactMap } : {}),
                ...(request.estimationBlueprint ? { estimationBlueprint: request.estimationBlueprint } : {}),
            }),
        });

        // 5. Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 429) {
                return {
                    success: false,
                    questions: [],
                    reasoning: '',
                    estimatedComplexity: 'MEDIUM',
                    suggestedActivities: [],
                    error: errorData.message || 'Limite richieste raggiunto. Riprova più tardi.',
                };
            }

            if (response.status === 504) {
                return {
                    success: false,
                    questions: [],
                    reasoning: '',
                    estimatedComplexity: 'MEDIUM',
                    suggestedActivities: [],
                    error: 'Timeout del servizio. Prova con una descrizione più concisa.',
                };
            }

            return {
                success: false,
                questions: [],
                reasoning: '',
                estimatedComplexity: 'MEDIUM',
                suggestedActivities: [],
                error: errorData.message || `Errore del server (${response.status}). Riprova.`,
            };
        }

        // 6. Parse and return response
        const data = await response.json();

        console.log('[requirement-interview-api] Questions generated:', {
            count: data.questions?.length || 0,
            complexity: data.estimatedComplexity,
        });

        return data as RequirementInterviewResponse;

    } catch (error) {
        console.error('[requirement-interview-api] Network error:', error);
        return {
            success: false,
            questions: [],
            reasoning: '',
            estimatedComplexity: 'MEDIUM',
            suggestedActivities: [],
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}

/**
 * Generate estimate from interview answers
 * 
 * @param request - The estimation request with description, answers, and activities
 * @returns Promise with estimation result or error
 */
export async function generateEstimateFromInterview(
    request: EstimationFromInterviewRequest
): Promise<EstimationFromInterviewResponse> {
    // 1. Validate required fields
    if (!request.description) {
        return {
            success: false,
            activities: [],
            totalBaseDays: 0,
            reasoning: '',
            confidenceScore: 0,
            error: 'La descrizione del requisito è obbligatoria.',
        };
    }

    // Allow empty answers when upstream context is available:
    // - preEstimate (SKIP path — planner decided requirement is clear enough)
    // - requirementUnderstanding (artifact-enriched path — bulk/quick mode)
    if (
        (!request.answers || Object.keys(request.answers).length === 0) &&
        !request.preEstimate &&
        !request.requirementUnderstanding
    ) {
        return {
            success: false,
            activities: [],
            totalBaseDays: 0,
            reasoning: '',
            confidenceScore: 0,
            error: 'Le risposte all\'interview sono obbligatorie.',
        };
    }

    // 2. Sanitize description
    const sanitizedDescription = sanitizePromptInput(request.description);

    // 3. Get auth token if available
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend endpoint
    try {
        const response = await fetch(buildFunctionUrl('ai-estimate-from-interview'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                description: sanitizedDescription,
                techPresetId: request.techPresetId,
                techCategory: request.techCategory,
                answers: request.answers,
                projectContext: request.projectContext,
                preEstimate: request.preEstimate,
                ...(request.requirementUnderstanding ? { requirementUnderstanding: request.requirementUnderstanding } : {}),
                ...(request.impactMap ? { impactMap: request.impactMap } : {}),
                ...(request.estimationBlueprint ? { estimationBlueprint: request.estimationBlueprint } : {}),
            }),
        });

        // 5. Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            return {
                success: false,
                activities: [],
                totalBaseDays: 0,
                reasoning: '',
                confidenceScore: 0,
                error: errorData.message || `Errore del server (${response.status}). Riprova.`,
            };
        }

        // 6. Parse and return response
        const data = await response.json();

        console.log('[requirement-interview-api] Estimate generated:', {
            activitiesCount: data.activities?.length || 0,
            totalBaseDays: data.totalBaseDays,
            confidenceScore: data.confidenceScore,
        });

        return data as EstimationFromInterviewResponse;

    } catch (error) {
        console.error('[requirement-interview-api] Network error:', error);
        return {
            success: false,
            activities: [],
            totalBaseDays: 0,
            reasoning: '',
            confidenceScore: 0,
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}

/**
 * Helper: Check if interview response is actionable
 * With the information-gain planner, a SKIP decision with 0 questions is valid.
 */
export function hasValidQuestions(response: RequirementInterviewResponse): boolean {
    if (!response.success) return false;
    // SKIP decision means we can proceed without questions
    if (response.decision === 'SKIP') return true;
    // ASK decision or legacy response (no decision field): need >= 1 question
    return response.questions.length >= 1;
}

/**
 * Helper: Get completion status for interview
 */
export function getInterviewCompletionStatus(
    totalQuestions: number,
    answeredCount: number,
    requiredAnswered: boolean
): {
    percentage: number;
    canSubmit: boolean;
    status: 'not-started' | 'in-progress' | 'complete' | 'incomplete';
} {
    if (answeredCount === 0) {
        return { percentage: 0, canSubmit: false, status: 'not-started' };
    }

    const percentage = Math.round((answeredCount / totalQuestions) * 100);

    if (answeredCount === totalQuestions && requiredAnswered) {
        return { percentage: 100, canSubmit: true, status: 'complete' };
    }

    if (requiredAnswered) {
        return { percentage, canSubmit: true, status: 'in-progress' };
    }

    return { percentage, canSubmit: false, status: 'incomplete' };
}

/**
 * Helper: Convert Map<string, InterviewAnswer> to Record for API
 */
export function answersMapToRecord(
    answers: Map<string, InterviewAnswer>
): Record<string, InterviewAnswer> {
    const record: Record<string, InterviewAnswer> = {};
    answers.forEach((answer, key) => {
        record[key] = answer;
    });
    return record;
}

/**
 * Helper: Convert Record to Map<string, InterviewAnswer>
 */
export function answersRecordToMap(
    record: Record<string, InterviewAnswer>
): Map<string, InterviewAnswer> {
    const map = new Map<string, InterviewAnswer>();
    Object.entries(record).forEach(([key, value]) => {
        map.set(key, value);
    });
    return map;
}
