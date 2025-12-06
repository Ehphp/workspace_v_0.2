import { RequirementState, WorkflowContext, WorkflowDefinition, Transition, GuardResult } from './types';

export class WorkflowEngine {
    private definition: WorkflowDefinition;

    constructor(definition: WorkflowDefinition) {
        this.definition = definition;
    }

    /**
     * Get all possible transitions from the current state, 
     * evaluating guards against the provided context.
     */
    getAvailableTransitions(currentState: RequirementState, context: WorkflowContext): TransitionWithValidation[] {
        const potentialTransitions = this.definition.transitions.filter(t => t.from === currentState);

        return potentialTransitions.map(transition => {
            const guardResults = this.evaluateGuards(transition, context);
            const isAllowed = guardResults.every(r => r.allowed);
            // Collect unique reasons for rejection
            const reasons = guardResults
                .filter(r => !r.allowed && r.reason)
                .map(r => r.reason as string)
                .filter((v, i, a) => a.indexOf(v) === i);

            return {
                ...transition,
                isAllowed,
                reasons
            };
        });
    }

    /**
     * Check if a specific transition is valid.
     */
    canTransition(currentState: RequirementState, targetState: RequirementState, context: WorkflowContext): GuardResult {
        const transition = this.definition.transitions.find(
            t => t.from === currentState && t.to === targetState
        );

        if (!transition) {
            return { allowed: false, reason: 'Invalid transition definition' };
        }

        const guardResults = this.evaluateGuards(transition, context);
        const firstFailure = guardResults.find(r => !r.allowed);

        if (firstFailure) {
            return firstFailure;
        }

        return { allowed: true };
    }

    private evaluateGuards(transition: Transition, context: WorkflowContext): GuardResult[] {
        if (!transition.guards || transition.guards.length === 0) {
            return [{ allowed: true }];
        }
        return transition.guards.map(guard => guard(context));
    }
}

export interface TransitionWithValidation extends Transition {
    isAllowed: boolean;
    reasons: string[];
}
