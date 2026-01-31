/**
 * API Client for Bulk Interview System
 * 
 * Handles communication with bulk interview endpoints.
 */

import { supabase } from '@/lib/supabase';
import { sanitizePromptInput } from '@/types/ai-validation';
import { buildFunctionUrl } from '@/lib/netlify';
import type {
    BulkInterviewRequest,
    BulkInterviewResponse,
    BulkEstimateFromInterviewRequest,
    BulkEstimateFromInterviewResponse,
    BulkInterviewAnswer,
    BulkRequirementInput,
} from '@/types/bulk-interview';

/**
 * Generate aggregated interview questions for multiple requirements
 */
export async function generateBulkInterviewQuestions(
    request: BulkInterviewRequest
): Promise<BulkInterviewResponse> {
    // 1. Sanitize all descriptions
    const sanitizedRequirements = request.requirements.map(req => ({
        ...req,
        description: sanitizePromptInput(req.description),
        title: sanitizePromptInput(req.title),
    }));

    // 2. Validate minimum requirements
    const validRequirements = sanitizedRequirements.filter(
        req => req.description && req.description.length >= 10
    );

    if (validRequirements.length === 0) {
        return {
            success: false,
            questions: [],
            requirementAnalysis: [],
            reasoning: '',
            summary: {
                totalRequirements: 0,
                globalQuestions: 0,
                multiReqQuestions: 0,
                specificQuestions: 0,
                avgAmbiguityScore: 0,
            },
            error: 'Nessun requisito valido. Ogni requisito deve avere almeno 10 caratteri di descrizione.',
        };
    }

    // 3. Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend
    try {
        console.log('[bulk-interview-api] Generating questions for', validRequirements.length, 'requirements');

        const response = await fetch(buildFunctionUrl('ai-bulk-interview'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                requirements: validRequirements,
                techCategory: request.techCategory,
                techPresetId: request.techPresetId,
                projectContext: request.projectContext,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 429) {
                return {
                    success: false,
                    questions: [],
                    requirementAnalysis: [],
                    reasoning: '',
                    summary: {
                        totalRequirements: validRequirements.length,
                        globalQuestions: 0,
                        multiReqQuestions: 0,
                        specificQuestions: 0,
                        avgAmbiguityScore: 0,
                    },
                    error: 'Troppe richieste. Attendi qualche secondo e riprova.',
                };
            }

            return {
                success: false,
                questions: [],
                requirementAnalysis: [],
                reasoning: '',
                summary: {
                    totalRequirements: validRequirements.length,
                    globalQuestions: 0,
                    multiReqQuestions: 0,
                    specificQuestions: 0,
                    avgAmbiguityScore: 0,
                },
                error: errorData.error || `Errore HTTP ${response.status}`,
            };
        }

        const data = await response.json();

        console.log('[bulk-interview-api] Questions generated:', {
            total: data.questions?.length || 0,
            global: data.summary?.globalQuestions || 0,
        });

        return data as BulkInterviewResponse;

    } catch (error) {
        console.error('[bulk-interview-api] Network error:', error);
        return {
            success: false,
            questions: [],
            requirementAnalysis: [],
            reasoning: '',
            summary: {
                totalRequirements: validRequirements.length,
                globalQuestions: 0,
                multiReqQuestions: 0,
                specificQuestions: 0,
                avgAmbiguityScore: 0,
            },
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}

/**
 * Generate estimates for multiple requirements based on interview answers
 */
export async function generateBulkEstimatesFromInterview(
    request: BulkEstimateFromInterviewRequest
): Promise<BulkEstimateFromInterviewResponse> {
    // 1. Validate
    if (!request.requirements || request.requirements.length === 0) {
        return {
            success: false,
            estimations: [],
            summary: {
                totalRequirements: 0,
                successfulEstimations: 0,
                failedEstimations: 0,
                totalBaseDays: 0,
                avgConfidenceScore: 0,
            },
            error: 'Nessun requisito da stimare.',
        };
    }

    if (!request.answers || Object.keys(request.answers).length === 0) {
        return {
            success: false,
            estimations: [],
            summary: {
                totalRequirements: request.requirements.length,
                successfulEstimations: 0,
                failedEstimations: request.requirements.length,
                totalBaseDays: 0,
                avgConfidenceScore: 0,
            },
            error: 'Le risposte all\'intervista sono obbligatorie.',
        };
    }

    if (!request.activities || request.activities.length === 0) {
        return {
            success: false,
            estimations: [],
            summary: {
                totalRequirements: request.requirements.length,
                successfulEstimations: 0,
                failedEstimations: request.requirements.length,
                totalBaseDays: 0,
                avgConfidenceScore: 0,
            },
            error: 'Il catalogo delle attività è obbligatorio.',
        };
    }

    // 2. Sanitize descriptions
    const sanitizedRequirements = request.requirements.map(req => ({
        ...req,
        description: sanitizePromptInput(req.description),
        title: sanitizePromptInput(req.title),
    }));

    // 3. Get auth token
    const { data: { session } } = await supabase.auth.getSession();
    const authHeader = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

    // 4. Call backend
    try {
        console.log('[bulk-interview-api] Generating estimates for', sanitizedRequirements.length, 'requirements');

        const response = await fetch(buildFunctionUrl('ai-bulk-estimate-with-answers'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
            },
            body: JSON.stringify({
                requirements: sanitizedRequirements,
                techCategory: request.techCategory,
                answers: request.answers,
                activities: request.activities,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 504) {
                return {
                    success: false,
                    estimations: [],
                    summary: {
                        totalRequirements: sanitizedRequirements.length,
                        successfulEstimations: 0,
                        failedEstimations: sanitizedRequirements.length,
                        totalBaseDays: 0,
                        avgConfidenceScore: 0,
                    },
                    error: 'Timeout durante la generazione. Prova con meno requisiti.',
                };
            }

            return {
                success: false,
                estimations: [],
                summary: {
                    totalRequirements: sanitizedRequirements.length,
                    successfulEstimations: 0,
                    failedEstimations: sanitizedRequirements.length,
                    totalBaseDays: 0,
                    avgConfidenceScore: 0,
                },
                error: errorData.error || `Errore HTTP ${response.status}`,
            };
        }

        const data = await response.json();

        console.log('[bulk-interview-api] Estimates generated:', {
            successful: data.summary?.successfulEstimations || 0,
            failed: data.summary?.failedEstimations || 0,
            totalDays: data.summary?.totalBaseDays || 0,
        });

        return data as BulkEstimateFromInterviewResponse;

    } catch (error) {
        console.error('[bulk-interview-api] Network error:', error);
        return {
            success: false,
            estimations: [],
            summary: {
                totalRequirements: sanitizedRequirements.length,
                successfulEstimations: 0,
                failedEstimations: sanitizedRequirements.length,
                totalBaseDays: 0,
                avgConfidenceScore: 0,
            },
            error: 'Errore di rete. Verifica la connessione e riprova.',
        };
    }
}

/**
 * Helper: Convert Map to Record for API
 */
export function bulkAnswersMapToRecord(
    answers: Map<string, BulkInterviewAnswer>
): Record<string, BulkInterviewAnswer> {
    const record: Record<string, BulkInterviewAnswer> = {};
    answers.forEach((value, key) => {
        record[key] = value;
    });
    return record;
}

/**
 * Helper: Get completion status for bulk interview
 */
export function getBulkInterviewCompletionStatus(
    totalQuestions: number,
    answeredCount: number,
    requiredAnswered: boolean
): {
    percentage: number;
    canSubmit: boolean;
    status: 'not-started' | 'in-progress' | 'complete' | 'incomplete';
} {
    if (totalQuestions === 0) {
        return { percentage: 0, canSubmit: false, status: 'not-started' };
    }

    const percentage = (answeredCount / totalQuestions) * 100;

    if (answeredCount === 0) {
        return { percentage: 0, canSubmit: false, status: 'not-started' };
    }

    if (answeredCount < totalQuestions) {
        return {
            percentage,
            canSubmit: requiredAnswered,
            status: 'in-progress'
        };
    }

    return { percentage: 100, canSubmit: true, status: 'complete' };
}
