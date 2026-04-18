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
// Structural Signals — objectively computed from blueprint graph data
// ============================================================================

/** Computed structural metrics for a single blueprint node.
 *  These are objective, deterministic values derived from the relations
 *  graph, evidence arrays, and workflow references. */
export interface NodeStructuralSignals {
    /** Total incoming + outgoing relations for this node */
    relationsCount: number;
    /** Derived from relationsCount: 'loose' (0-2), 'moderate' (3-5), 'tight' (6+) */
    couplingDegree: 'loose' | 'moderate' | 'tight';
    /** Derived from evidence array length: 'good' (2+), 'partial' (1), 'missing' (0) */
    documentationCoverage: 'good' | 'partial' | 'missing';
    /** Number of workflows referencing this node */
    workflowParticipation: number;
}

// ============================================================================
// Estimation Signals — derived heuristics built on structural signals
// ============================================================================

/** Derived estimation-relevant assessment for a node.
 *  These are ASSISTIVE and OPTIONAL — downstream consumers must not
 *  treat them as absolute truth. They degrade gracefully when
 *  underlying data (relations, evidence) is insufficient. */
export interface NodeEstimationSignals {
    /** Relative cost to modify this area, based on coupling + type + criticality */
    modificationCost: 'low' | 'medium' | 'high';
    /** True when low confidence + tight coupling, or missing docs + tight coupling */
    fragile: boolean;
    /** True when loose coupling + multi-workflow participation + service-like type */
    reusable: boolean;
    /** Direct neighbor count affected by changes (equals relationsCount) */
    changeSurface: number;
}

// ============================================================================
// Semantic Signals — AI-extracted from documentation (not computable)
// ============================================================================

/** A constraint that impacts future estimation, extracted from documentation */
export interface BlueprintConstraint {
    type: 'technical' | 'organizational' | 'integration' | 'compliance';
    description: string;
    estimationImpact: CriticalityLevel;
}

/** An area where it is natural to add/modify functionality */
export interface BlueprintExtensionPoint {
    area: string;
    description: string;
    naturalFit: 'add' | 'modify' | 'replace';
}

// ============================================================================
// Blueprint-level Estimation Context
// ============================================================================

/** A recurring implementation pattern detected from workflow/component overlaps */
export interface BlueprintRecurringPattern {
    name: string;
    description: string;
    involvedNodeIds: string[];
    typicalEffort: 'low' | 'medium' | 'high';
}

/** Aggregated estimation context computed from all node-level signals.
 *  Provides a blueprint-wide view of estimation-relevant characteristics.
 *  When signalsDegraded is true, signals are based on type heuristics only. */
export interface BlueprintEstimationContext {
    /** Derived from integration count + workflow complexity + node count */
    coordinationCost: 'low' | 'medium' | 'high';
    /** Derived from fragile node ratio */
    overallFragility: 'low' | 'medium' | 'high';
    /** relations.length / totalNodes — 0 when no nodes */
    integrationDensity: number;
    /** Node names where modificationCost === 'high' */
    highCostAreas: string[];
    /** Node names where fragile === true */
    fragileAreas: string[];
    /** Node names where reusable === true */
    reusableCapabilities: string[];
    /** AI-extracted constraints from documentation */
    constraints: BlueprintConstraint[];
    /** AI-extracted extension points from documentation */
    extensionPoints: BlueprintExtensionPoint[];
    /** Detected cross-workflow component patterns */
    recurringPatterns: BlueprintRecurringPattern[];
    /** True when relations < 3 — signals are type-heuristic only */
    signalsDegraded: boolean;
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
    // ── Enrichment signals (v3 — computed, not AI-generated) ────────
    structuralSignals?: NodeStructuralSignals;
    estimationSignals?: NodeEstimationSignals;
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
    // ── Enrichment signals (v3 — computed, not AI-generated) ────────
    structuralSignals?: NodeStructuralSignals;
    estimationSignals?: NodeEstimationSignals;
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
    // ── Enrichment signals (v3 — computed, not AI-generated) ────────
    structuralSignals?: NodeStructuralSignals;
    estimationSignals?: NodeEstimationSignals;
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
    // ── Enrichment signals (v3 — computed, not AI-generated) ────────
    structuralSignals?: NodeStructuralSignals;
    estimationSignals?: NodeEstimationSignals;
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
    // ── Estimation context (v3 — computed by enrichment, not AI) ───
    estimationContext?: BlueprintEstimationContext;
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
    // ── Estimation context (v3 — nullable for backward compat) ──────
    estimation_context: BlueprintEstimationContext | null;
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
    // ── Estimation context (v3 — computed by enrichment, not AI) ───
    estimationContext?: BlueprintEstimationContext;
}
