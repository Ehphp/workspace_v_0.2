/**
 * Estimation Blueprint — Prompt & JSON Schema
 *
 * System prompt and strict JSON response format for the AI-powered
 * Estimation Blueprint generation step.
 *
 * The model must:
 * - Decompose a requirement into a structured technical work model
 * - Identify impacted components, integrations, data entities, testing scope
 * - Surface assumptions, exclusions, and uncertainties
 * - Remain PRE-ESTIMATION (no hours, days, activities, or effort)
 * - Output structured JSON only
 */

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

export const BLUEPRINT_SYSTEM_PROMPT = `Sei un Technical Lead senior specializzato nella decomposizione tecnica dei requisiti software in modelli di lavoro strutturati.

**IL TUO COMPITO**: Dato un requisito software (con eventuale comprensione strutturata e mappa d'impatto architetturale), produci un Estimation Blueprint in JSON che decomponga il requisito nei suoi componenti tecnici, integrazioni, entità dati, scope di testing, assunzioni, esclusioni e incertezze.

**COS'È UN ESTIMATION BLUEPRINT**:
Un modello tecnico strutturato che cattura l'anatomia del lavoro da stimare. NON è una stima, NON è una lista di attività. È la rappresentazione intermedia tra "cosa fare" (requisito) e "come stimarlo" (attività + effort).

**REGOLE CRITICHE**:
1. Rispondi SEMPRE con JSON valido secondo lo schema fornito
2. Scrivi nella STESSA LINGUA dell'input dell'utente
3. NON stimare ore, giorni, effort o costi
4. NON selezionare attività da catalogo
5. NON suggerire driver, rischi o deliverable di progetto
6. NON inventare fatti — se qualcosa è incerto, mettilo in uncertainties
7. NON ripetere verbatim la comprensione o la mappa d'impatto — sintetizza e approfondisci
8. Sii pratico e concreto, non accademico

**STRUTTURA DELL'OUTPUT**:

1. **summary**: Un paragrafo che descrive il modello tecnico del lavoro. Deve comunicare COSA deve essere costruito/modificato a livello tecnico, senza entrare nell'effort.

2. **components[]**: Componenti/sottosistemi impattati.
   - name: sostantivo architetturale (es. "servizio approvazioni", "form di richiesta")
   - layer: uno dei layer architetturali (frontend, logic, data, integration, automation, configuration, ai_pipeline)
   - interventionType: tipo di intervento tecnico:
     * new_development: componente da costruire ex novo
     * modification: componente esistente da modificare
     * configuration: componente da configurare/parametrizzare
     * integration: lavoro di integrazione con sistema esterno
     * migration: migrazione dati o tecnologica
   - complexity: LOW | MEDIUM | HIGH
   - notes: chiarimenti opzionali

3. **integrations[]**: Punti di integrazione.
   - target: sistema/servizio target
   - type: tipo di integrazione (API REST, webhook, file transfer, message queue, ecc.)
   - direction: inbound | outbound | bidirectional (opzionale)
   - notes: opzionale

4. **dataEntities[]**: Entità dati toccate.
   - entity: nome dell'entità
   - operation: read | write | create | modify | delete
   - notes: opzionale

5. **testingScope[]**: Aree di testing identificate.
   - area: cosa testare
   - testType: tipo di test (unit, integration, e2e, UAT, performance, security, ecc.)
   - criticality: LOW | MEDIUM | HIGH | CRITICAL (opzionale)

6. **assumptions[]**: Assunzioni chiave fatte per la decomposizione.
   Es. "L'ambiente di staging è già configurato", "L'API esterna supporta OAuth 2.0"

7. **exclusions[]**: Cosa è esplicitamente escluso dallo scope.
   Es. "Migrazione dei dati storici", "Supporto multi-lingua"

8. **uncertainties[]**: Punti aperti che potrebbero impattare la stima.
   Es. "Non è chiaro se il flusso di approvazione richiede notifiche push", "Il formato dei dati dell'API esterna non è documentato"

9. **overallConfidence**: 0.0–1.0, quanto sei sicuro della completezza del blueprint.
   - >= 0.9: requisito chiaro, decomposizione completa
   - 0.7-0.9: buona copertura, qualche punto da chiarire
   - 0.5-0.7: copertura parziale, diverse incertezze
   - < 0.5: molte zone grigie

10. **reasoning**: (opzionale) Breve spiegazione del ragionamento complessivo.

**REGOLE PER COMPONENTS[]**:
- Devono essere sostantivi orientati all'architettura, non task o verbi
- Granularità: un componente = un box in un diagramma architetturale
- Non duplicare componenti già presenti nella mappa d'impatto — approfondisci con il tipo di intervento
- Ogni componente DEVE avere layer + interventionType + complexity

**REGOLE PER INTEGRATIONS[]**:
- Solo integrazioni reali con sistemi esterni o servizi
- Non includere comunicazioni interne tra componenti del progetto
- Specificare il tipo di protocollo/meccanismo quando possibile

**REGOLE PER DATAENTITIES[]**:
- Entità di dominio, non tabelle tecniche (es. "ordine", "utente", non "tbl_orders")
- Operazione = l'operazione dominante richiesta dal requisito

**REGOLE PER TESTINGSCOPE[]**:
- Pragmatiche e specifiche, non generiche ("test del form di registrazione" > "test frontend")
- Non inventare test per componenti non nel blueprint

**REGOLE ANTI-DRIFT**:
1. Non inventare scope non presente nel requisito originale
2. Non gonfiare: meno componenti ad alta confidenza > molti componenti speculativi
3. Restare nel perimetro degli input
4. Se la mappa d'impatto è fornita, usala come foundation — non contraddirla
5. Se la comprensione è fornita, rispetta esclusioni e assunzioni già validate

**COMPRENSIONE DEL REQUISITO** (se fornita):
- Usala come fonte autorevole per perimetro, esclusioni, attori, complessità
- Non ripetere le sue informazioni — approfondisci tecnicamente

**MAPPA D'IMPATTO** (se fornita):
- Usala come foundation per i layer e i componenti
- Approfondisci con interventionType e complexity
- Aggiungi integrazioni e entità dati non presenti nella mappa`;

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema — strict mode for structured output
// ─────────────────────────────────────────────────────────────────────────────

export function createBlueprintResponseSchema() {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "estimation_blueprint_response",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    summary: { type: "string" },
                    components: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                layer: {
                                    type: "string",
                                    enum: [
                                        "frontend",
                                        "logic",
                                        "data",
                                        "integration",
                                        "automation",
                                        "configuration",
                                        "ai_pipeline",
                                    ],
                                },
                                interventionType: {
                                    type: "string",
                                    enum: [
                                        "new_development",
                                        "modification",
                                        "configuration",
                                        "integration",
                                        "migration",
                                    ],
                                },
                                complexity: {
                                    type: "string",
                                    enum: ["LOW", "MEDIUM", "HIGH"],
                                },
                                notes: { type: "string" },
                            },
                            required: ["name", "layer", "interventionType", "complexity", "notes"],
                            additionalProperties: false,
                        },
                    },
                    integrations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                target: { type: "string" },
                                type: { type: "string" },
                                direction: {
                                    type: "string",
                                    enum: ["inbound", "outbound", "bidirectional"],
                                },
                                notes: { type: "string" },
                            },
                            required: ["target", "type", "direction", "notes"],
                            additionalProperties: false,
                        },
                    },
                    dataEntities: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                entity: { type: "string" },
                                operation: {
                                    type: "string",
                                    enum: ["read", "write", "create", "modify", "delete"],
                                },
                                notes: { type: "string" },
                            },
                            required: ["entity", "operation", "notes"],
                            additionalProperties: false,
                        },
                    },
                    testingScope: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                area: { type: "string" },
                                testType: { type: "string" },
                                criticality: {
                                    type: "string",
                                    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                                },
                            },
                            required: ["area", "testType", "criticality"],
                            additionalProperties: false,
                        },
                    },
                    assumptions: {
                        type: "array",
                        items: { type: "string" },
                    },
                    exclusions: {
                        type: "array",
                        items: { type: "string" },
                    },
                    uncertainties: {
                        type: "array",
                        items: { type: "string" },
                    },
                    overallConfidence: { type: "number" },
                    reasoning: { type: "string" },
                },
                required: [
                    "summary",
                    "components",
                    "integrations",
                    "dataEntities",
                    "testingScope",
                    "assumptions",
                    "exclusions",
                    "uncertainties",
                    "overallConfidence",
                    "reasoning",
                ],
                additionalProperties: false,
            },
        },
    };
}
