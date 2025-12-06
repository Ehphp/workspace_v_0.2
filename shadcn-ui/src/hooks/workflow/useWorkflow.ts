import { useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Requirement, RequirementState } from '@/types/database';
import { WorkflowEngine } from '@/lib/workflow/Engine';
import { PersonalWorkflow } from '@/lib/workflow/definitions/personal';
import { TeamWorkflow } from '@/lib/workflow/definitions/team';
import { WorkflowContext } from '@/lib/workflow/types';

export function useWorkflow(requirement: Requirement | null) {
    const { currentOrganization, userRole } = useAuthStore();
    const { user } = useAuthStore.getState(); // Get full user object for owner check

    const engine = useMemo(() => {
        const isPersonal = !currentOrganization || currentOrganization.type === 'personal';
        const definition = isPersonal ? PersonalWorkflow : TeamWorkflow;
        return new WorkflowEngine(definition);
    }, [currentOrganization]);

    const context = useMemo<WorkflowContext>(() => {
        if (!requirement) {
            return {
                userRole: 'viewer',
                isOwner: false,
                hasEstimation: false,
                estimationsCount: 0
            };
        }

        // Determine effective role
        // If personal space, role is effectively admin for the owner
        const isPersonal = !currentOrganization || currentOrganization.type === 'personal';
        const effectiveRole = isPersonal ? 'admin' : (userRole || 'viewer');

        // Check ownership (business_owner matches user email or id? Simplified to true for now if personal)
        const isOwner = isPersonal || (requirement.business_owner === user?.email); // Simplified

        return {
            userRole: effectiveRole,
            isOwner,
            hasEstimation: !!requirement.assigned_estimation_id,
            estimationsCount: requirement.assigned_estimation_id ? 1 : 0 // Simplified for MVP
        };
    }, [requirement, currentOrganization, userRole, user]);

    const availableTransitions = useMemo(() => {
        if (!requirement) return [];
        return engine.getAvailableTransitions(requirement.state as RequirementState, context);
    }, [engine, requirement, context]);

    return {
        availableTransitions,
        canTransition: (to: RequirementState) =>
            requirement ? engine.canTransition(requirement.state as RequirementState, to, context) : { allowed: false, reason: 'No requirement' }
    };
}
