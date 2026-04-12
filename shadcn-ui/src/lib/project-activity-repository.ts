/**
 * Repository for Project Custom Activities.
 *
 * Handles persistence and retrieval of project-level custom activities.
 * Follows the same patterns as project-technical-blueprint-repository.ts.
 */

import { supabase } from '@/lib/supabase';
import type {
    ProjectActivity,
    ProjectActivityRow,
    CreateProjectActivityInput,
    ActivityGroup,
    InterventionType,
    BlueprintNodeType,
} from '@/types/project-activity';

const TABLE = 'project_activities' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Row ↔ Domain Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function mapActivityRowToDomain(row: ProjectActivityRow): ProjectActivity {
    return {
        id: row.id,
        projectId: row.project_id,
        code: row.code,
        name: row.name,
        description: row.description ?? undefined,
        group: row.group as ActivityGroup,
        baseHours: Number(row.base_hours),
        smMultiplier: Number(row.sm_multiplier),
        lgMultiplier: Number(row.lg_multiplier),
        interventionType: row.intervention_type as InterventionType,
        effortModifier: Number(row.effort_modifier),
        sourceActivityCode: row.source_activity_code,
        blueprintNodeName: row.blueprint_node_name,
        blueprintNodeType: row.blueprint_node_type as BlueprintNodeType | null,
        aiRationale: row.ai_rationale,
        confidence: row.confidence != null ? Number(row.confidence) : null,
        isEnabled: row.is_enabled,
        position: row.position,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapInputToRow(
    input: CreateProjectActivityInput,
    position: number,
): Record<string, unknown> {
    return {
        project_id: input.projectId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        group: input.group,
        base_hours: input.baseHours,
        sm_multiplier: input.smMultiplier ?? 0.50,
        lg_multiplier: input.lgMultiplier ?? 2.00,
        intervention_type: input.interventionType,
        effort_modifier: input.effortModifier ?? 1.00,
        source_activity_code: input.sourceActivityCode ?? null,
        blueprint_node_name: input.blueprintNodeName ?? null,
        blueprint_node_type: input.blueprintNodeType ?? null,
        ai_rationale: input.aiRationale ?? null,
        confidence: input.confidence ?? null,
        is_enabled: input.isEnabled ?? true,
        position: input.position ?? position,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all activities for a project, ordered by position.
 */
export async function getProjectActivities(
    projectId: string,
): Promise<ProjectActivity[]> {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });

    if (error) throw new Error(`Failed to fetch project activities: ${error.message}`);
    return (data ?? []).map(mapActivityRowToDomain);
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE (bulk)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bulk-create project activities for a given project.
 * Returns the created activities.
 */
export async function createProjectActivities(
    projectId: string,
    activities: Omit<CreateProjectActivityInput, 'projectId'>[],
): Promise<ProjectActivity[]> {
    console.log('[project-activity-repo] createProjectActivities called', {
        projectId,
        activitiesCount: activities.length,
    });
    if (activities.length === 0) {
        console.warn('[project-activity-repo] No activities to insert, returning early');
        return [];
    }

    const rows = activities.map((a, idx) =>
        mapInputToRow({ ...a, projectId }, idx),
    );
    console.log('[project-activity-repo] Rows to insert:', JSON.stringify(rows, null, 2));

    const { data, error, status } = await supabase
        .from(TABLE)
        .insert(rows)
        .select();

    console.log('[project-activity-repo] Supabase response', { status, error, dataLength: data?.length });
    if (error) throw new Error(`Failed to create project activities: ${error.message}`);
    return (data ?? []).map(mapActivityRowToDomain);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a single project activity field(s).
 */
export async function updateProjectActivity(
    id: string,
    updates: Partial<Pick<CreateProjectActivityInput, 'name' | 'description' | 'group' | 'baseHours' | 'interventionType' | 'effortModifier' | 'isEnabled' | 'position'>>,
): Promise<ProjectActivity> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.group !== undefined) payload.group = updates.group;
    if (updates.baseHours !== undefined) payload.base_hours = updates.baseHours;
    if (updates.interventionType !== undefined) payload.intervention_type = updates.interventionType;
    if (updates.effortModifier !== undefined) payload.effort_modifier = updates.effortModifier;
    if (updates.isEnabled !== undefined) payload.is_enabled = updates.isEnabled;
    if (updates.position !== undefined) payload.position = updates.position;

    const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(`Failed to update project activity: ${error.message}`);
    return mapActivityRowToDomain(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a single project activity by ID.
 */
export async function deleteProjectActivity(id: string): Promise<void> {
    const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('id', id);

    if (error) throw new Error(`Failed to delete project activity: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle the is_enabled flag for a project activity.
 */
export async function toggleProjectActivity(
    id: string,
    isEnabled: boolean,
): Promise<void> {
    const { error } = await supabase
        .from(TABLE)
        .update({ is_enabled: isEnabled })
        .eq('id', id);

    if (error) throw new Error(`Failed to toggle project activity: ${error.message}`);
}
