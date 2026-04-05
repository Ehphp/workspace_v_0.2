/**
 * System prompt and JSON schemas for the "Generate Project from Documentation"
 * AI pipeline.
 *
 * Two-pass pipeline:
 *   Pass 1 → Project Draft extraction (admin/context fields)
 *   Pass 2 → Technical Blueprint extraction (architectural baseline)
 */

// ============================================================================
// Pass 1 — Project Draft Extraction
// ============================================================================

export const PROJECT_DRAFT_SYSTEM_PROMPT = `Sei un analista senior specializzato nell'analisi di documentazione progettuale.

Il tuo compito è estrarre i metadati strutturati di un progetto software da un testo di documentazione fornito dall'utente.

REGOLE OBBLIGATORIE:
- NON inventare dettagli non presenti nel testo
- Estrai solo informazioni esplicitamente o chiaramente deducibili dal documento
- Se un campo non è determinabile, lascialo null
- "confidence" deve riflettere quanto il testo è chiaro e completo
- "assumptions" elenca ipotesi che hai fatto durante l'estrazione
- "missingFields" elenca campi importanti non determinabili dal testo
- Il campo "name" deve essere un nome conciso per il progetto (max 100 caratteri)
- Il campo "description" deve essere un riassunto del progetto (max 500 caratteri)
- "technologyId" deve essere null a meno che la tecnologia principale sia chiaramente identificabile E corrisponda a una tecnologia nota del catalogo Syntero
- Per "projectType" usa solo: NEW_DEVELOPMENT, MAINTENANCE, MIGRATION, INTEGRATION, REFACTORING
- Per "scope" usa solo: SMALL, MEDIUM, LARGE, ENTERPRISE
- Per "deadlinePressure" usa solo: RELAXED, NORMAL, TIGHT, CRITICAL
- Per "methodology" usa solo: AGILE, WATERFALL, HYBRID
- "reasoning" spiega brevemente il processo di estrazione

Rispondi SOLO con JSON strutturato, senza testo aggiuntivo.`;

export function createProjectDraftResponseSchema() {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'project_draft_response',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    owner: { type: ['string', 'null'] },
                    technologyId: { type: ['string', 'null'] },
                    projectType: { type: ['string', 'null'] },
                    domain: { type: ['string', 'null'] },
                    scope: { type: ['string', 'null'] },
                    teamSize: { type: ['number', 'null'] },
                    deadlinePressure: { type: ['string', 'null'] },
                    methodology: { type: ['string', 'null'] },
                    confidence: { type: 'number' },
                    assumptions: { type: 'array', items: { type: 'string' } },
                    missingFields: { type: 'array', items: { type: 'string' } },
                    reasoning: { type: ['string', 'null'] },
                },
                required: [
                    'name', 'description', 'owner', 'technologyId',
                    'projectType', 'domain', 'scope', 'teamSize',
                    'deadlinePressure', 'methodology', 'confidence',
                    'assumptions', 'missingFields', 'reasoning',
                ],
                additionalProperties: false,
            },
        },
    };
}

// ============================================================================
// Pass 2 — Technical Blueprint Extraction
// ============================================================================

export const TECHNICAL_BLUEPRINT_SYSTEM_PROMPT = `Sei un architetto software senior. Il tuo compito è estrarre un blueprint tecnico strutturato da un documento progettuale.

Hai a disposizione:
1. Il testo originale della documentazione
2. I metadati del progetto già estratti (pass precedente)

═══════════════════════════════════════════════════════════════════
CLASSIFICAZIONE OBBLIGATORIA — 3 CATEGORIE SEPARATE
═══════════════════════════════════════════════════════════════════

Il blueprint DEVE separare gli elementi in 3 categorie distinte.
Ogni elemento DEVE apparire in UNA SOLA categoria. NESSUNA sovrapposizione.

┌─────────────────┬────────────────────────────────────────────────┐
│ COMPONENTS      │ Blocchi costruttivi INTERNI del sistema.       │
│                 │ Unità architetturali stabili e significative.  │
│                 │ Es: Frontend App, Workflow Engine, Reporting   │
│                 │ Module, Security Layer, Backend API.           │
│                 │                                                │
│                 │ NON inserire qui: sistemi esterni, servizi     │
│                 │ di terze parti, database di piattaforma.       │
│                 │ NON frammentare: raggruppa funzionalità simili │
│                 │ in un unico componente (es. "Email System",   │
│                 │ NON "Email sender" + "Email formatter").       │
│                 │ NON usare nomi generici ("Sistema", "Backend") │
│                 │ → usa nomi descrittivi ("Servizio Notifiche"). │
├─────────────────┼────────────────────────────────────────────────┤
│ DATA DOMAINS    │ Aree di dato BUSINESS del sistema.             │
│                 │ Entità di dominio gestite dal progetto.        │
│                 │ Es: Candidati, Posizioni Lavorative,           │
│                 │ Fatture, Ordini, Utenti, Contratti.            │
│                 │                                                │
│                 │ NON inserire qui: tecnologie (Dataverse, SQL), │
│                 │ infrastruttura, servizi o componenti.          │
│                 │ SOLO concetti di business/dominio.             │
├─────────────────┼────────────────────────────────────────────────┤
│ INTEGRATIONS    │ Sistemi ESTERNI o servizi di terze parti.      │
│                 │ Tutto ciò che è FUORI dal confine del sistema. │
│                 │ Es: Outlook, SAP, PayPal, External HR System,  │
│                 │ Google Maps API, SMTP Server, Active Directory.│
│                 │                                                │
│                 │ NON inserire qui: moduli interni del progetto. │
│                 │ Specificare sempre la direction:               │
│                 │ inbound / outbound / bidirectional / unknown.  │
└─────────────────┴────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
EVIDENCE — ANCORAGGIO AL TESTO SORGENTE
═══════════════════════════════════════════════════════════════════

Per ogni nodo (component, dataDomain, integration) DEVI fornire da 1 a 3
evidenze testuali brevi estratte dal documento sorgente.

REGOLE EVIDENCE:
- Ogni evidence è un oggetto { sourceType: "source_text", snippet: "..." }
- Lo snippet deve essere una citazione diretta dal documento (max 200 caratteri)
- NON inventare snippet: se non c'è appoggio testuale, NON creare il nodo
- Se un nodo è ragionevolmente deducibile ma senza citazione diretta,
  puoi crearlo con evidence vuoto [] — verrà flaggato come weak_evidence

═══════════════════════════════════════════════════════════════════
RELATIONS — COLLEGAMENTI TRA NODI
═══════════════════════════════════════════════════════════════════

Produci un array "relations" che descrive i collegamenti tra i nodi.
Ogni relazione ha:
- fromNodeId: nome temporaneo del nodo sorgente (uguale al "name" o "systemName")
- toNodeId: nome temporaneo del nodo destinazione
- type: uno tra "reads", "writes", "orchestrates", "syncs", "owns", "depends_on"
- confidence: 0-1 (quanto sei sicuro di questa relazione)
- evidence: [] (array di EvidenceRef, opzionale)

REGOLE RELATIONS:
- Produci solo relazioni inferibili dal testo, NON inventare
- Nessun self-loop (fromNodeId === toNodeId)
- Se non riesci a produrre relazioni ragionevoli, restituisci array vuoto []
- Massimo 20 relazioni

═══════════════════════════════════════════════════════════════════
COVERAGE & QUALITY FLAGS
═══════════════════════════════════════════════════════════════════

- "coverage": numero 0-1 che indica quanto il blueprint copre l'architettura
  descritta nel documento. 1.0 = copertura completa, 0.3 = molto parziale.
- "qualityFlags": array di stringhe che segnalano problemi rilevati.
  Usa questi flag se applicabili:
  - "missing_relations" — nessuna relazione prodotta
  - "weak_evidence" — nodi senza citazioni testuali dirette
  - "low_architectural_coverage" — il documento è troppo vago
  - "empty_column_components" — nessun component trovato
  - "empty_column_data_domains" — nessun data domain trovato
  - "empty_column_integrations" — nessuna integration trovata
  - "too_many_generic_nodes" — troppi nodi con nomi generici

═══════════════════════════════════════════════════════════════════
REGOLE OBBLIGATORIE
═══════════════════════════════════════════════════════════════════

STRUTTURA:
- Lo STESSO elemento NON PUÒ apparire in multiple categorie
- Minimo 2 components, massimo 10
- Se il testo menziona dati di business → almeno 1 dataDomain
- Se il testo menziona sistemi esterni → almeno 1 integration
- Se non ci sono dati di business chiari → dataDomains può essere vuoto
- Se non ci sono sistemi esterni chiari → integrations può essere vuoto

QUALITÀ:
- Resta a livello MACRO, project-level
- NON inventare dettagli non presenti nel testo
- NO endpoint specifici, NO classi, NO implementazioni fini
- Ogni elemento deve essere significativo per un diagramma architetturale
- NON generare elementi generici come "Database", "API", "Sistema"
- Ogni componente con tipo "integration" o "external_system" → SPOSTALO in integrations
- "confidence" deve essere sempre presente (0-1)

METADATI:
- "summary" deve essere un riassunto architetturale conciso (max 300 caratteri)
- "architecturalNotes" cattura decisioni architetturali rilevanti dedotte dal testo
- "assumptions" elenca ipotesi architetturali fatte
- "missingInformation" deve SEMPRE essere valorizzato se ci sono ambiguità

COMPONENT TYPES AMMESSI:
frontend, backend, database, workflow, reporting, security, infrastructure, other
(NON usare "integration" o "external_system" come tipo componente → metti in integrations)

Rispondi SOLO con JSON strutturato, senza testo aggiuntivo.`;

export function createTechnicalBlueprintResponseSchema() {
    const evidenceItemSchema = {
        type: 'object',
        properties: {
            sourceType: { type: 'string', enum: ['source_text'] },
            snippet: { type: 'string' },
        },
        required: ['sourceType', 'snippet'],
        additionalProperties: false,
    };

    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'technical_blueprint_response',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    summary: { type: ['string', 'null'] },
                    components: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                type: {
                                    type: 'string',
                                    enum: [
                                        'frontend', 'backend', 'database', 'integration',
                                        'workflow', 'reporting', 'security', 'infrastructure',
                                        'external_system', 'other',
                                    ],
                                },
                                description: { type: ['string', 'null'] },
                                confidence: { type: ['number', 'null'] },
                                evidence: { type: 'array', items: evidenceItemSchema },
                            },
                            required: ['name', 'type', 'description', 'confidence', 'evidence'],
                            additionalProperties: false,
                        },
                    },
                    dataDomains: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                description: { type: ['string', 'null'] },
                                confidence: { type: ['number', 'null'] },
                                evidence: { type: 'array', items: evidenceItemSchema },
                            },
                            required: ['name', 'description', 'confidence', 'evidence'],
                            additionalProperties: false,
                        },
                    },
                    integrations: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                systemName: { type: 'string' },
                                direction: {
                                    type: ['string', 'null'],
                                    enum: ['inbound', 'outbound', 'bidirectional', 'unknown', null],
                                },
                                description: { type: ['string', 'null'] },
                                confidence: { type: ['number', 'null'] },
                                evidence: { type: 'array', items: evidenceItemSchema },
                            },
                            required: ['systemName', 'direction', 'description', 'confidence', 'evidence'],
                            additionalProperties: false,
                        },
                    },
                    relations: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                fromNodeId: { type: 'string' },
                                toNodeId: { type: 'string' },
                                type: {
                                    type: 'string',
                                    enum: ['reads', 'writes', 'orchestrates', 'syncs', 'owns', 'depends_on'],
                                },
                                confidence: { type: ['number', 'null'] },
                                evidence: { type: 'array', items: evidenceItemSchema },
                            },
                            required: ['fromNodeId', 'toNodeId', 'type', 'confidence', 'evidence'],
                            additionalProperties: false,
                        },
                    },
                    coverage: { type: 'number' },
                    qualityFlags: { type: 'array', items: { type: 'string' } },
                    architecturalNotes: { type: 'array', items: { type: 'string' } },
                    assumptions: { type: 'array', items: { type: 'string' } },
                    missingInformation: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                },
                required: [
                    'summary', 'components', 'dataDomains', 'integrations',
                    'relations', 'coverage', 'qualityFlags',
                    'architecturalNotes', 'assumptions', 'missingInformation', 'confidence',
                ],
                additionalProperties: false,
            },
        },
    };
}
