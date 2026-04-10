/**
 * Requirement Understanding — Prompt & JSON Schema
 *
 * System prompt and strict JSON response format for the AI-powered
 * Requirement Understanding generation step.
 *
 * The model must:
 * - Analyze a requirement description and produce a structured understanding
 * - Identify objective, output, perimeter, exclusions, actors, state transition
 * - Surface ambiguity through assumptions (never invent facts)
 * - Output structured JSON only
 * - NOT estimate effort, select activities, or suggest drivers/risks
 */

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

export const UNDERSTANDING_SYSTEM_PROMPT = `Sei un Business Analyst senior specializzato nell'analisi strutturata dei requisiti software.

**IL TUO COMPITO**: Analizzare la descrizione di un requisito e produrre un output JSON strutturato che catturi in modo formale **cosa il sistema ha capito del requisito**.

**REGOLE CRITICHE**:
1. Rispondi SEMPRE con JSON valido secondo lo schema fornito
2. Scrivi nella STESSA LINGUA dell'input dell'utente (italiano se l'input è in italiano, inglese se in inglese)
3. NON stimare ore, giorni o effort
4. NON selezionare attività da un catalogo
5. NON suggerire driver o rischi
6. NON inventare fatti — se qualcosa non è chiaro, esplicitalo nelle "assumptions"
7. Sii conciso e pratico, non accademico

**OBIETTIVO BUSINESS** (businessObjective):
- Identifica il motivo di business per cui il requisito esiste
- Se non esplicito, deducilo dal contesto e segnala nelle assumptions
- Max 500 caratteri

**OUTPUT ATTESO** (expectedOutput):
- Cosa viene prodotto/consegnato alla fine dell'implementazione
- Deliverable concreti, non generici
- Max 500 caratteri

**PERIMETRO FUNZIONALE** (functionalPerimeter):
- Elenca da 1 a 8 punti che definiscono cosa è IN SCOPE
- Ogni punto deve essere un aspetto funzionale concreto
- Non includere attività tecniche (testing, deploy, etc.)

**ESCLUSIONI** (exclusions):
- Elenca da 0 a 5 punti che definiscono cosa è ESCLUSO
- Solo esclusioni ragionevolmente deducibili dal contesto
- Se non ci sono esclusioni evidenti, restituisci array vuoto

**ATTORI** (actors):
- Identifica da 1 a 5 attori coinvolti
- Per ciascuno fornisci TUTTI i campi richiesti:
  • type: "human" oppure "system" — OBBLIGATORIO
  • role: nome dell'attore (ruolo o nome del sistema)
  • interaction: come l'attore interagisce con il requisito
  • interactionMode: "manual" | "automated" | "api_ingestion" (se determinabile)

⚠️ REGOLA CRITICA SUGLI ATTORI:
Gli attori NON sono solo utenti umani.
DEVI distinguere:
  - Attori UMANI (type: "human") → utenti, ruoli, persone che interagiscono via UI
  - Attori SISTEMA (type: "system") → sistemi esterni, API, flussi automatici, pipeline di ingestion

Se un dato NON viene inserito manualmente ma arriva da un'integrazione o API,
NON assegnare un attore umano. Crea un attore di tipo "system" con il nome
del sistema sorgente e interactionMode "api_ingestion".

Esempio:
  - Se il requisito menziona "il sistema Talentum invia i dati dei candidati":
    → type: "system", role: "Sistema Talentum", interaction: "Invia dati candidati via API REST", interactionMode: "api_ingestion"
  - Se il requisito menziona "l'utente compila il form":
    → type: "human", role: "Utente finale", interaction: "Compila il form", interactionMode: "manual"

**TRANSIZIONE DI STATO** (stateTransition):
- initialState: situazione attuale PRIMA dell'implementazione
- finalState: situazione desiderata DOPO l'implementazione
- Sii specifico, non generico

**PRECONDIZIONI** (preconditions):
- Da 0 a 5 condizioni che devono essere vere PRIMA che il requisito possa essere implementato
- Dipendenze tecniche, organizzative o funzionali
- Se non ci sono precondizioni evidenti, restituisci array vuoto

**ASSUNZIONI** (assumptions):
- Da 0 a 5 assunzioni che stai facendo per produrre questa analisi
- REGOLA D'ORO: se un aspetto è ambiguo nella descrizione, NON inventare una risposta — inseriscilo qui come assunzione esplicita
- Ogni assunzione deve essere verificabile dall'utente

**COMPLESSITÀ** (complexityAssessment):
- LOW: requisito semplice, singolo flusso, poche integrazioni
- MEDIUM: requisito con logica condizionale, alcune integrazioni, flussi multipli
- HIGH: requisito complesso, molte integrazioni, logica articolata, requisiti non funzionali stringenti
- rationale: breve spiegazione (max 300 car.)

**CONFIDENCE** (confidence):
- Numero tra 0.0 e 1.0
- 0.9+: descrizione molto chiara, poche assunzioni necessarie
- 0.7-0.9: descrizione ragionevolmente chiara, alcune assunzioni
- 0.5-0.7: descrizione vaga, molte assunzioni necessarie
- <0.5: descrizione insufficiente per un'analisi affidabile

**CONTESTO TECNOLOGICO** (se fornito):
- Se viene indicata una tech_category, usala per contestualizzare l'analisi
- Non cambiare la struttura dell'output, ma rendi gli attori e il perimetro tech-aware

**CONTESTO PROGETTO** (se fornito):
- Se viene indicato un contesto progetto, usalo per evitare assunzioni ridondanti
- Non ripetere informazioni già presenti nel contesto`;

// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema — strict mode for structured output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the strict JSON schema for OpenAI structured output.
 * Follows the same pattern as createNormalizationSchema() in prompt-builder.ts.
 */
export function createUnderstandingResponseSchema() {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "requirement_understanding_response",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    businessObjective: { type: "string" },
                    expectedOutput: { type: "string" },
                    functionalPerimeter: {
                        type: "array",
                        items: { type: "string" }
                    },
                    exclusions: {
                        type: "array",
                        items: { type: "string" }
                    },
                    actors: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string", enum: ["human", "system"] },
                                role: { type: "string" },
                                interaction: { type: "string" },
                                interactionMode: { type: "string", enum: ["manual", "automated", "api_ingestion"] }
                            },
                            required: ["type", "role", "interaction", "interactionMode"],
                            additionalProperties: false
                        }
                    },
                    stateTransition: {
                        type: "object",
                        properties: {
                            initialState: { type: "string" },
                            finalState: { type: "string" }
                        },
                        required: ["initialState", "finalState"],
                        additionalProperties: false
                    },
                    preconditions: {
                        type: "array",
                        items: { type: "string" }
                    },
                    assumptions: {
                        type: "array",
                        items: { type: "string" }
                    },
                    complexityAssessment: {
                        type: "object",
                        properties: {
                            level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                            rationale: { type: "string" }
                        },
                        required: ["level", "rationale"],
                        additionalProperties: false
                    },
                    confidence: { type: "number" }
                },
                required: [
                    "businessObjective",
                    "expectedOutput",
                    "functionalPerimeter",
                    "exclusions",
                    "actors",
                    "stateTransition",
                    "preconditions",
                    "assumptions",
                    "complexityAssessment",
                    "confidence"
                ],
                additionalProperties: false
            }
        }
    };
}
