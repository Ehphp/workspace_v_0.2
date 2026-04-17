/**
 * System prompt and JSON schemas for the "Generate Project from Documentation"
 * AI pipeline.
 *
 * Three-pass pipeline:
 *   Pass 1 → Project Draft extraction + Structured Document Digest (SDD)
 *   Pass 2 → Technical Blueprint extraction (from SDD, not raw text)
 *   Pass 3 → Project Activities generation
 */

// ============================================================================
// Pass 1 — Project Draft + Structured Document Digest (SDD)
// ============================================================================

export const PROJECT_DRAFT_SYSTEM_PROMPT = `Sei un analista senior specializzato nell'analisi di documentazione progettuale.

Il tuo compito è DUPLICE:
1. Estrarre i metadati strutturati di un progetto software dal documento
2. Produrre un DIGEST STRUTTURATO del documento che catturi tutte le informazioni architetturalmente rilevanti

═══════════════════════════════════════════════════════════════════
PARTE A — METADATI PROGETTO
═══════════════════════════════════════════════════════════════════

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

═══════════════════════════════════════════════════════════════════
PARTE B — STRUCTURED DOCUMENT DIGEST (SDD)
═══════════════════════════════════════════════════════════════════

Il digest è una rappresentazione strutturata dell'INTERO documento che
verrà usata da un altro modello AI (che NON avrà accesso al testo originale)
per costruire il blueprint tecnico. Deve essere COMPLETO e ACCURATO.

CAMPI DEL DIGEST:

1. "functionalAreas" — Le aree funzionali principali del sistema.
   Ogni area ha:
   - "title": nome dell'area (es. "Gestione Candidature", "Reportistica")
   - "description": descrizione sintetica (max 200 caratteri)
   - "keyPassages": 1-3 citazioni VERBATIM dal documento (max 200 char ciascuna)
   Estrai TUTTE le aree funzionali rilevanti, non solo le più evidenti.
   Minimo 2, massimo 8 aree.

2. "businessEntities" — Entità di business menzionate nel documento.
   Ogni entità ha:
   - "name": nome dell'entità (es. "Candidato", "Fattura", "Ordine")
   - "role": ruolo nel sistema (es. "Entità principale", "Riferimento esterno")
   Estrai TUTTE le entità di dominio chiaramente identificabili.

3. "externalSystems" — Sistemi esterni o servizi di terze parti menzionati.
   Ogni sistema ha:
   - "name": nome del sistema (es. "SAP", "Outlook", "Active Directory")
   - "interactionDescription": come interagisce col sistema (max 150 caratteri)
   Includi SOLO sistemi chiaramente menzionati come esterni.

4. "technicalConstraints" — Vincoli tecnici espliciti (es. "Must run on Azure",
   "Deve supportare 1000 utenti concorrenti"). Array di stringhe.

5. "nonFunctionalRequirements" — Requisiti non funzionali menzionati
   (performance, security, scalability, compliance). Array di stringhe.

6. "keyPassages" — Le 10-15 citazioni PIÙ IMPORTANTI dal documento originale.
   Ogni passage ha:
   - "label": etichetta di contesto (es. "architettura", "requisito-chiave", "vincolo")
   - "text": citazione VERBATIM dal documento (max 200 caratteri)
   REGOLE CRITICHE:
   - Le citazioni DEVONO essere copiate ESATTAMENTE dal testo originale
   - NON parafrasare, NON riassumere, NON inventare
   - Seleziona passaggi che descrivono architettura, flussi, vincoli, decisioni tecniche
   - Questi passaggi verranno usati come EVIDENCE dal modello successivo
   - Minimo 5, massimo 15 passaggi

7. "ambiguities" — Ambiguità o contraddizioni rilevate nel documento.
   Array di stringhe descrittive.

8. "operationalWorkflows" — Workflow operativi / processi di business descritti nel documento.
   Ogni workflow ha:
   - "name": nome del processo (es. "Approvazione Ordine", "Onboarding Cliente")
   - "trigger": evento che avvia il processo (es. "Ricezione ordine", "Registrazione utente")
   - "actors": array di attori coinvolti (es. ["Responsabile Vendite", "Sistema ERP", "Cliente"])
   - "keySteps": riassunto sintetico dei passi principali (max 300 caratteri)
   Estrai TUTTI i flussi operativi e processi di business chiaramente descritti.
   Se il documento non descrive workflow, array VUOTO. (min 0, max 10)

9. "documentQuality" — Valutazione della qualità/completezza del documento:
   - "high": documento dettagliato con requisiti chiari e architettura definita
   - "medium": documento parziale, alcuni requisiti chiari ma molte lacune
   - "low": documento vago, poche informazioni tecniche concrete

REGOLE DIGEST:
- Il digest deve coprire TUTTO il documento, non solo le prime sezioni
- Le keyPassages DEVONO essere citazioni VERBATIM (copiate esattamente)
- NON omettere informazioni architetturalmente rilevanti
- Se il documento è breve/vago, il digest sarà più corto — va bene
- Il digest è l'UNICA fonte di informazione per il pass successivo

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
                    // ── Part A: Project Metadata ──
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
                    // ── Part B: Structured Document Digest (SDD) ──
                    structuredDigest: {
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
                required: [
                    'name', 'description', 'owner', 'technologyId',
                    'projectType', 'domain', 'scope', 'teamSize',
                    'deadlinePressure', 'methodology', 'confidence',
                    'assumptions', 'missingFields', 'reasoning',
                    'structuredDigest',
                ],
                additionalProperties: false,
            },
        },
    };
}

// ============================================================================
// Pass 2 — Technical Blueprint Extraction
// ============================================================================

export const TECHNICAL_BLUEPRINT_SYSTEM_PROMPT = `Sei un architetto software senior. Il tuo compito è estrarre un blueprint tecnico strutturato da un DIGEST STRUTTURATO di documentazione progettuale.

Hai a disposizione:
1. Un Structured Document Digest (SDD) — prodotto da un analista che ha letto il documento originale
2. I metadati del progetto già estratti (pass precedente)

IMPORTANTE: NON hai accesso al documento originale. L'SDD è la tua UNICA fonte di informazione.
L'SDD contiene aree funzionali, entità di business, sistemi esterni, vincoli tecnici, e
citazioni verbatim (keyPassages) dal documento originale che puoi usare come evidence.

═══════════════════════════════════════════════════════════════════
CLASSIFICAZIONE OBBLIGATORIA — 4 CATEGORIE SEPARATE
═══════════════════════════════════════════════════════════════════

Il blueprint DEVE separare gli elementi in 4 categorie distinte.
Ogni elemento DEVE apparire in UNA SOLA categoria. NESSUNA sovrapposizione.

┌─────────────────┬────────────────────────────────────────────────┐
│ COMPONENTS      │ Blocchi costruttivi INTERNI del sistema.       │
│                 │ Unità architetturali stabili e significative.  │
│                 │ COMPONENT = unità di logica o responsabilità   │
│                 │ tecnica (ha un tipo). NON dati puri.           │
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
│                 │ DATA DOMAIN = insieme coerente di dati/entità. │
│                 │ NON contiene comportamento.                    │
│                 │ Es: Candidati, Posizioni Lavorative,           │
│                 │ Fatture, Ordini, Utenti, Contratti.            │
│                 │                                                │
│                 │ NON inserire qui: tecnologie (Dataverse, SQL), │
│                 │ infrastruttura, servizi o componenti.          │
│                 │ SOLO concetti di business/dominio.             │
│                 │                                                │
│                 │ ESEMPIO CORRETTO: "Anagrafica Clienti" →       │
│                 │   dataDomain (sono dati puri, no logica)       │
│                 │ ESEMPIO ERRATO: "Anagrafica Clienti" →         │
│                 │   component (NON ha logica propria)            │
├─────────────────┼────────────────────────────────────────────────┤
│ WORKFLOWS       │ Flussi operativi e processi di business.       │
│                 │ Sequenze di passi che coinvolgono componenti   │
│                 │ e/o domini dati. Hanno un trigger e step.      │
│                 │ Es: "Processo Approvazione Ordine",            │
│                 │ "Flusso Onboarding Dipendente",                │
│                 │ "Ciclo Fatturazione Mensile".                  │
│                 │                                                │
│                 │ DISTINGUI da component: un workflow descrive   │
│                 │ un PROCESSO (chi fa cosa in che ordine),        │
│                 │ NON un modulo tecnico.                         │
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
EVIDENCE — ANCORAGGIO AI KEY PASSAGES DEL DIGEST
═══════════════════════════════════════════════════════════════════

Per ogni nodo (component, dataDomain, integration) DEVI fornire da 1 a 3
evidenze testuali. Le evidenze DEVONO provenire dai keyPassages del digest
(sia quelli globali che quelli nelle functionalAreas).

REGOLE EVIDENCE:
- Ogni evidence è un oggetto { sourceType: "source_text", snippet: "..." }
- Lo snippet deve essere copiato da un keyPassage del digest (max 200 caratteri)
- NON inventare snippet: usa SOLO testo presente nei keyPassages
- Se un nodo è ragionevolmente deducibile dall'SDD ma senza keyPassage diretto,
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
- Produci solo relazioni inferibili dal digest, NON inventare
- Nessun self-loop (fromNodeId === toNodeId)
- Se non riesci a produrre relazioni ragionevoli, restituisci array vuoto []
- Massimo 20 relazioni

═══════════════════════════════════════════════════════════════════
COVERAGE & QUALITY FLAGS
═══════════════════════════════════════════════════════════════════

- "coverage": numero 0-1 che indica quanto il blueprint copre l'architettura
  descritta nel digest. 1.0 = copertura completa, 0.3 = molto parziale.
- "qualityFlags": array di stringhe che segnalano problemi rilevati.
  Usa questi flag se applicabili:
  - "missing_relations" — nessuna relazione prodotta
  - "weak_evidence" — nodi senza citazioni testuali dirette
  - "low_architectural_coverage" — il digest è troppo vago
  - "empty_column_components" — nessun component trovato
  - "empty_column_data_domains" — nessun data domain trovato
  - "empty_column_integrations" — nessuna integration trovata
  - "empty_column_workflows" — nessun workflow trovato
  - "too_many_generic_nodes" — troppi nodi con nomi generici

═══════════════════════════════════════════════════════════════════
SEGNALI SEMANTICI PER LA STIMA
═══════════════════════════════════════════════════════════════════

Estrai SOLO informazioni semantiche che richiedono comprensione del documento.
NON generare segnali derivabili dalla struttura del blueprint (fragilità,
coupling, costo di modifica, riuso). Quelli verranno calcolati automaticamente.

1. "constraints" — Vincoli che impattano la stima futura (max 5).
   Ogni vincolo:
   - "type": "technical" | "organizational" | "integration" | "compliance"
   - "description": descrizione concisa (max 200 caratteri)
   - "estimationImpact": "low" | "medium" | "high"
   SOLO vincoli chiaramente deducibili dal digest. Se non ce ne sono, array VUOTO.

2. "extensionPoints" — Aree dove è naturale aggiungere funzionalità (max 5).
   Ogni punto:
   - "area": nome di un componente o area del blueprint (DEVE corrispondere
     al name di un nodo già prodotto in components, dataDomains o integrations)
   - "description": perché è un punto di estensione (max 200 caratteri)
   - "naturalFit": "add" (aggiungere nuovo) | "modify" (modificare esistente) | "replace"
   SOLO se deducibili dal digest. Se non ce ne sono, array VUOTO.

═══════════════════════════════════════════════════════════════════
REGOLE OBBLIGATORIE
═══════════════════════════════════════════════════════════════════

STRUTTURA:
- Lo STESSO elemento NON PUÒ apparire in multiple categorie
- Minimo 2 components, massimo 10
- Se il digest menziona dati di business (businessEntities) → almeno 1 dataDomain
- Se il digest menziona sistemi esterni (externalSystems) → almeno 1 integration
- Se il digest descrive flussi operativi o processi → almeno 1 workflow
- Se non ci sono dati di business chiari → dataDomains può essere vuoto
- Se non ci sono sistemi esterni chiari → integrations può essere vuoto
- Se non ci sono flussi operativi chiari → workflows può essere vuoto

QUALITÀ:
- Resta a livello MACRO, project-level
- NON inventare dettagli non presenti nel digest
- NO endpoint specifici, NO classi, NO implementazioni fini
- Ogni elemento deve essere significativo per un diagramma architetturale
- NON generare elementi generici come "Database", "API", "Sistema"
- Ogni componente con tipo "integration" o "external_system" → SPOSTALO in integrations
- "confidence" deve essere sempre presente (0-1)

METADATI:
- "summary" deve essere un riassunto architetturale conciso (max 300 caratteri)
- "architecturalNotes" cattura decisioni architetturali rilevanti dedotte dal digest
- "assumptions" elenca ipotesi architetturali fatte
- "missingInformation" deve SEMPRE essere valorizzato se ci sono ambiguità (controlla il campo ambiguities del digest)

COMPONENT TYPES AMMESSI:
frontend, backend, database, reporting, security, infrastructure, other
(NON usare "integration" o "external_system" come tipo componente → metti in integrations)
(NON usare "workflow" come tipo componente → metti in workflows)

TIPI SPECIFICI PER TECNOLOGIA (usa quando la tecnologia è nota):
- Power Platform: canvas_app, model_driven_app, dataverse_table, custom_connector, cloud_flow, power_automate_desktop, pcf_control
- Backend (.NET, Java, Node.js): api_controller, service_layer, repository, middleware, queue_processor, scheduled_job
- Frontend (React, Angular, Vue): page, component_library, state_manager, form, data_grid

ISTRUZIONE TECNOLOGIA:
Se i metadati del progetto specificano una tecnologia primaria, DEVI usare i tipi specifici sopra indicati anziché i tipi generici.
Ad esempio: per un progetto Power Platform, usa "canvas_app" invece di "frontend", "cloud_flow" invece di "workflow".
Se la tecnologia non è tra quelle elencate, usa i tipi generici.

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
                                        // Generic types
                                        'frontend', 'backend', 'database', 'integration',
                                        'reporting', 'security', 'infrastructure',
                                        'external_system', 'other',
                                        // Power Platform specific
                                        'canvas_app', 'model_driven_app', 'dataverse_table',
                                        'custom_connector', 'cloud_flow', 'power_automate_desktop',
                                        'pcf_control',
                                        // Backend specific
                                        'api_controller', 'service_layer', 'repository',
                                        'middleware', 'queue_processor', 'scheduled_job',
                                        // Frontend specific
                                        'page', 'component_library', 'state_manager',
                                        'form', 'data_grid',
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
                    workflows: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                description: { type: ['string', 'null'] },
                                trigger: { type: 'string' },
                                steps: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            order: { type: 'number' },
                                            action: { type: 'string' },
                                            actor: { type: ['string', 'null'], enum: ['user', 'system', 'external', null] },
                                            component: { type: ['string', 'null'] },
                                        },
                                        required: ['order', 'action', 'actor', 'component'],
                                        additionalProperties: false,
                                    },
                                },
                                involvedComponents: { type: 'array', items: { type: 'string' } },
                                involvedDataDomains: { type: 'array', items: { type: 'string' } },
                                complexity: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
                                confidence: { type: ['number', 'null'] },
                                evidence: { type: 'array', items: evidenceItemSchema },
                            },
                            required: ['name', 'description', 'trigger', 'steps', 'involvedComponents', 'involvedDataDomains', 'complexity', 'confidence', 'evidence'],
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
                    constraints: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['technical', 'organizational', 'integration', 'compliance'] },
                                description: { type: 'string' },
                                estimationImpact: { type: 'string', enum: ['low', 'medium', 'high'] },
                            },
                            required: ['type', 'description', 'estimationImpact'],
                            additionalProperties: false,
                        },
                    },
                    extensionPoints: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                area: { type: 'string' },
                                description: { type: 'string' },
                                naturalFit: { type: 'string', enum: ['add', 'modify', 'replace'] },
                            },
                            required: ['area', 'description', 'naturalFit'],
                            additionalProperties: false,
                        },
                    },
                },
                required: [
                    'summary', 'components', 'dataDomains', 'integrations', 'workflows',
                    'relations', 'coverage', 'qualityFlags',
                    'architecturalNotes', 'assumptions', 'missingInformation', 'confidence',
                    'constraints', 'extensionPoints',
                ],
                additionalProperties: false,
            },
        },
    };
}
