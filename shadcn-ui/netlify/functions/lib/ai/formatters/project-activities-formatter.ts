/**
 * Project-Scoped Activities Formatter
 *
 * Formats project_activities (PRJ_* codes) into a prompt block that instructs
 * the LLM to prioritise them over generic catalog entries.
 */

import type { ProjectActivity } from '../../activities';

/**
 * Build a prompt block listing project-scoped activities.
 * Returns an empty string when no activities are provided.
 */
export function formatProjectActivitiesBlock(
    activities: ProjectActivity[] | undefined,
): string {
    if (!activities || activities.length === 0) return '';

    const lines: string[] = [];
    lines.push('ATTIVITÀ PROGETTO-SPECIFICHE (PRIORITÀ MASSIMA):');
    lines.push('Le seguenti attività sono state definite per questo progetto e DEVONO avere la precedenza sulle attività generiche del catalogo quando coprono la stessa funzionalità.');
    lines.push('');

    for (const a of activities) {
        const parts = [`- ${a.code}: ${a.name}`];
        if (a.base_hours) parts.push(`(${a.base_hours}h)`);
        if (a.group) parts.push(`[${a.group}]`);
        if (a.intervention_type) parts.push(`tipo: ${a.intervention_type}`);
        if (a.description) parts.push(`— ${a.description.substring(0, 120)}`);
        lines.push(parts.join(' '));
    }

    lines.push('');
    lines.push('⚠️ Quando selezioni attività, PREFERISCI sempre i codici PRJ_* sopra elencati rispetto ai codici generici che coprono lo stesso ambito funzionale.');

    return lines.join('\n');
}
