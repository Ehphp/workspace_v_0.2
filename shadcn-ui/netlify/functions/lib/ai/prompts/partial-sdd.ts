/**
 * Prompt and schema for Partial SDD extraction (chunked pipeline).
 *
 * Each chunk of a long document is processed independently to produce
 * a partial Structured Document Digest. The partial SDDs are later
 * consolidated into a final SDD by the consolidation pass.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Prompt versioning — bump when prompt text, model, or schema change
// ─────────────────────────────────────────────────────────────────────────────

export const PARTIAL_SDD_PROMPT_VERSION = 'v1';

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

export const PARTIAL_SDD_SYSTEM_PROMPT = `Sei un analista di documentazione tecnica.

═══════════════════════════════════════════════════════════════════
CONTESTO
═══════════════════════════════════════════════════════════════════

Stai analizzando UN SINGOLO FRAMMENTO di un documento progettuale più lungo.
Il frammento è identificato da un indice (es. "Frammento 3 di 7") e dagli offset
di carattere nel documento originale.

Il tuo compito è estrarre un Structured Document Digest (SDD) PARZIALE
da QUESTO SOLO frammento.

═══════════════════════════════════════════════════════════════════
REGOLE CRITICHE
═══════════════════════════════════════════════════════════════════

1. Estrai SOLO informazioni esplicitamente presenti in QUESTO frammento
2. NON inferire informazioni che non sono nel testo
3. NON assumere copertura globale — questo è solo un pezzo del documento
4. NON inventare contesto non presente nel frammento
5. Se un concetto è solo accennato, includilo con una description breve
6. Le keyPassages DEVONO essere citazioni VERBATIM copiate esattamente dal frammento
7. È NORMALE che questo digest sia parziale o incompleto — verrà consolidato con altri

═══════════════════════════════════════════════════════════════════
CAMPI DEL DIGEST PARZIALE
═══════════════════════════════════════════════════════════════════

1. "functionalAreas" — Aree funzionali menzionate in questo frammento.
   Ogni area: { "title": nome, "description": max 200 chars, "keyPassages": 0-3 citazioni VERBATIM max 200 chars }
   Se il frammento non descrive aree funzionali, array VUOTO. (min 0, max 8)

2. "businessEntities" — Entità di business menzionate nel frammento.
   { "name": nome, "role": ruolo nel sistema max 200 chars }
   Se assenti, array VUOTO. (max 20)

3. "externalSystems" — Sistemi esterni menzionati nel frammento.
   { "name": nome, "interactionDescription": max 150 chars }
   Solo sistemi CHIARAMENTE identificati come esterni. (max 15)

4. "technicalConstraints" — Vincoli tecnici espliciti. Array di stringhe. (max 10)

5. "nonFunctionalRequirements" — Requisiti non funzionali. Array di stringhe. (max 10)

6. "keyPassages" — Citazioni VERBATIM più importanti da QUESTO frammento.
   { "label": etichetta di contesto, "text": citazione esatta max 200 chars }
   REGOLE: copiate ESATTAMENTE, NON parafrasare, NON riassumere.
   Seleziona passaggi su architettura, flussi, vincoli, decisioni tecniche. (min 0, max 10)

7. "ambiguities" — Ambiguità o contraddizioni rilevate in questo frammento. Array di stringhe. (max 10)

8. "documentQuality" — Qualità di QUESTO frammento (non del documento intero):
   "high": dettagliato, requisiti chiari
   "medium": parziale, alcune lacune
   "low": vago, poche info tecniche

Rispondi SOLO con JSON strutturato, senza testo aggiuntivo.`;

// ─────────────────────────────────────────────────────────────────────────────
// Zod validation schema (relaxed minimums — partials can be empty)
// ─────────────────────────────────────────────────────────────────────────────

export const PartialSDDSchema = z.object({
    functionalAreas: z.array(z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(500),
        keyPassages: z.array(z.string().max(300)).max(5),
    })).min(0).max(10),
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
    })).min(0).max(20),
    ambiguities: z.array(z.string().max(500)).max(10),
    documentQuality: z.enum(['high', 'medium', 'low']),
});

export type PartialSDD = z.infer<typeof PartialSDDSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// JSON schema for OpenAI structured output (strict mode)
// ─────────────────────────────────────────────────────────────────────────────

export function createPartialSDDResponseSchema() {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'partial_sdd_response',
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
                    documentQuality: { type: 'string', enum: ['high', 'medium', 'low'] },
                },
                required: [
                    'functionalAreas', 'businessEntities', 'externalSystems',
                    'technicalConstraints', 'nonFunctionalRequirements',
                    'keyPassages', 'ambiguities', 'documentQuality',
                ],
                additionalProperties: false,
            },
        },
    };
}
