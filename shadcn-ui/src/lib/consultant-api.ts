/**
 * API Client for Senior Consultant Analysis
 * 
 * Handles communication with the AI consultant endpoint.
 */

import { sanitizePromptInput } from '../types/ai-validation';
import type { SeniorConsultantAnalysis } from '../types/estimation';

/**
 * Request payload for consultant analysis
 */
export interface ConsultantAnalysisRequest {
    requirementTitle: string;
    requirementDescription: string;
    activities: Array<{
        code: string;
        name: string;
        description: string;
        base_hours: number;
        group: string;
    }>;
    drivers: Array<{
        code: string;
        name: string;
        selectedValue: string;
        multiplier: number;
    }>;
    projectContext: {
        name: string;
        description: string;
        owner?: string;
    };
    technologyName: string;
    technologyCategory: string;
}

/**
 * Response from consultant analysis endpoint
 */
export interface ConsultantAnalysisResponse {
    success: boolean;
    analysis: SeniorConsultantAnalysis;
}

/**
 * Get Senior Consultant analysis for an estimation
 */
export async function getConsultantAnalysis(
    request: ConsultantAnalysisRequest,
    supabaseToken?: string
): Promise<SeniorConsultantAnalysis> {
    // 1. Client-side sanitization
    const sanitizedRequest: ConsultantAnalysisRequest = {
        requirementTitle: sanitizePromptInput(request.requirementTitle),
        requirementDescription: sanitizePromptInput(request.requirementDescription),
        activities: request.activities.map(a => ({
            code: a.code,
            name: sanitizePromptInput(a.name),
            description: sanitizePromptInput(a.description || ''),
            base_hours: a.base_hours,
            group: a.group,
        })),
        drivers: request.drivers.map(d => ({
            code: d.code,
            name: sanitizePromptInput(d.name),
            selectedValue: d.selectedValue,
            multiplier: d.multiplier,
        })),
        projectContext: {
            name: sanitizePromptInput(request.projectContext.name),
            description: sanitizePromptInput(request.projectContext.description || ''),
            owner: request.projectContext.owner
                ? sanitizePromptInput(request.projectContext.owner)
                : undefined,
        },
        technologyName: sanitizePromptInput(request.technologyName),
        technologyCategory: request.technologyCategory,
    };

    // 2. Validation
    if (!sanitizedRequest.requirementDescription || sanitizedRequest.requirementDescription.length < 10) {
        throw new Error('La descrizione del requisito è troppo breve.');
    }

    if (sanitizedRequest.activities.length === 0) {
        throw new Error('Almeno una attività è richiesta per l\'analisi.');
    }

    // 3. Call backend endpoint
    const response = await fetch('/.netlify/functions/ai-consultant', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {}),
        },
        body: JSON.stringify(sanitizedRequest),
    });

    // 4. Handle HTTP errors
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
            throw new Error(
                errorData.error?.message || 'Hai raggiunto il limite di richieste. Riprova più tardi.'
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error('Non sei autorizzato. Effettua il login e riprova.');
        }

        throw new Error(
            errorData.error?.message || `Errore del server (${response.status}). Riprova.`
        );
    }

    // 5. Parse response
    const data: ConsultantAnalysisResponse = await response.json();

    if (!data.success || !data.analysis) {
        throw new Error('Risposta del server non valida.');
    }

    console.log('[consultant-api] Analysis received, confidence:', data.analysis.estimatedConfidence);

    return data.analysis;
}

/**
 * Get assessment badge color based on overall assessment
 */
export function getAssessmentColor(assessment: SeniorConsultantAnalysis['overallAssessment']): string {
    switch (assessment) {
        case 'approved':
            return 'bg-green-100 text-green-700 border-green-200';
        case 'needs_review':
            return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'concerns':
            return 'bg-red-100 text-red-700 border-red-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

/**
 * Get assessment label in Italian
 */
export function getAssessmentLabel(assessment: SeniorConsultantAnalysis['overallAssessment']): string {
    switch (assessment) {
        case 'approved':
            return 'Approvato';
        case 'needs_review':
            return 'Da Rivedere';
        case 'concerns':
            return 'Criticità';
        default:
            return assessment;
    }
}

/**
 * Get severity color for discrepancies and risks
 */
export function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
    switch (severity) {
        case 'low':
            return 'bg-blue-100 text-blue-700';
        case 'medium':
            return 'bg-yellow-100 text-yellow-700';
        case 'high':
            return 'bg-red-100 text-red-700';
        default:
            return 'bg-slate-100 text-slate-700';
    }
}
