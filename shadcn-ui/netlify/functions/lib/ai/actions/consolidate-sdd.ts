/**
 * AI Action: Consolidate partial SDDs into a final Structured Document Digest.
 *
 * Receives N partial SDDs (from generatePartialSDD) and produces a single,
 * unified SDD via an LLM consolidation pass. Simple string arrays are
 * pre-merged as reference; complex semantic fields are consolidated by the LLM.
 *
 * Includes post-consolidation validation (coverage check, empty section check).
 */

import { z } from 'zod';
import type { PartialSDD } from './generate-partial-sdd';
import {
    CONSOLIDATION_SYSTEM_PROMPT,
    createConsolidationResponseSchema,
} from '../prompts/consolidation-sdd';
import type { StructuredDocumentDigest } from '../../../domain/project/project-technical-blueprint.types';

// Re-use the existing strict SDD schema for validation
// (same schema used in generate-project-from-documentation.ts)
const StructuredDocumentDigestSchema = z.object({
    functionalAreas: z.array(z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        keyPassages: z.array(z.string().max(300)).max(5),
    })).min(1).max(10),
    businessEntities: z.array(z.object({
        name: z.string().min(1).max(200),
        role: z.string().min(1).max(300),
    })).max(20),
    externalSystems: z.array(z.object({
        name: z.string().min(1).max(200),
        interactionDescription: z.string().min(1).max(300),
    })).max(15),
    technicalConstraints: z.array(z.string().max(500)).max(10),
    nonFunctionalRequirements: z.array(z.string().max(500)).max(10),
    keyPassages: z.array(z.object({
        label: z.string().min(1).max(100),
        text: z.string().min(1).max(300),
    })).min(3).max(20),
    operationalWorkflows: z.array(z.object({
        name: z.string().min(1).max(200),
        trigger: z.string().min(1).max(300),
        actors: z.array(z.string().min(1).max(200)).max(10),
        keySteps: z.string().min(1).max(500),
    })).min(0).max(10),
    ambiguities: z.array(z.string().max(500)).max(10),
    documentQuality: z.enum(['high', 'medium', 'low']),
});

/** Minimal provider interface */
interface LLMProvider {
    generateContent(params: {
        model: string;
        temperature: number;
        maxTokens: number;
        responseFormat: any;
        systemPrompt: string;
        userPrompt: string;
        reasoningEffort?: 'high' | 'medium' | 'low' | 'minimal';
        options?: { timeout: number; maxRetries: number };
    }): Promise<string>;
}

export interface ConsolidationResult {
    sdd: StructuredDocumentDigest;
    warnings: string[];
}

/**
 * Consolidate N partial SDDs into a single unified SDD.
 *
 * @param partials - Array of validated partial SDDs
 * @param provider - LLM provider
 * @returns ConsolidationResult with final SDD and any quality warnings
 * @throws If consolidation fails after 1 retry (no mechanical fallback)
 */
export async function consolidatePartialSDDs(
    partials: PartialSDD[],
    provider: LLMProvider,
): Promise<ConsolidationResult> {
    const startMs = Date.now();

    console.log(`[consolidate-sdd] Starting consolidation of ${partials.length} partial SDDs`);

    // ── Pre-merge simple string arrays as reference ──────────────────
    const preMerged = preMergeSimpleArrays(partials);

    // ── Compute counts for the prompt ────────────────────────────────
    const counts = computePartialCounts(partials);

    // ── Build user prompt ────────────────────────────────────────────
    const userPrompt = buildConsolidationPrompt(partials, preMerged, counts);

    // ── First attempt ────────────────────────────────────────────────
    try {
        const sdd = await callConsolidationLLM(userPrompt, provider);
        const elapsedMs = Date.now() - startMs;
        console.log(`[consolidate-sdd] Consolidation OK (${elapsedMs}ms)`);
        const warnings = runPostConsolidationChecks(sdd, partials);
        return { sdd, warnings };
    } catch (firstErr) {
        console.warn('[consolidate-sdd] First attempt failed:', firstErr);
    }

    // ── Retry with reduced input ─────────────────────────────────────
    console.log(`[consolidate-sdd] Retrying with reduced input (max 6 partials)`);
    const reducedPartials = selectUniformSubset(partials, 6);
    const reducedPreMerged = preMergeSimpleArrays(reducedPartials);
    const reducedCounts = computePartialCounts(reducedPartials);
    const reducedPrompt = buildConsolidationPrompt(reducedPartials, reducedPreMerged, reducedCounts);

    try {
        const sdd = await callConsolidationLLM(reducedPrompt, provider);
        const elapsedMs = Date.now() - startMs;
        console.log(`[consolidate-sdd] Retry OK with ${reducedPartials.length} partials (${elapsedMs}ms)`);
        const warnings = runPostConsolidationChecks(sdd, partials);
        warnings.push(`consolidation_retried_with_${reducedPartials.length}_of_${partials.length}_partials`);
        return { sdd, warnings };
    } catch (retryErr) {
        const elapsedMs = Date.now() - startMs;
        console.error(`[consolidate-sdd] Retry also failed after ${elapsedMs}ms:`, retryErr);
        throw new Error(
            `SDD consolidation failed after retry. ${partials.length} partials could not be consolidated. ` +
            `No mechanical fallback — pipeline cannot proceed.`,
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM call
// ─────────────────────────────────────────────────────────────────────────────

async function callConsolidationLLM(
    userPrompt: string,
    provider: LLMProvider,
): Promise<StructuredDocumentDigest> {
    const schema = createConsolidationResponseSchema();

    const raw = await provider.generateContent({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        maxTokens: 4000,
        responseFormat: schema as any,
        systemPrompt: CONSOLIDATION_SYSTEM_PROMPT,
        userPrompt,
        reasoningEffort: 'low',
        options: { timeout: 90_000, maxRetries: 0 },
    });

    if (!raw) {
        throw new Error('Empty LLM response for SDD consolidation');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('LLM returned invalid JSON for SDD consolidation');
    }

    const validation = StructuredDocumentDigestSchema.safeParse(parsed);
    if (!validation.success) {
        console.error('[consolidate-sdd] Schema validation failed:', validation.error.issues);
        throw new Error('Consolidated SDD failed schema validation');
    }

    return validation.data as StructuredDocumentDigest;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ─────────────────────────────────────────────────────────────────────────────

interface PreMerged {
    technicalConstraints: string[];
    nonFunctionalRequirements: string[];
    ambiguities: string[];
}

interface PartialCounts {
    totalAreas: number;
    uniqueAreaTitles: number;
    totalEntities: number;
    uniqueEntityNames: number;
    totalSystems: number;
    uniqueSystemNames: number;
    totalPassages: number;
    totalWorkflows: number;
    uniqueWorkflowNames: number;
}

function buildConsolidationPrompt(
    partials: PartialSDD[],
    preMerged: PreMerged,
    counts: PartialCounts,
): string {
    const sections: string[] = [];

    // Header with counts
    sections.push(
        `CONSOLIDAMENTO DI ${partials.length} DIGEST PARZIALI`,
        '',
        `CONTEGGI TOTALI DAI PARTIALS:`,
        `- Aree funzionali: ${counts.totalAreas} totali, ${counts.uniqueAreaTitles} titoli unici`,
        `- Business entities: ${counts.totalEntities} totali, ${counts.uniqueEntityNames} nomi unici`,
        `- Sistemi esterni: ${counts.totalSystems} totali, ${counts.uniqueSystemNames} nomi unici`,
        `- Workflow operativi: ${counts.totalWorkflows} totali, ${counts.uniqueWorkflowNames} nomi unici`,
        `- Key passages: ${counts.totalPassages} totali`,
        ``,
        `ASSICURATI di non perdere informazione significativa. Il digest finale deve coprire`,
        `almeno il 70% delle entità uniche elencate sopra.`,
        '',
    );

    // Pre-merged simple arrays (reference)
    if (preMerged.technicalConstraints.length > 0) {
        sections.push(
            `VINCOLI TECNICI (pre-consolidati, puoi raffinare):`,
            ...preMerged.technicalConstraints.map(c => `  - ${c}`),
            '',
        );
    }
    if (preMerged.nonFunctionalRequirements.length > 0) {
        sections.push(
            `REQUISITI NON FUNZIONALI (pre-consolidati, puoi raffinare):`,
            ...preMerged.nonFunctionalRequirements.map(r => `  - ${r}`),
            '',
        );
    }
    if (preMerged.ambiguities.length > 0) {
        sections.push(
            `AMBIGUITÀ (pre-consolidate, puoi raffinare):`,
            ...preMerged.ambiguities.map(a => `  - ${a}`),
            '',
        );
    }

    // Each partial as a numbered block
    sections.push(`${'═'.repeat(60)}`);
    sections.push(`DIGEST PARZIALI DA CONSOLIDARE`);
    sections.push(`${'═'.repeat(60)}`);
    sections.push('');

    for (let i = 0; i < partials.length; i++) {
        const p = partials[i];
        sections.push(`── PARTIAL ${i + 1} di ${partials.length} ──`);
        sections.push(JSON.stringify(p, null, 2));
        sections.push('');
    }

    return sections.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-merge helpers (simple string arrays only)
// ─────────────────────────────────────────────────────────────────────────────

function preMergeSimpleArrays(partials: PartialSDD[]): PreMerged {
    const constraints = new Set<string>();
    const nfrs = new Set<string>();
    const ambiguities = new Set<string>();

    for (const p of partials) {
        for (const c of p.technicalConstraints) constraints.add(c.trim());
        for (const n of p.nonFunctionalRequirements) nfrs.add(n.trim());
        for (const a of p.ambiguities) ambiguities.add(a.trim());
    }

    return {
        technicalConstraints: [...constraints].slice(0, 10),
        nonFunctionalRequirements: [...nfrs].slice(0, 10),
        ambiguities: [...ambiguities].slice(0, 10),
    };
}

function computePartialCounts(partials: PartialSDD[]): PartialCounts {
    const areaTitles = new Set<string>();
    const entityNames = new Set<string>();
    const systemNames = new Set<string>();
    const workflowNames = new Set<string>();
    let totalAreas = 0;
    let totalEntities = 0;
    let totalSystems = 0;
    let totalPassages = 0;
    let totalWorkflows = 0;

    for (const p of partials) {
        totalAreas += p.functionalAreas.length;
        for (const a of p.functionalAreas) areaTitles.add(a.title.toLowerCase().trim());

        totalEntities += p.businessEntities.length;
        for (const e of p.businessEntities) entityNames.add(e.name.toLowerCase().trim());

        totalSystems += p.externalSystems.length;
        for (const s of p.externalSystems) systemNames.add(s.name.toLowerCase().trim());

        totalPassages += p.keyPassages.length;

        totalWorkflows += p.operationalWorkflows.length;
        for (const w of p.operationalWorkflows) workflowNames.add(w.name.toLowerCase().trim());
    }

    return {
        totalAreas,
        uniqueAreaTitles: areaTitles.size,
        totalEntities,
        uniqueEntityNames: entityNames.size,
        totalSystems,
        uniqueSystemNames: systemNames.size,
        totalPassages,
        totalWorkflows,
        uniqueWorkflowNames: workflowNames.size,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry subset selection
// ─────────────────────────────────────────────────────────────────────────────

/** Select up to maxCount partials uniformly distributed from the original set */
function selectUniformSubset<T>(items: T[], maxCount: number): T[] {
    if (items.length <= maxCount) return items;
    const step = items.length / maxCount;
    const result: T[] = [];
    for (let i = 0; i < maxCount; i++) {
        result.push(items[Math.floor(i * step)]);
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-consolidation validation (Task 7)
// ─────────────────────────────────────────────────────────────────────────────

function runPostConsolidationChecks(
    sdd: StructuredDocumentDigest,
    partials: PartialSDD[],
): string[] {
    const warnings: string[] = [];

    // Coverage check: named entities in final vs union of partials
    const partialAreaTitles = new Set<string>();
    const partialEntityNames = new Set<string>();
    const partialSystemNames = new Set<string>();
    const partialWorkflowNames = new Set<string>();
    for (const p of partials) {
        for (const a of p.functionalAreas) partialAreaTitles.add(a.title.toLowerCase().trim());
        for (const e of p.businessEntities) partialEntityNames.add(e.name.toLowerCase().trim());
        for (const s of p.externalSystems) partialSystemNames.add(s.name.toLowerCase().trim());
        for (const w of p.operationalWorkflows) partialWorkflowNames.add(w.name.toLowerCase().trim());
    }

    const finalAreaTitles = new Set(sdd.functionalAreas.map(a => a.title.toLowerCase().trim()));
    const finalEntityNames = new Set(sdd.businessEntities.map(e => e.name.toLowerCase().trim()));
    const finalSystemNames = new Set(sdd.externalSystems.map(s => s.name.toLowerCase().trim()));
    const finalWorkflowNames = new Set(sdd.operationalWorkflows.map(w => w.name.toLowerCase().trim()));

    const totalUnique = partialAreaTitles.size + partialEntityNames.size + partialSystemNames.size + partialWorkflowNames.size;
    if (totalUnique > 0) {
        let covered = 0;
        for (const t of partialAreaTitles) if (finalAreaTitles.has(t)) covered++;
        for (const n of partialEntityNames) if (finalEntityNames.has(n)) covered++;
        for (const s of partialSystemNames) if (finalSystemNames.has(s)) covered++;
        for (const w of partialWorkflowNames) if (finalWorkflowNames.has(w)) covered++;

        const coverageRatio = covered / totalUnique;
        if (coverageRatio < 0.7) {
            const msg = `low_consolidation_coverage: ${(coverageRatio * 100).toFixed(0)}% (${covered}/${totalUnique} unique entities)`;
            console.warn(`[consolidate-sdd] ${msg}`);
            warnings.push(msg);
        } else {
            console.log(`[consolidate-sdd] Coverage OK: ${(coverageRatio * 100).toFixed(0)}% (${covered}/${totalUnique})`);
        }
    }

    // Empty section check: field present in ≥2 partials but empty in final
    const fieldChecks: Array<{
        name: string;
        countInPartials: number;
        countInFinal: number;
    }> = [
            {
                name: 'functionalAreas',
                countInPartials: partials.filter(p => p.functionalAreas.length > 0).length,
                countInFinal: sdd.functionalAreas.length,
            },
            {
                name: 'businessEntities',
                countInPartials: partials.filter(p => p.businessEntities.length > 0).length,
                countInFinal: sdd.businessEntities.length,
            },
            {
                name: 'externalSystems',
                countInPartials: partials.filter(p => p.externalSystems.length > 0).length,
                countInFinal: sdd.externalSystems.length,
            },
            {
                name: 'keyPassages',
                countInPartials: partials.filter(p => p.keyPassages.length > 0).length,
                countInFinal: sdd.keyPassages.length,
            },
            {
                name: 'operationalWorkflows',
                countInPartials: partials.filter(p => p.operationalWorkflows.length > 0).length,
                countInFinal: sdd.operationalWorkflows.length,
            },
        ];

    for (const check of fieldChecks) {
        if (check.countInPartials >= 2 && check.countInFinal === 0) {
            const msg = `empty_section_after_consolidation: ${check.name} (present in ${check.countInPartials} partials but empty in final)`;
            console.warn(`[consolidate-sdd] ${msg}`);
            warnings.push(msg);
        }
    }

    // Size check
    const serializedSize = JSON.stringify(sdd).length;
    if (serializedSize > 15_000) {
        const msg = `large_sdd: ${serializedSize} bytes (may impact Pass 2/3 prompt budget)`;
        console.warn(`[consolidate-sdd] ${msg}`);
        warnings.push(msg);
    }

    return warnings;
}
