/**
 * Project Repository — the single source of truth for project persistence.
 *
 * ALL Supabase queries that touch the `projects` table are centralised here.
 * No other module should use `.from('projects')` directly.
 */

import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/database';
import type { CreateProjectInput, UpdateProjectInput } from './project-types';
import {
    PROJECT_TABLE,
    PROJECT_FK,
    mapCreateProjectToInsert,
    mapUpdateProjectToPayload,
} from './project-mapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
class RepositoryError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'RepositoryError';
    }
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/** Fetch a single project by ID. Throws on not-found. */
export async function fetchProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase
        .from(PROJECT_TABLE)
        .select('*')
        .eq('id', projectId)
        .single();

    if (error || !data) {
        throw new RepositoryError(
            error?.message ?? 'Project not found',
            error,
        );
    }
    return data as Project;
}

/** Fetch a single project scoped by user (for ownership checks). */
export async function fetchProjectByUser(
    projectId: string,
    userId: string,
    signal?: AbortSignal,
): Promise<Project | null> {
    let query = supabase
        .from(PROJECT_TABLE)
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

    if (signal) {
        query = (query as any).abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) return null;
    return data as Project;
}

export interface FetchProjectsOptions {
    organizationId: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    excludeStatus?: string;
    selectColumns?: string;
    orderBy?: string;
    ascending?: boolean;
}

/** List projects for an organization with optional filters. */
export async function fetchProjects(opts: FetchProjectsOptions): Promise<Project[]> {
    let query = supabase
        .from(PROJECT_TABLE)
        .select(opts.selectColumns || '*')
        .eq('organization_id', opts.organizationId)
        .order(opts.orderBy || 'updated_at', { ascending: opts.ascending ?? false });

    if (opts.status) {
        query = query.eq('status', opts.status);
    }
    if (opts.excludeStatus) {
        query = query.neq('status', opts.excludeStatus);
    }

    const { data, error } = await query;
    if (error) throw new RepositoryError(error.message, error);
    return (data || []) as unknown as Project[];
}

/** Fetch project IDs for an organization (lightweight query for aggregation). */
export async function fetchProjectIds(organizationId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from(PROJECT_TABLE)
        .select('id')
        .eq('organization_id', organizationId);

    if (error) throw new RepositoryError(error.message, error);
    return (data || []).map((row: { id: string }) => row.id);
}

/** Fetch project IDs + names for an organization. */
export async function fetchProjectIdsAndNames(
    organizationId: string,
): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
        .from(PROJECT_TABLE)
        .select('id, name')
        .eq('organization_id', organizationId);

    if (error) throw new RepositoryError(error.message, error);
    return (data || []) as { id: string; name: string }[];
}

/** Fetch only the project name (used for breadcrumbs). */
export async function fetchProjectName(projectId: string): Promise<string | null> {
    const { data } = await supabase
        .from(PROJECT_TABLE)
        .select('name')
        .eq('id', projectId)
        .single();

    return data?.name ?? null;
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/** Create a new project. Returns the created row. */
export async function createProject(input: CreateProjectInput): Promise<Project> {
    const payload = mapCreateProjectToInsert(input);

    const { data, error } = await supabase
        .from(PROJECT_TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error || !data) {
        throw new RepositoryError(
            error?.message ?? 'Failed to create project',
            error,
        );
    }
    return data as Project;
}

/** Update a project. Returns the updated row. */
export async function updateProject(
    projectId: string,
    input: UpdateProjectInput,
): Promise<Project> {
    const payload = mapUpdateProjectToPayload(input);

    const { data, error } = await supabase
        .from(PROJECT_TABLE)
        .update(payload)
        .eq('id', projectId)
        .select('*')
        .single();

    if (error || !data) {
        throw new RepositoryError(
            error?.message ?? 'Failed to update project',
            error,
        );
    }
    return data as Project;
}

/** Patch a single column on the project (e.g. status). */
export async function patchProject(
    projectId: string,
    patch: Record<string, unknown>,
): Promise<void> {
    const { error } = await supabase
        .from(PROJECT_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', projectId);

    if (error) throw new RepositoryError(error.message, error);
}

/** Delete a project and its requirements. */
export async function deleteProject(projectId: string): Promise<void> {
    // Delete requirements first (cascade should handle this, but being explicit)
    await supabase
        .from('requirements')
        .delete()
        .eq(PROJECT_FK, projectId);

    const { error } = await supabase
        .from(PROJECT_TABLE)
        .delete()
        .eq('id', projectId);

    if (error) throw new RepositoryError(error.message, error);
}

/** Delete all requirements in a project (clear project). */
export async function clearProjectRequirements(projectId: string): Promise<void> {
    const { error } = await supabase
        .from('requirements')
        .delete()
        .eq(PROJECT_FK, projectId);

    if (error) throw new RepositoryError(error.message, error);
}

// ---------------------------------------------------------------------------
// Re-export the FK constant so callers can build requirement queries
// without hardcoding 'project_id'.
// ---------------------------------------------------------------------------
export { PROJECT_FK };
