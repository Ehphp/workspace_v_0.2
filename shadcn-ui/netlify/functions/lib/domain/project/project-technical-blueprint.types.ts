/**
 * Domain types for the Project Technical Blueprint artifact.
 *
 * Defines the structured output that captures a project's architectural
 * baseline — components, data domains, integrations, and analysis metadata.
 *
 * This is a project-level artifact (not requirement-level). It provides
 * a reusable technical baseline that downstream requirement flows
 * (understanding, impact map, estimation) can reference.
 */

// ============================================================================
// Core Blueprint Types
// ============================================================================

export type BlueprintComponentType =
    | 'frontend'
    | 'backend'
    | 'database'
    | 'integration'
    | 'workflow'
    | 'reporting'
    | 'security'
    | 'infrastructure'
    | 'external_system'
    | 'other';

export type IntegrationDirection =
    | 'inbound'
    | 'outbound'
    | 'bidirectional'
    | 'unknown';

export interface BlueprintComponent {
    name: string;
    type: BlueprintComponentType;
    description?: string;
    confidence?: number;
}

export interface BlueprintDataDomain {
    name: string;
    description?: string;
    confidence?: number;
}

export interface BlueprintIntegration {
    systemName: string;
    direction?: IntegrationDirection;
    description?: string;
    confidence?: number;
}

// ============================================================================
// Persisted Blueprint (DB row → domain)
// ============================================================================

export interface ProjectTechnicalBlueprint {
    id?: string;
    projectId: string;
    version: number;
    sourceText?: string;
    summary?: string;
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence?: number;
    createdAt?: string;
}

// ============================================================================
// AI Input/Output Types
// ============================================================================

/** AI-generated project draft extracted from documentation */
export interface ProjectDraftBlueprint {
    name: string;
    description: string;
    owner?: string | null;
    technologyId?: string | null;
    projectType?: string | null;
    domain?: string | null;
    scope?: string | null;
    teamSize?: number | null;
    deadlinePressure?: string | null;
    methodology?: string | null;
    confidence: number;
    assumptions: string[];
    missingFields: string[];
    reasoning?: string;
}

/** Combined AI output: project draft + technical blueprint */
export interface ProjectFromDocumentationResult {
    projectDraft: ProjectDraftBlueprint;
    technicalBlueprint: Omit<ProjectTechnicalBlueprint, 'projectId' | 'version' | 'id' | 'createdAt'>;
}

// ============================================================================
// DB Row Type (snake_case, for Supabase interaction)
// ============================================================================

export interface ProjectTechnicalBlueprintRow {
    id: string;
    project_id: string;
    version: number;
    source_text: string | null;
    summary: string | null;
    components: BlueprintComponent[];
    data_domains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    architectural_notes: string[];
    assumptions: string[];
    missing_information: string[];
    confidence: number | null;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Create Input (for repository layer)
// ============================================================================

export interface CreateProjectTechnicalBlueprintInput {
    projectId: string;
    sourceText?: string;
    summary?: string;
    components: BlueprintComponent[];
    dataDomains: BlueprintDataDomain[];
    integrations: BlueprintIntegration[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence?: number;
}
