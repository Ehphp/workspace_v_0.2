import { describe, it, expect } from 'vitest';
import { WorkflowEngine } from './Engine';
import { WorkflowDefinition, WorkflowContext, Transition } from './types';

describe('WorkflowEngine', () => {
    // Mock Definition
    const mockDefinition: WorkflowDefinition = {
        name: 'Test Workflow',
        transitions: [
            {
                from: 'CREATED',
                to: 'PROPOSED',
                label: 'Propose',
                guards: [
                    (ctx) => ({ allowed: ctx.userRole !== 'viewer', reason: 'Viewer cannot propose' })
                ]
            },
            {
                from: 'PROPOSED',
                to: 'SELECTED',
                label: 'Select',
                guards: [
                    (ctx) => ({ allowed: ctx.isOwner, reason: 'Only owner can select' })
                ]
            }
        ]
    };

    const engine = new WorkflowEngine(mockDefinition);

    const baseContext: WorkflowContext = {
        userRole: 'editor',
        isOwner: false,
        hasEstimation: false,
        estimationsCount: 0
    };

    it('should return valid transitions based on context', () => {
        const transitions = engine.getAvailableTransitions('CREATED', baseContext);
        expect(transitions).toHaveLength(1);
        expect(transitions[0].to).toBe('PROPOSED');
        expect(transitions[0].isAllowed).toBe(true);
    });

    it('should mark transition as not allowed if guard fails', () => {
        const viewerContext: WorkflowContext = { ...baseContext, userRole: 'viewer' };
        const transitions = engine.getAvailableTransitions('CREATED', viewerContext);

        expect(transitions).toHaveLength(1);
        expect(transitions[0].isAllowed).toBe(false);
        expect(transitions[0].reasons).toContain('Viewer cannot propose');
    });

    it('should allow check for specific transition', () => {
        const result = engine.canTransition('CREATED', 'PROPOSED', baseContext);
        expect(result.allowed).toBe(true);
    });

    it('should deny specific transition if guard fails', () => {
        const result = engine.canTransition('PROPOSED', 'SELECTED', baseContext);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Only owner can select');
    });

    it('should return error for undefined transition', () => {
        const result = engine.canTransition('CREATED', 'DONE', baseContext);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Invalid transition definition');
    });
});
