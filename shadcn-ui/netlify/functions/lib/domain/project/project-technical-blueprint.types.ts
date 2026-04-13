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
    | 'reporting'
    | 'security'
    | 'infrastructure'
    | 'external_system'
    | 'other'
    // Power Platform specific
    | 'canvas_app'
    | 'model_driven_app'
    | 'dataverse_table'
    | 'custom_connector'
    | 'cloud_flow'
    | 'power_automate_desktop'
    | 'pcf_control'
    // Backend specific
    | 'api_controller'
    | 'service_layer'
    | 'repository'
    | 'middleware'
    | 'queue_processor'
    | 'scheduled_job'
    // Frontend specific
    | 'page'
    | 'component_library'
    | 'state_manager'
    | 'form'
    | 'data_grid';

export type IntegrationDirection =
    | 'inbound'
    | 'outbound'
    | 'bidirectional'
    | 'unknown';

export type CriticalityLevel = 'low' | 'medium' | 'high';
export type ReviewStatus = 'draft' | 'reviewed' | 'approved';

// ============================================================================
// Evidence — textual proof from source documentation
// ============================================================================

export interface EvidenceRef {
    sourceType: 'source_text';
    snippet: string;
    startOffset?: number;
    endOffset?: number;
}

// ============================================================================
// Relations — explicit links between blueprint nodes
// ============================================================================

export type BlueprintRelationType =
    | 'reads'
    | 'writes'
    | 'orchestrates'
    | 'syncs'
    | 'owns'
    | 'depends_on';

export interface BlueprintRelation {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    type: BlueprintRelationType;
    confidence?: number;
    evidence?: EvidenceRef[];
}

// ============================================================================
// Diff Summary — semantic diff between blueprint versions
// ============================================================================

export interface BlueprintDiffSummary {
    addedNodes: string[];
    removedNodes: string[];
    updatedNodes: string[];
    reclassifiedNodes: string[];
    addedRelations: string[];
    removedRelations: string[];
    changedAssumptions: boolean;
    changedMissingInformation: boolean;
    breakingArchitecturalChanges: boolean;
}

// ============================================================================
// Node types (with optional enrichment fields)
// ============================================================================

export interface BlueprintComponent {
    id?: string;
    name: string;
    type: BlueprintComponentType;
    description?: string;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
    canonicalName?: string;
    aliases?: string[];
    deduplicationNotes?: string;
}

export interface BlueprintDataDomain {
    id?: string;
    name: string;
    description?: string;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
    canonicalName?: string;
    aliases?: string[];
    deduplicationNotes?: string;
}

export interface BlueprintIntegration {
    id?: string;
    systemName: string;
    direction?: IntegrationDirection;
    description?: string;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
    canonicalName?: string;
    aliases?: string[];
    deduplicationNotes?: string;
}

// ============================================================================
// Workflow types (first-class 4th category)
// ============================================================================

export interface WorkflowStep {
    order: number;
    action: string;
    actor?: 'user' | 'system' | 'external';
    component?: string;
}

export interface BlueprintWorkflow {
    id?: string;
    name: string;
    description: string;
    trigger: string;
    steps: WorkflowStep[];
    involvedComponents: string[];
    involvedDataDomains: string[];
    complexity?: CriticalityLevel;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
    canonicalName?: string;
    aliases?: string[];
    deduplicationNotes?: string;
}

// ============================================================================
// Structured Document Digest (SDD) — AI-extracted summary of source docs
// ============================================================================

export interface SDDFunctionalArea {
    title: string;
    description: string;
    keyPassages: string[];
}

export interface SDDBusinessEntity {
    name: string;
    role: string;
}

export interface SDDExternalSystem {
    name: string;
    interactionDescription: string;
}

export interface SDDKeyPassage {
    label: string;
    text: string;
}

export interface SDDOperationalWorkflow {
    name: string;
    trigger: string;
    actors: string[];
    keySteps: string;
}

export interface StructuredDocumentDigest {
    functionalAreas: SDDFunctionalArea[];
    businessEntities: SDDBusinessEntity[];
    externalSystems: SDDExternalSystem[];
    technicalConstraints: string[];
    nonFunctionalRequirements: string[];
    keyPassages: SDDKeyPassage[];
    operationalWorkflows: SDDOperationalWorkflow[];
    ambiguities: string[];
    documentQuality: 'high' | 'medium' | 'low';
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
    workflows?: BlueprintWorkflow[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence?: number;
    createdAt?: string;
    // ── New fields (v2 — all optional for backward compat) ──────────
    relations?: BlueprintRelation[];
    coverage?: number;
    qualityFlags?: string[];
    qualityScore?: number;
    reviewStatus?: ReviewStatus;
    changeSummary?: string;
    diffFromPrevious?: BlueprintDiffSummary;
    structuredDigest?: StructuredDocumentDigest;
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
    workflows: BlueprintWorkflow[] | null;
    architectural_notes: string[];
    assumptions: string[];
    missing_information: string[];
    confidence: number | null;
    created_at: string;
    updated_at: string;
    // ── New columns (v2 — nullable for backward compat) ─────────────
    relations: BlueprintRelation[] | null;
    coverage: number | null;
    quality_flags: string[] | null;
    quality_score: number | null;
    review_status: string | null;
    change_summary: string | null;
    diff_from_previous: BlueprintDiffSummary | null;
    structured_digest: StructuredDocumentDigest | null;
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
    workflows?: BlueprintWorkflow[];
    architecturalNotes: string[];
    assumptions: string[];
    missingInformation: string[];
    confidence?: number;
    // ── New fields (v2 — optional for backward compat) ──────────────
    relations?: BlueprintRelation[];
    coverage?: number;
    qualityFlags?: string[];
    qualityScore?: number;
    reviewStatus?: ReviewStatus;
    changeSummary?: string;
    diffFromPrevious?: BlueprintDiffSummary;
    structuredDigest?: StructuredDocumentDigest;
}
