import { RequirementState, WorkflowDefinition } from '../types';

export const PersonalWorkflow: WorkflowDefinition = {
    name: 'Personal Space',
    transitions: getAllToAll()
};

function getAllToAll() {
    const states: RequirementState[] = ['CREATED', 'PROPOSED', 'SELECTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE'];
    const transitions = [];

    for (const from of states) {
        for (const to of states) {
            if (from === to) continue;
            transitions.push({
                from,
                to,
                label: `Move to ${to.toLowerCase().replace('_', ' ')}`,
                guards: [],
                sideEffects: []
            });
        }
    }
    return transitions;
}
