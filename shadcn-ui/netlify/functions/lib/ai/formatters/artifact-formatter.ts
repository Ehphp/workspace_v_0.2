/**
 * Generic artifact-to-prompt formatter.
 *
 * Converts any structured artifact object into a readable prompt block.
 * Auto-maps all fields — adding a field to the source type is sufficient,
 * no manual update needed here.
 *
 * Usage:
 *   formatArtifactBlock(understanding, 'COMPRENSIONE STRUTTURATA DEL REQUISITO', { skip: ['metadata'] })
 *   formatArtifactBlock(impactMap, 'MAPPA IMPATTO ARCHITETTURALE', { skip: ['metadata'] })
 */

const DEFAULT_SKIP = new Set(['metadata']);

function formatValue(val: unknown, depth: number, skip: Set<string>): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
        return (val > 0 && val < 1 && !Number.isInteger(val))
            ? `${Math.round(val * 100)}%`
            : String(val);
    }
    if (typeof val !== 'object') return String(val);
    if (Array.isArray(val)) {
        if (val.length === 0) return '(nessuno)';
        if (typeof val[0] !== 'object' || val[0] === null) {
            return val.map(String).join(', ');
        }
        return val
            .map(item => `\n${formatObject(item as Record<string, unknown>, depth + 1, skip)}`)
            .join('');
    }
    return `\n${formatObject(val as Record<string, unknown>, depth + 1, skip)}`;
}

function formatObject(obj: Record<string, unknown>, depth: number, skip: Set<string>): string {
    const pad = '  '.repeat(depth);
    return Object.entries(obj)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => `${pad}- ${k}: ${formatValue(v, depth, skip)}`)
        .join('\n');
}

export interface FormatArtifactOptions {
    /** Keys to exclude from the output (default: ['metadata']) */
    skip?: string[];
    /** Optional instruction line appended after the header */
    instruction?: string;
}

/**
 * Format any artifact object as a labelled prompt block.
 * Returns empty string if artifact is absent or not an object.
 */
export function formatArtifactBlock(
    artifact: Record<string, unknown> | undefined | null,
    header: string,
    options: FormatArtifactOptions = {},
): string {
    if (!artifact || typeof artifact !== 'object') return '';

    const skip = options.skip ? new Set([...DEFAULT_SKIP, ...options.skip]) : DEFAULT_SKIP;

    try {
        const lines: string[] = [`\n${header}:`];
        if (options.instruction) lines.push(`(${options.instruction})`);
        lines.push(formatObject(artifact as Record<string, unknown>, 0, skip));
        return lines.join('\n');
    } catch {
        return '';
    }
}
