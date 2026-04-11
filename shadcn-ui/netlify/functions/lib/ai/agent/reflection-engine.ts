/**
 * Reflection Engine — Phase 3: Agentic Evolution
 * 
 * Implements the self-correction loop by analyzing a draft estimation
 * through the Senior Consultant lens and generating correction prompts.
 * 
 * Flow:
 * 1. Receive draft estimation + original context
 * 2. Run lightweight consultant analysis (reuses consultant logic)
 * 3. Identify issues (missing coverage, over-engineering, hour mismatches)
 * 4. Generate a correction prompt if refinement is needed
 * 5. Return ReflectionResult with actionable feedback
 */

import { z } from 'zod';
import { ILLMProvider, LLM_PRESETS } from '../openai-client';
import { sanitizePromptInput } from '../../../../../src/types/ai-validation';
import type {
    DraftEstimation,
    ReflectionResult,
    ReflectionIssue,
    AgentInput,
    AgentFlags
} from './agent-types';
import { formatProjectContextBlock } from '../prompt-builder';
import { formatConflictsBlock } from '../../domain/estimation/canonical-profile.service';

// ─────────────────────────────────────────────────────────────────────────────
// Zod Schema for Reflection Response
// ─────────────────────────────────────────────────────────────────────────────

const ReflectionResponseSchema = z.object({
    assessment: z.enum(['approved', 'needs_review', 'concerns']),
    confidence: z.number().min(0).max(100),
    issues: z.array(z.object({
        type: z.enum([
            'missing_activity',
            'unnecessary_activity',
            'wrong_hours',
            'missing_coverage',
            'over_engineering'
        ]),
        severity: z.enum(['low', 'medium', 'high']),
        description: z.string().max(300),
        suggestedAction: z.string().max(300),
    })).max(8),
    correctionInstructions: z.string().max(2000),
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Structured Output Schema
// ─────────────────────────────────────────────────────────────────────────────

function createReflectionSchema() {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'reflection_analysis',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    assessment: {
                        type: 'string',
                        enum: ['approved', 'needs_review', 'concerns'],
                        description: 'Overall quality assessment of the draft estimation'
                    },
                    confidence: {
                        type: 'number',
                        description: 'Confidence score 0-100 in the estimation quality'
                    },
                    issues: {
                        type: 'array',
                        description: 'Specific issues found in the draft',
                        items: {
                            type: 'object',
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: [
                                        'missing_activity',
                                        'unnecessary_activity',
                                        'wrong_hours',
                                        'missing_coverage',
                                        'over_engineering'
                                    ]
                                },
                                severity: {
                                    type: 'string',
                                    enum: ['low', 'medium', 'high']
                                },
                                description: { type: 'string' },
                                suggestedAction: { type: 'string' }
                            },
                            required: ['type', 'severity', 'description', 'suggestedAction'],
                            additionalProperties: false
                        }
                    },
                    correctionInstructions: {
                        type: 'string',
                        description: 'If issues found, detailed instructions for correcting the estimation. Empty string if approved.'
                    }
                },
                required: ['assessment', 'confidence', 'issues', 'correctionInstructions'],
                additionalProperties: false
            }
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// System & User Prompts
// ─────────────────────────────────────────────────────────────────────────────

const REFLECTION_SYSTEM_PROMPT = `Sei un Senior Technical Consultant che revisiona le stime software.

IL TUO RUOLO:
Analizzare criticamente una bozza di stima generata da un AI estimator, identificare problemi e fornire istruzioni di correzione specifiche.

CRITERI DI VALUTAZIONE:

1. COPERTURA: Le attività selezionate coprono tutti gli aspetti del requisito?
   - Sono presenti test, deploy, analisi funzionale?
   - Mancano attività di integrazione se il requisito ne parla?
   - Ci sono lacune nella governance (documentazione, review)?

2. PROPORZIONALITÀ: Le ore stimate sono ragionevoli?
   - Attività semplici (config, setup) dovrebbero essere 2-4h
   - Attività medie (singolo componente) dovrebbero essere 4-8h
   - Attività complesse (integrazione, logica avanzata) dovrebbero essere 8-16h
   - MAI più di 40h per una singola attività

3. OVER-ENGINEERING: Ci sono attività non necessarie?
   - Attività enterprise per requisiti semplici?
   - Duplicazioni funzionali?
   - Attività che non sono giustificate dal requisito?

4. COERENZA: Le risposte dell'interview sono riflesse nella selezione?
   - Se l'utente ha detto "semplice", sono state scelte varianti _SM?
   - Se l'utente ha detto "complesso", ci sono tutte le attività necessarie?

ASSESSMENT:
- "approved": La stima è solida, nessun problema significativo
- "needs_review": Alcuni problemi che andrebbero corretti (issue medium)
- "concerns": Problemi significativi che richiedono correzione (issue high)

CORRECTION INSTRUCTIONS:
Se assessment != "approved", fornisci istruzioni SPECIFICHE per correggere:
- Quali attività aggiungere/rimuovere con i codici esatti
- Quali ore modificare e perché
- Come migliorare la copertura

Se assessment == "approved", correctionInstructions deve essere stringa vuota.

Rispondi in italiano. Sii conciso e specifico.`;

/**
 * Build user prompt for reflection analysis
 */
function buildReflectionUserPrompt(
    input: AgentInput,
    draft: DraftEstimation
): string {
    // Format draft activities
    const activitiesStr = draft.activities
        .map(a => `  - ${a.code}: ${a.name} (${a.baseHours}h) → ${a.reason}`)
        .join('\n');

    // Format answers if available
    let answersStr = 'Non disponibili';
    if (input.answers && Object.keys(input.answers).length > 0) {
        answersStr = Object.entries(input.answers)
            .map(([key, val]) => {
                if (typeof val === 'object' && val !== null && 'value' in val) {
                    return `  - ${key}: ${String((val as any).value)}`;
                }
                return `  - ${key}: ${String(val)}`;
            })
            .join('\n');
    }

    // Format suggested drivers
    const driversStr = draft.suggestedDrivers.length > 0
        ? draft.suggestedDrivers.map(d => `  - ${d.code}: ${d.suggestedValue} (${d.reason})`).join('\n')
        : '  Nessun driver suggerito';

    // Canonical conflicts block (medium + high severity only)
    const conflictsBlock = input.canonicalConflicts && input.canonicalConflicts.length > 0
        ? formatConflictsBlock(input.canonicalConflicts)
        : '';

    return `REQUISITO ORIGINALE:
${input.description}

${input.projectContext ? formatProjectContextBlock(input.projectContext) : ''}

TECNOLOGIA: ${input.technologyName || input.techCategory}

RISPOSTE INTERVIEW:
${answersStr}
${conflictsBlock}
--- BOZZA DI STIMA DA ANALIZZARE ---

TITOLO GENERATO: ${draft.generatedTitle}
ATTIVITÀ SELEZIONATE (${draft.activities.length}):
${activitiesStr}

TOTALE BASE DAYS: ${draft.totalBaseDays}
CONFIDENCE: ${draft.confidenceScore}

DRIVER SUGGERITI:
${driversStr}

RISCHI SUGGERITI: ${draft.suggestedRisks.join(', ') || 'Nessuno'}

RAGIONAMENTO DELL'AI:
${draft.reasoning}

CODICI ATTIVITÀ DISPONIBILI NEL CATALOGO:
${input.validActivityCodes.slice(0, 50).join(', ')}${input.validActivityCodes.length > 50 ? '...' : ''}

---
Analizza questa bozza e fornisci il tuo assessment.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Reflection Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a draft estimation and produce a reflection result.
 * 
 * @param input - Original agent input (requirement, answers, etc.)
 * @param draft - The draft estimation to analyze
 * @param provider - LLM provider for the analysis call
 * @param flags - Agent configuration flags
 * @returns ReflectionResult with assessment and correction instructions
 */
export async function reflectOnDraft(
    input: AgentInput,
    draft: DraftEstimation,
    provider: ILLMProvider,
    flags: AgentFlags
): Promise<ReflectionResult> {
    console.log('\n[reflection] ========== SENIOR CONSULTANT REVIEW ==========');
    console.log(`[reflection] Analisi della draft:`);
    console.log(`  - Titolo: "${draft.generatedTitle}"`);
    console.log(`  - Attività: ${draft.activities.length}`);
    console.log(`  - Base days: ${draft.totalBaseDays}`);
    console.log(`  - Confidence: ${draft.confidenceScore}`);
    console.log(`  - Driver suggeriti: ${draft.suggestedDrivers.length}`);
    console.log(`  - Rischi suggeriti: ${draft.suggestedRisks.length}`);
    console.log(`[reflection] Soglia confidence per auto-approve: ${flags.reflectionConfidenceThreshold}%`);

    // Quick gate: if draft confidence is very high, consider auto-approving
    if (draft.confidenceScore >= (flags.reflectionConfidenceThreshold / 100) && !flags.autoApproveOnly) {
        console.log(`[reflection] Draft ad alta confidenza (${draft.confidenceScore} >= ${flags.reflectionConfidenceThreshold / 100}), esecuzione check lightweight`);
    }

    const userPrompt = buildReflectionUserPrompt(input, draft);
    const reflectionSchema = createReflectionSchema();
    console.log(`[reflection] Invocazione LLM (gpt-4o-mini, temp=0.0)...`);
    console.log(`[reflection] User prompt: ${userPrompt.length} chars`);

    let rawContent: string;
    try {
        rawContent = await provider.generateContent({
            model: 'gpt-4o-mini', // Use mini for reflection to save cost and latency
            systemPrompt: REFLECTION_SYSTEM_PROMPT,
            userPrompt: userPrompt,
            temperature: 0.0, // Maximum determinism for consistent analysis
            maxTokens: 2000,
            options: LLM_PRESETS.standard,
            responseFormat: reflectionSchema as any
        });
    } catch (error) {
        console.error('[reflection] LLM CALL FALLITA:', error instanceof Error ? error.message : error);
        console.warn('[reflection] Auto-approvazione per evitare blocco pipeline');
        // On failure, auto-approve to avoid blocking the pipeline
        return {
            assessment: 'approved',
            confidence: draft.confidenceScore * 100,
            issues: [],
            correctionPrompt: '',
            refinementTriggered: false
        };
    }

    // Parse and validate
    let parsed: z.infer<typeof ReflectionResponseSchema>;
    try {
        const raw = JSON.parse(rawContent);
        parsed = ReflectionResponseSchema.parse(raw);
    } catch (parseError) {
        console.error('[reflection] ERRORE parsing/validazione risposta:', parseError instanceof Error ? parseError.message : parseError);
        console.warn('[reflection] Auto-approvazione per errore di parsing');
        return {
            assessment: 'approved',
            confidence: draft.confidenceScore * 100,
            issues: [],
            correctionPrompt: '',
            refinementTriggered: false
        };
    }

    // Determine if refinement should be triggered
    const hasHighSeverityIssues = parsed.issues.some(i => i.severity === 'high');
    const hasMediumIssues = parsed.issues.filter(i => i.severity === 'medium').length >= 2;
    const shouldRefine = parsed.assessment !== 'approved' && (hasHighSeverityIssues || hasMediumIssues);

    const result: ReflectionResult = {
        assessment: parsed.assessment,
        confidence: parsed.confidence,
        issues: parsed.issues as ReflectionIssue[],
        correctionPrompt: shouldRefine ? parsed.correctionInstructions : '',
        refinementTriggered: shouldRefine
    };

    console.log(`[reflection] ── RISULTATO ANALISI ──`);
    console.log(`[reflection]   Assessment: ${result.assessment}`);
    console.log(`[reflection]   Confidence: ${result.confidence}%`);
    console.log(`[reflection]   Issues trovate: ${result.issues.length}`);
    if (result.issues.length > 0) {
        result.issues.forEach((iss, i) => {
            console.log(`[reflection]     ${i + 1}. [${iss.severity.toUpperCase()}] ${iss.type}: ${iss.description}`);
            console.log(`[reflection]        Azione: ${iss.suggestedAction}`);
        });
    }
    console.log(`[reflection]   High severity: ${hasHighSeverityIssues}`);
    console.log(`[reflection]   Medium issues (>=2): ${hasMediumIssues}`);
    console.log(`[reflection]   Refinement triggered: ${result.refinementTriggered}`);
    if (result.correctionPrompt) {
        console.log(`[reflection]   Correction prompt: "${result.correctionPrompt.substring(0, 200)}..."`);
    }
    console.log('[reflection] ========== FINE REVIEW ========== \n');

    return result;
}

/**
 * Build a refinement prompt that incorporates reflection feedback.
 * This is appended to the original estimation prompt for the REFINE pass.
 */
export function buildRefinementPrompt(
    reflection: ReflectionResult,
    previousDraft: DraftEstimation
): string {
    const issuesList = reflection.issues
        .filter(i => i.severity !== 'low')
        .map(i => `- [${i.severity.toUpperCase()}] ${i.type}: ${i.description} → ${i.suggestedAction}`)
        .join('\n');

    return `
--- CORREZIONI RICHIESTE DAL SENIOR CONSULTANT ---

ASSESSMENT PRECEDENTE: ${reflection.assessment} (Confidence: ${reflection.confidence}%)

PROBLEMI IDENTIFICATI:
${issuesList || 'Nessun problema specifico identificato.'}

ISTRUZIONI DI CORREZIONE:
${reflection.correctionPrompt}

BOZZA PRECEDENTE (da correggere):
- Titolo: ${previousDraft.generatedTitle}
- Attività: ${previousDraft.activities.map(a => `${a.code}(${a.baseHours}h)`).join(', ')}
- Totale: ${previousDraft.totalBaseDays} base days
- Confidence: ${previousDraft.confidenceScore}

IMPORTANTE: 
1. Correggi SOLO i problemi identificati, non stravolgere l'intera stima
2. Mantieni le attività corrette dalla bozza precedente
3. Usa ESCLUSIVAMENTE codici attività dal catalogo fornito
4. Ricalcola totalBaseDays dopo le modifiche

--- FINE CORREZIONI ---
`;
}
