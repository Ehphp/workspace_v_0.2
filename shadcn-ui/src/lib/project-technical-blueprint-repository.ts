/**
 * Repository for Project Technical Blueprints.
 *
 * Handles persistence and retrieval of project-level technical blueprints.
 * Follows the same patterns as project-repository.ts and the artifact
 * persistence functions in api.ts.
 */

import { supabase } from '@/lib/supabase';
import type {
    ProjectTechnicalBlueprint,
    ProjectTechnicalBlueprintRow,
    CreateProjectTechnicalBlueprintInput,
    ReviewStatus,
} from '@/types/project-technical-blueprint';
import {
    computeProjectBlueprintDiff,
    formatChangeSummary,
} from '../../netlify/functions/lib/domain/project/blueprint-diff';
import {
    computeBlueprintQualityScore,
} from '../../netlify/functions/lib/domain/project/blueprint-quality-score';

const TABLE = 'project_technical_blueprints' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Row ↔ Domain Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function mapBlueprintRowToDomain(row: ProjectTechnicalBlueprintRow): ProjectTechnicalBlueprint {
    return {
        id: row.id,
        projectId: row.project_id,
        version: row.version,
        sourceText: row.source_text ?? undefined,
        summary: row.summary ?? undefined,
        components: row.components ?? [],
        dataDomains: row.data_domains ?? [],
        integrations: row.integrations ?? [],
        workflows: row.workflows ?? [],
        architecturalNotes: row.architectural_notes ?? [],
        assumptions: row.assumptions ?? [],
        missingInformation: row.missing_information ?? [],
        confidence: row.confidence ?? undefined,
        createdAt: row.created_at,
        // v2 fields (nullable → undefined for backward compat)
        relations: row.relations ?? undefined,
        coverage: row.coverage ?? undefined,
        qualityFlags: row.quality_flags ?? undefined,
        qualityScore: row.quality_score ?? undefined,
        reviewStatus: (row.review_status as ReviewStatus) ?? undefined,
        changeSummary: row.change_summary ?? undefined,
        diffFromPrevious: row.diff_from_previous ?? undefined,
        structuredDigest: row.structured_digest ?? undefined,
    };
}

function mapInputToRow(
    input: CreateProjectTechnicalBlueprintInput,
    version: number,
): Record<string, unknown> {
    return {
        project_id: input.projectId,
        version,
        source_text: input.sourceText ?? null,
        summary: input.summary ?? null,
        components: input.components,
        data_domains: input.dataDomains,
        integrations: input.integrations,
        workflows: input.workflows ?? [],
        architectural_notes: input.architecturalNotes,
        assumptions: input.assumptions,
        missing_information: input.missingInformation,
        confidence: input.confidence ?? null,
        // v2 fields (optional, nullable)
        relations: input.relations ?? null,
        coverage: input.coverage ?? null,
        quality_flags: input.qualityFlags ?? null,
        quality_score: input.qualityScore ?? null,
        review_status: input.reviewStatus ?? null,
        change_summary: input.changeSummary ?? null,
        diff_from_previous: input.diffFromPrevious ?? null,
        structured_digest: input.structuredDigest ?? null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the latest (highest version) blueprint for a project.
 * Returns null if no blueprint exists.
 */
export async function getLatestProjectTechnicalBlueprint(
    projectId: string,
): Promise<ProjectTechnicalBlueprint | null> {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[blueprint-repo] Failed to fetch latest blueprint:', error);
        throw new Error(`Failed to fetch project blueprint: ${error.message}`);
    }

    if (!data) return null;
    return mapBlueprintRowToDomain(data as ProjectTechnicalBlueprintRow);
}

/**
 * List all blueprint versions for a project, newest first.
 */
export async function listProjectTechnicalBlueprintVersions(
    projectId: string,
): Promise<ProjectTechnicalBlueprint[]> {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });

    if (error) {
        console.error('[blueprint-repo] Failed to list blueprint versions:', error);
        throw new Error(`Failed to list project blueprints: ${error.message}`);
    }

    return (data || []).map((row) =>
        mapBlueprintRowToDomain(row as ProjectTechnicalBlueprintRow),
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new blueprint version for a project.
 * Automatically calculates the next version number.
 * If a previous version exists, computes a semantic diff and persists it.
 */
export async function createProjectTechnicalBlueprint(
    input: CreateProjectTechnicalBlueprintInput,
): Promise<ProjectTechnicalBlueprint> {
    // Determine next version + fetch previous for diff
    let nextVersion = 1;
    let previousBlueprint: ProjectTechnicalBlueprint | null = null;

    const { data: latestRow } = await supabase
        .from(TABLE)
        .select('*')
        .eq('project_id', input.projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestRow) {
        nextVersion = (latestRow as { version: number }).version + 1;
        previousBlueprint = mapBlueprintRowToDomain(latestRow as ProjectTechnicalBlueprintRow);
    }

    // Build a temporary domain object for the new blueprint to compute diff
    const enrichedInput = { ...input };
    if (previousBlueprint) {
        const tempNext: ProjectTechnicalBlueprint = {
            projectId: input.projectId,
            version: nextVersion,
            components: input.components,
            dataDomains: input.dataDomains,
            integrations: input.integrations,
            workflows: input.workflows,
            architecturalNotes: input.architecturalNotes,
            assumptions: input.assumptions,
            missingInformation: input.missingInformation,
            confidence: input.confidence,
            relations: input.relations,
        };
        const diff = computeProjectBlueprintDiff(previousBlueprint, tempNext);
        enrichedInput.diffFromPrevious = diff;
        enrichedInput.changeSummary = enrichedInput.changeSummary || formatChangeSummary(diff);
    }

    // Compute quality score deterministically
    const tempBlueprint: ProjectTechnicalBlueprint = {
        projectId: input.projectId,
        version: nextVersion,
        components: enrichedInput.components,
        dataDomains: enrichedInput.dataDomains,
        integrations: enrichedInput.integrations,
        architecturalNotes: enrichedInput.architecturalNotes,
        assumptions: enrichedInput.assumptions,
        missingInformation: enrichedInput.missingInformation,
        confidence: enrichedInput.confidence,
        coverage: enrichedInput.coverage,
        relations: enrichedInput.relations,
        qualityFlags: enrichedInput.qualityFlags,
    };
    const qResult = computeBlueprintQualityScore(tempBlueprint);
    enrichedInput.qualityScore = qResult.qualityScore;

    const payload = mapInputToRow(enrichedInput, nextVersion);

    const { data, error } = await supabase
        .from(TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error || !data) {
        console.error('[blueprint-repo] Failed to create blueprint:', error);
        throw new Error(`Failed to create project blueprint: ${error?.message ?? 'Unknown error'}`);
    }

    return mapBlueprintRowToDomain(data as ProjectTechnicalBlueprintRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update an existing blueprint row in-place (same version).
 * Only updates the editable structured fields — does not touch
 * project_id, version, or created_at.
 */
export async function updateProjectTechnicalBlueprint(
    blueprintId: string,
    patch: Partial<Pick<
        ProjectTechnicalBlueprint,
        'summary' | 'components' | 'dataDomains' | 'integrations' |
        'architecturalNotes' | 'assumptions' | 'missingInformation' | 'confidence' |
        'relations' | 'coverage' | 'qualityFlags' | 'qualityScore' | 'reviewStatus' | 'changeSummary' | 'diffFromPrevious' | 'structuredDigest'
    >>,
): Promise<ProjectTechnicalBlueprint> {
    const row: Record<string, unknown> = {};
    if (patch.summary !== undefined) row.summary = patch.summary;
    if (patch.components !== undefined) row.components = patch.components;
    if (patch.dataDomains !== undefined) row.data_domains = patch.dataDomains;
    if (patch.integrations !== undefined) row.integrations = patch.integrations;
    if (patch.architecturalNotes !== undefined) row.architectural_notes = patch.architecturalNotes;
    if (patch.assumptions !== undefined) row.assumptions = patch.assumptions;
    if (patch.missingInformation !== undefined) row.missing_information = patch.missingInformation;
    if (patch.confidence !== undefined) row.confidence = patch.confidence;
    // v2 fields
    if (patch.relations !== undefined) row.relations = patch.relations;
    if (patch.coverage !== undefined) row.coverage = patch.coverage;
    if (patch.qualityFlags !== undefined) row.quality_flags = patch.qualityFlags;
    if (patch.qualityScore !== undefined) row.quality_score = patch.qualityScore;
    if (patch.reviewStatus !== undefined) row.review_status = patch.reviewStatus;
    if (patch.changeSummary !== undefined) row.change_summary = patch.changeSummary;
    if (patch.diffFromPrevious !== undefined) row.diff_from_previous = patch.diffFromPrevious;
    if (patch.structuredDigest !== undefined) row.structured_digest = patch.structuredDigest;

    const { data, error } = await supabase
        .from(TABLE)
        .update(row)
        .eq('id', blueprintId)
        .select('*')
        .single();

    if (error || !data) {
        console.error('[blueprint-repo] Failed to update blueprint:', error);
        throw new Error(`Failed to update project blueprint: ${error?.message ?? 'Unknown error'}`);
    }

    return mapBlueprintRowToDomain(data as ProjectTechnicalBlueprintRow);
}
