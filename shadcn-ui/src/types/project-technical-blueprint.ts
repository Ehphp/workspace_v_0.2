/**
 * Frontend type definitions for the Project Technical Blueprint.
 *
 * Re-exports domain types for frontend consumption and adds
 * request/response types for the API client.
 */

// Re-export domain types
export type {
    BlueprintComponentType,
    IntegrationDirection,
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    ProjectTechnicalBlueprint,
    ProjectDraftBlueprint,
    ProjectFromDocumentationResult,
    ProjectTechnicalBlueprintRow,
    CreateProjectTechnicalBlueprintInput,
} from '../../netlify/functions/lib/domain/project/project-technical-blueprint.types';

// ============================================================================
// API Request / Response Types
// ============================================================================

export interface GenerateProjectFromDocumentationRequest {
    sourceText: string;
}

export interface GenerateProjectFromDocumentationResponse {
    success: boolean;
    result?: {
        projectDraft: import('../../netlify/functions/lib/domain/project/project-technical-blueprint.types').ProjectDraftBlueprint;
        technicalBlueprint: Omit<
            import('../../netlify/functions/lib/domain/project/project-technical-blueprint.types').ProjectTechnicalBlueprint,
            'projectId' | 'version' | 'id' | 'createdAt'
        >;
    };
    error?: string;
    metadata?: {
        generatedAt: string;
        model: string;
        sourceTextLength: number;
    };
    metrics?: {
        totalMs: number;
        pass1Ms: number;
        pass2Ms: number;
        model: string;
    };
}
