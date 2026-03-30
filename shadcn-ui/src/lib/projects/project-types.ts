/**
 * Canonical domain types for the Project entity.
 *
 * These are the only project-related types that application code should use.
 * The underlying persistence layer (`projects` table) is hidden behind
 * the project-repository and project-mapper modules.
 */

export type { Project, ProjectType, ProjectScope, DeadlinePressure, Methodology } from '@/types/database';

export interface CreateProjectInput {
    userId: string;
    organizationId: string;
    name: string;
    description?: string;
    owner?: string;
    technologyId?: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    projectType?: string | null;
    domain?: string | null;
    scope?: string | null;
    teamSize?: number | null;
    deadlinePressure?: string | null;
    methodology?: string | null;
}

export interface UpdateProjectInput {
    name?: string;
    description?: string;
    owner?: string;
    technologyId?: string | null;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    projectType?: string | null;
    domain?: string | null;
    scope?: string | null;
    teamSize?: number | null;
    deadlinePressure?: string | null;
    methodology?: string | null;
}
