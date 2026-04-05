/**
 * Decision Explanation — Prompt & JSON Schema
 *
 * System prompt and strict JSON response format for the AI-powered
 * post-decision explanation step.
 *
 * The model must:
 * - Explain WHY the selected activities are appropriate (given the DecisionEngine trace)
 * - Surface any potential gaps or warnings
 * - Output structured JSON only
 * - NOT change the activity selection — it's read-only commentary
 */

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

export const DECISION_EXPLANATION_SYSTEM_PROMPT = `Sei un Technical Lead esperto che spiega le scelte di stima a un team di consulenza.

**IL TUO COMPITO**: Ricevi un set di attività già selezionate da un motore deterministico, insieme al requisito originale e alle risposte dell'utente. Devi:
1. Spiegare in linguaggio naturale PERCHÉ queste attività sono state scelte
2. Fornire un reasoning coerente che colleghi il requisito alle attività
3. Identificare eventuali gap o warning

**REGOLE CRITICHE**:
1. Rispondi SEMPRE con JSON valido secondo lo schema fornito
2. Scrivi in ITALIANO
3. NON modificare la lista delle attività — non puoi aggiungere o rimuovere nulla
4. NON stimare ore, giorni o effort
5. Il tuo output è SOLO commentary — la selezione è già stata fatta
6. Sii conciso e pratico: max 2 frasi per attività nella spiegazione

**REASONING** (reasoning):
- Spiega la logica complessiva della selezione in max 500 caratteri
- Collega il requisito alle macro-aree tecniche coperte

**ACTIVITY EXPLANATIONS** (activityExplanations):
- Per ogni attività selezionata, fornisci una spiegazione breve
- Collegala al requisito o alle risposte dell'utente
- Format: array di { code, explanation }

**WARNINGS** (warnings):
- Segnala potenziali problemi nella selezione (max 5)
- Es: "Nessuna attività di test selezionata", "Il requisito menziona integrazione ma nessuna attività di integrazione è presente"
- Se non ci sono warning, restituisci array vuoto

**GAPS** (gaps):
- Segnala aree funzionali del requisito che potrebbero non essere coperte (max 5)
- Basati sul perimetro del requisito vs attività selezionate
- Se non ci sono gap evidenti, restituisci array vuoto

**SUGGESTED_DRIVERS** (suggestedDrivers):
- Suggerisci da 0 a 5 driver di effort (fattori che influenzano la complessità)
- Basati sul requisito e le risposte dell'intervista
- Format: array di { name, rationale }

**SUGGESTED_RISKS** (suggestedRisks):
- Suggerisci da 0 a 5 rischi tecnici o di progetto
- Format: array di { name, rationale }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Response JSON Schema (for structured output)
// ─────────────────────────────────────────────────────────────────────────────

export function buildDecisionExplanationSchema() {
    return {
        type: 'object' as const,
        properties: {
            reasoning: {
                type: 'string',
                description: 'Spiegazione complessiva della selezione, max 500 caratteri',
            },
            activityExplanations: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', description: 'Codice attività' },
                        explanation: { type: 'string', description: 'Spiegazione breve, max 200 caratteri' },
                    },
                    required: ['code', 'explanation'],
                },
                description: 'Spiegazione per ogni attività selezionata',
            },
            warnings: {
                type: 'array',
                items: { type: 'string' },
                description: 'Potenziali problemi nella selezione (max 5)',
            },
            gaps: {
                type: 'array',
                items: { type: 'string' },
                description: 'Aree funzionali potenzialmente non coperte (max 5)',
            },
            suggestedDrivers: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        rationale: { type: 'string' },
                    },
                    required: ['name', 'rationale'],
                },
                description: 'Driver di effort suggeriti (max 5)',
            },
            suggestedRisks: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        rationale: { type: 'string' },
                    },
                    required: ['name', 'rationale'],
                },
                description: 'Rischi tecnici o di progetto (max 5)',
            },
        },
        required: ['reasoning', 'activityExplanations', 'warnings', 'gaps', 'suggestedDrivers', 'suggestedRisks'],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionExplanationPromptInput {
    /** Original requirement description */
    description: string;
    /** Interview answers */
    answers: Record<string, { questionId: string; category: string; value: string | string[] | number }>;
    /** Selected activity codes with scores */
    selectedActivities: Array<{ code: string; name: string; score: number; sources: string[] }>;
    /** Coverage report summary */
    coverageSummary: string;
    /** Mandatory inclusions */
    mandatoryInclusions: Array<{ code: string; matchedKeyword: string }>;
    /** Technology category */
    techCategory: string;
}

export function buildDecisionExplanationUserPrompt(input: DecisionExplanationPromptInput): string {
    const activitiesList = input.selectedActivities
        .map(a => `- ${a.code} (${a.name}) — score: ${a.score.toFixed(2)}, fonti: ${a.sources.join(', ')}`)
        .join('\n');

    const answersList = Object.entries(input.answers)
        .map(([key, a]) => `- ${a.category}: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`)
        .join('\n');

    const mandatoryList = input.mandatoryInclusions.length > 0
        ? input.mandatoryInclusions.map(m => `- ${m.code} (keyword: "${m.matchedKeyword}")`).join('\n')
        : 'Nessuna';

    return `## Requisito
${input.description}

## Tecnologia
${input.techCategory}

## Risposte Intervista
${answersList || 'Nessuna risposta disponibile'}

## Attività Selezionate (${input.selectedActivities.length})
${activitiesList}

## Inclusioni Mandatorie
${mandatoryList}

## Copertura Layer
${input.coverageSummary}

---
Analizza e spiega la selezione secondo lo schema JSON richiesto.`;
}
