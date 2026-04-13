/**
 * Prompt and schema for SDD Consolidation pass (chunked pipeline).
 *
 * Receives N partial SDDs extracted from consecutive document chunks
 * and produces a single, unified Structured Document Digest.
 *
 * Reuses the existing StructuredDocumentDigestSchema from the main
 * pipeline for output validation (strict: min 1 area, min 3 passages).
 */

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

export const CONSOLIDATION_SYSTEM_PROMPT = `Sei un analista senior specializzato in consolidamento di informazioni architetturali.

═══════════════════════════════════════════════════════════════════
CONTESTO
═══════════════════════════════════════════════════════════════════

Ricevi una serie di Structured Document Digest (SDD) PARZIALI, ciascuno estratto
da un frammento consecutivo di UN UNICO documento progettuale.
Il tuo compito è CONSOLIDARLI in un unico SDD finale, completo e coerente.

═══════════════════════════════════════════════════════════════════
REGOLE DI CONSOLIDAMENTO
═══════════════════════════════════════════════════════════════════

1. UNIFICA aree funzionali semanticamente equivalenti.
   Es. "Gestione Utenti" da frammento 1 e "User Management" da frammento 3 → una sola area.
   Usa il titolo più descrittivo. Combina le description. Seleziona le keyPassages migliori.

2. ELIMINA duplicati in businessEntities e externalSystems.
   Stessa entità menzionata in più frammenti → un'unica voce con ruolo/descrizione consolidata.

3. Per keyPassages, SELEZIONA le citazioni più informative e architetturalmente rilevanti.
   Massimo 15 keyPassages nel digest finale. Preferisci passaggi che descrivono:
   architettura, flussi, vincoli critici, decisioni tecniche.

4. RISOLVI contraddizioni dando priorità a frammenti con contesto più ricco e specifico.
   Se una contraddizione è irrisolvibile, aggiungila ad "ambiguities".

5. technicalConstraints e nonFunctionalRequirements: unifica, rimuovi ridondanze.
   I valori pre-consolidati forniti sotto sono un RIFERIMENTO — puoi raffinarli,
   riformularli, o rimuovere duplicati.

6. ambiguities: mantieni contraddizioni tra frammenti come ambiguità esplicite.
   Aggiungi nuove ambiguità se emergono dal confronto tra frammenti.

7. operationalWorkflows: UNIFICA workflow operativi semanticamente equivalenti.
   Es. "Processo Approvazione" da frammento 1 e "Approval Flow" da frammento 4 → un solo workflow.
   Usa il nome più descrittivo. Combina actors e keySteps. Mantieni il trigger più preciso.

8. documentQuality: valutazione GLOBALE basata sulla copertura complessiva dei frammenti.
   Se la maggioranza dei frammenti è "high" → "high". Se misti → "medium".
   Se la maggioranza è "low" → "low".

═══════════════════════════════════════════════════════════════════
OBIETTIVO CRITICO — NON PERDERE INFORMAZIONE
═══════════════════════════════════════════════════════════════════

Il prompt ti fornirà i CONTEGGI TOTALI delle entità nei digest parziali.
Assicurati che il digest finale COPRA almeno il 70% delle entità uniche.
Se un'area funzionale, entità, o sistema esterno appare in almeno un partial,
deve comparire nel digest finale (eventualmente unificata con simili).

═══════════════════════════════════════════════════════════════════
CAMPI OUTPUT
═══════════════════════════════════════════════════════════════════

1. "functionalAreas" — Aree funzionali unificate (min 1, max 10)
   { "title", "description" max 500 chars, "keyPassages" max 5 citazioni VERBATIM max 300 chars }

2. "businessEntities" — Entità deduplicate (max 20)
   { "name", "role" max 300 chars }

3. "externalSystems" — Sistemi esterni deduplicati (max 15)
   { "name", "interactionDescription" max 300 chars }

4. "technicalConstraints" — Vincoli tecnici unificati (max 10)

5. "nonFunctionalRequirements" — Requisiti non funzionali unificati (max 10)

6. "keyPassages" — Le citazioni VERBATIM più rilevanti (min 3, max 20)
   { "label", "text" max 300 chars }

7. "ambiguities" — Ambiguità e contraddizioni (max 10)

8. "operationalWorkflows" — Workflow operativi unificati (min 0, max 10)
   { "name", "trigger" max 300 chars, "actors" array di attori, "keySteps" max 500 chars }

9. "documentQuality" — Valutazione globale: "high" | "medium" | "low"

Rispondi SOLO con JSON strutturato, senza testo aggiuntivo.`;

// ─────────────────────────────────────────────────────────────────────────────
// JSON schema for OpenAI structured output (strict mode)
// Reuses the same SDD structure as the existing pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export function createConsolidationResponseSchema() {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'consolidated_sdd_response',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    functionalAreas: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                description: { type: 'string' },
                                keyPassages: { type: 'array', items: { type: 'string' } },
                            },
                            required: ['title', 'description', 'keyPassages'],
                            additionalProperties: false,
                        },
                    },
                    businessEntities: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                role: { type: 'string' },
                            },
                            required: ['name', 'role'],
                            additionalProperties: false,
                        },
                    },
                    externalSystems: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                interactionDescription: { type: 'string' },
                            },
                            required: ['name', 'interactionDescription'],
                            additionalProperties: false,
                        },
                    },
                    technicalConstraints: { type: 'array', items: { type: 'string' } },
                    nonFunctionalRequirements: { type: 'array', items: { type: 'string' } },
                    keyPassages: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                text: { type: 'string' },
                            },
                            required: ['label', 'text'],
                            additionalProperties: false,
                        },
                    },
                    ambiguities: { type: 'array', items: { type: 'string' } },
                    operationalWorkflows: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                trigger: { type: 'string' },
                                actors: { type: 'array', items: { type: 'string' } },
                                keySteps: { type: 'string' },
                            },
                            required: ['name', 'trigger', 'actors', 'keySteps'],
                            additionalProperties: false,
                        },
                    },
                    documentQuality: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
                required: [
                    'functionalAreas', 'businessEntities', 'externalSystems',
                    'technicalConstraints', 'nonFunctionalRequirements',
                    'keyPassages', 'ambiguities', 'operationalWorkflows', 'documentQuality',
                ],
                additionalProperties: false,
            },
        },
    };
}
