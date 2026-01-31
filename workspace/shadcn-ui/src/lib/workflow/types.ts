export type RequirementState = 'CREATED' | 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'DONE';

export interface WorkflowContext {
    userRole: 'admin' | 'editor' | 'viewer';
    isOwner: boolean;
    hasEstimation: boolean;
    estimationsCount: number;
}

export interface Transition {
    from: RequirementState;
    to: RequirementState;
    label: string; // Action name, e.g., "Approve", "Start Work"
    guards?: Guard[];
    sideEffects?: SideEffect[];
}

export type Guard = (context: WorkflowContext) => GuardResult;

export interface GuardResult {
    allowed: boolean;
    reason?: string;
}

export type SideEffect = (requirementId: string, context: WorkflowContext) => Promise<void>;

export interface WorkflowDefinition {
    name: string;
    transitions: Transition[];
}
