/**
 * Project ↔ DB mapper.
 *
 * Mapping helpers between domain types and DB row shapes.
 * Application code must never import from here—use project-repository instead.
 */

import type { Project } from '@/types/database';
import type { CreateProjectInput, UpdateProjectInput } from './project-types';



// ---------------------------------------------------------------------------
// Domain → DB (insert)
// ---------------------------------------------------------------------------
export function mapCreateProjectToInsert(input: CreateProjectInput): Record<string, unknown> {
    return {
        user_id: input.userId,
        organization_id: input.organizationId,
        name: input.name,
        description: input.description || '',
        owner: input.owner || '',
        technology_id: input.technologyId ?? null,
        status: input.status,
        project_type: input.projectType || null,
        domain: input.domain || null,
        scope: input.scope || null,
        team_size: input.teamSize || null,
        deadline_pressure: input.deadlinePressure || null,
        methodology: input.methodology || null,
    };
}

// ---------------------------------------------------------------------------
// Domain → DB (update)
// ---------------------------------------------------------------------------
export function mapUpdateProjectToPayload(input: UpdateProjectInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.owner !== undefined) payload.owner = input.owner;
    if (input.technologyId !== undefined) payload.technology_id = input.technologyId;
    if (input.status !== undefined) payload.status = input.status;
    if (input.projectType !== undefined) payload.project_type = input.projectType;
    if (input.domain !== undefined) payload.domain = input.domain;
    if (input.scope !== undefined) payload.scope = input.scope;
    if (input.teamSize !== undefined) payload.team_size = input.teamSize;
    if (input.deadlinePressure !== undefined) payload.deadline_pressure = input.deadlinePressure;
    if (input.methodology !== undefined) payload.methodology = input.methodology;

    return payload;
}

// ---------------------------------------------------------------------------
// DB constants — table and column names
// ---------------------------------------------------------------------------
/** The DB table that stores projects. */
export const PROJECT_TABLE = 'projects' as const;

/** The FK column on `requirements` that references the project. */
export const PROJECT_FK = 'project_id' as const;
