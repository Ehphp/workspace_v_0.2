import { WorkflowDefinition } from '../types';

export const TeamWorkflow: WorkflowDefinition = {
    name: 'Team Organization',
    transitions: [
        // Created -> Propose
        {
            from: 'CREATED',
            to: 'PROPOSED',
            label: 'Propose for Review',
            guards: [] // Anyone can propose
        },
        // Propose -> Selected (Editor/Admin only)
        {
            from: 'PROPOSED',
            to: 'SELECTED',
            label: 'Select for Development',
            guards: [
                (ctx) => ({
                    allowed: ctx.userRole === 'admin' || ctx.userRole === 'editor',
                    reason: 'Only Editors or Admins can select requirements'
                })
            ]
        },
        // Propose -> Cancel (Reject)
        // (Optional: add REJECTED state later, for now maybe back to CREATED or delete)

        // Selected -> Scheduled (Must be estimated)
        {
            from: 'SELECTED',
            to: 'SCHEDULED',
            label: 'Schedule',
            guards: [
                (ctx) => ({
                    allowed: ctx.estimationsCount > 0, // Simplified check
                    reason: 'Requirement must have at least one estimation before scheduling'
                })
            ]
        },
        // Scheduled -> In Progress
        {
            from: 'SCHEDULED',
            to: 'IN_PROGRESS',
            label: 'Start Work',
            guards: []
        },
        // In Progress -> Done
        {
            from: 'IN_PROGRESS',
            to: 'DONE',
            label: 'Complete',
            guards: []
        },
        // Any -> Done (Admin override) (?) - for now stick to linear

        // Done -> In Progress (Reopen)
        {
            from: 'DONE',
            to: 'IN_PROGRESS',
            label: 'Reopen',
            guards: [
                (ctx) => ({
                    allowed: ctx.userRole === 'admin',
                    reason: 'Only Admins can reopen completed requirements'
                })
            ]
        }
    ]
};
