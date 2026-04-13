# Project Technical Blueprint — Documentazione di Riferimento

**Data:** 2026-04-13  
**Tipo:** Documentazione tecnica strutturale — struttura dati, funzione, utilizzo  
**Fonte:** Analisi diretta del codice sorgente

---

## Indice

1. [Cos'è il Project Technical Blueprint](#1-cosè-il-project-technical-blueprint)
2. [Struttura Dati Completa](#2-struttura-dati-completa)
3. [Ciclo di Vita](#3-ciclo-di-vita)
4. [Generazione AI](#4-generazione-ai)
5. [Normalizzazione Post-AI](#5-normalizzazione-post-ai)
6. [Persistenza e Versionamento](#6-persistenza-e-versionamento)
7. [Visualizzazione: Grafo a 3 Colonne](#7-visualizzazione-grafo-a-3-colonne)
8. [Inspector e Curation](#8-inspector-e-curation)
9. [Blueprint Search](#9-blueprint-search)
10. [Quality Score](#10-quality-score)
11. [Semantic Diff tra Versioni](#11-semantic-diff-tra-versioni)
12. [Utilizzo Downstream: Pipeline di Stima](#12-utilizzo-downstream-pipeline-di-stima)
13. [Blueprint Activity Mapper](#13-blueprint-activity-mapper)
14. [Schema Database](#14-schema-database)
15. [Mappa dei File](#15-mappa-dei-file)
16. [Glossario](#16-glossario)

---

## 1. Cos'è il Project Technical Blueprint

Il **Project Technical Blueprint** (PTB) è l'artefatto centrale a livello progetto che cattura la **baseline architetturale** di un progetto software. È una rappresentazione strutturata di:

- **Componenti** architetturali (frontend, backend, database, workflow, ecc.)
- **Domini dati** (entità di business gestite dal progetto)
- **Integrazioni** con sistemi esterni (SAP, Outlook, API terze parti, ecc.)
- **Relazioni** esplicite tra i nodi (reads, writes, orchestrates, syncs, owns, depends_on)
- **Metadati di qualità** (evidence, confidence, coverage, quality flags)

Il blueprint:
- Viene generato automaticamente dalla documentazione di progetto via pipeline AI a 3 passaggi
- Viene presentato all'utente per review ed editing prima del salvataggio
- Viene persistito in Supabase con versionamento (v1, v2, v3…)
- Viene consumato downstream dalla pipeline di stima per contestualizzare i requisiti

**Non è** un blueprint a livello di singolo requisito (quello è l'`EstimationBlueprint`). Il PTB opera a livello di progetto e fornisce contesto architetturale a tutte le stime.

---

## 2. Struttura Dati Completa

### 2.1 ProjectTechnicalBlueprint (Tipo Dominio)

**File:** [netlify/functions/lib/domain/project/project-technical-blueprint.types.ts](netlify/functions/lib/domain/project/project-technical-blueprint.types.ts)

```typescript
interface ProjectTechnicalBlueprint {
    // ── Identificativi ──
    id?: string;                          // UUID
    projectId: string;                    // FK → projects.id
    version: number;                      // Auto-incrementale per progetto
    createdAt?: string;                   // Timestamp ISO

    // ── Contenuto ──
    sourceText?: string;                  // Testo documentale originale
    summary?: string;                     // Sintesi AI del progetto
    components: BlueprintComponent[];     // Max 10 (consigliato)
    dataDomains: BlueprintDataDomain[];   // Max 20
    integrations: BlueprintIntegration[]; // Max 15
    architecturalNotes: string[];         // Note architetturali libere
    assumptions: string[];                // Assunzioni fatte dall'AI
    missingInformation: string[];         // Lacune identificate

    // ── Metriche (v1) ──
    confidence?: number;                  // 0–1, auto-valutazione AI

    // ── Enrichment (v2) ──
    relations?: BlueprintRelation[];      // Relazioni esplicite tra nodi
    coverage?: number;                    // 0–1, copertura architetturale
    qualityFlags?: string[];              // Flag deterministici (es. "empty_center_column")
    qualityScore?: number;                // 0–1, score di qualità strutturale
    reviewStatus?: ReviewStatus;          // 'draft' | 'reviewed' | 'approved'
    changeSummary?: string;               // Riepilogo cambiamenti rispetto a v precedente
    diffFromPrevious?: BlueprintDiffSummary; // Diff strutturato
    structuredDigest?: StructuredDocumentDigest; // SDD dal Pass 1
}
```

### 2.2 BlueprintComponent

Rappresenta un modulo architetturale del progetto.

```typescript
interface BlueprintComponent {
    id?: string;                           // Deterministico: "cmp_" + slug(name)
    name: string;                          // Es. "Workflow Engine", "Dashboard Clienti"
    type: BlueprintComponentType;          // Tassonomia (30 valori possibili)
    description?: string;                  // Descrizione funzionale
    confidence?: number;                   // 0–1
    businessCriticality?: CriticalityLevel; // 'low' | 'medium' | 'high'
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];              // Citazioni dalla documentazione
}
```

**Tipi di componente (`BlueprintComponentType`):**

| Categoria | Tipi |
|-----------|------|
| Generici | `frontend`, `backend`, `database`, `integration`, `workflow`, `reporting`, `security`, `infrastructure`, `external_system`, `other` |
| Power Platform | `canvas_app`, `model_driven_app`, `dataverse_table`, `custom_connector`, `cloud_flow`, `power_automate_desktop`, `pcf_control` |
| Backend | `api_controller`, `service_layer`, `repository`, `middleware`, `queue_processor`, `scheduled_job` |
| Frontend | `page`, `component_library`, `state_manager`, `form`, `data_grid` |

### 2.3 BlueprintDataDomain

Rappresenta un'entità di business o dominio dati gestito dal progetto.

```typescript
interface BlueprintDataDomain {
    id?: string;                           // Deterministico: "dom_" + slug(name)
    name: string;                          // Es. "Ordini d'Acquisto", "Anagrafica Clienti"
    description?: string;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
}
```

### 2.4 BlueprintIntegration

Rappresenta un sistema esterno collegato al progetto.

```typescript
interface BlueprintIntegration {
    id?: string;                           // Deterministico: "int_" + slug(systemName)
    systemName: string;                    // Es. "SAP S/4HANA", "Microsoft Outlook"
    direction?: IntegrationDirection;      // 'inbound' | 'outbound' | 'bidirectional' | 'unknown'
    description?: string;
    confidence?: number;
    businessCriticality?: CriticalityLevel;
    changeLikelihood?: CriticalityLevel;
    estimationImpact?: CriticalityLevel;
    reviewStatus?: ReviewStatus;
    evidence?: EvidenceRef[];
}
```

### 2.5 BlueprintRelation

Collegamento esplicito tra due nodi qualsiasi del blueprint.

```typescript
interface BlueprintRelation {
    id: string;
    fromNodeId: string;                    // ID del nodo sorgente
    toNodeId: string;                      // ID del nodo destinazione
    type: BlueprintRelationType;           // 'reads' | 'writes' | 'orchestrates' | 'syncs' | 'owns' | 'depends_on'
    confidence?: number;
    evidence?: EvidenceRef[];
}
```

### 2.6 EvidenceRef

Citazione testuale dalla documentazione originale che supporta l'esistenza di un nodo o relazione.

```typescript
interface EvidenceRef {
    sourceType: 'source_text';
    snippet: string;                       // Max 200 chars (troncato dal normalizer)
    startOffset?: number;
    endOffset?: number;
}
```

### 2.7 StructuredDocumentDigest (SDD)

Prodotto dal Pass 1 della pipeline AI. Rappresenta un'analisi strutturata del documento sorgente.

```typescript
interface StructuredDocumentDigest {
    functionalAreas: SDDFunctionalArea[];      // Max ~10 — aree funzionali chiave
    businessEntities: SDDBusinessEntity[];     // Max ~20 — entità di business
    externalSystems: SDDExternalSystem[];      // Max ~15 — sistemi esterni
    technicalConstraints: string[];            // Vincoli tecnici
    nonFunctionalRequirements: string[];       // Requisiti non funzionali
    keyPassages: SDDKeyPassage[];              // Max ~20 — citazioni verbatim chiave
    ambiguities: string[];                     // Ambiguità identificate nel documento
    documentQuality: 'high' | 'medium' | 'low';
}
```

### 2.8 BlueprintDiffSummary

Diff semantico tra due versioni consecutive del blueprint.

```typescript
interface BlueprintDiffSummary {
    addedNodes: string[];
    removedNodes: string[];
    updatedNodes: string[];
    reclassifiedNodes: string[];       // Es. "SAP (component → integration)"
    addedRelations: string[];
    removedRelations: string[];
    changedAssumptions: boolean;
    changedMissingInformation: boolean;
    breakingArchitecturalChanges: boolean;
}
```

---

## 3. Ciclo di Vita

```
┌──────────────────────────┐
│ 1. DOCUMENTAZIONE        │  L'utente incolla testo documentale (max 20K chars)
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ 2. GENERAZIONE AI        │  Pipeline a 3 pass (Pass 1: SDD, Pass 2: Blueprint, Pass 3: Attività)
│    (server-side)         │  Normalizzazione deterministica post-AI
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ 3. REVIEW & EDITING      │  L'utente rivede e modifica in una UI dedicata
│    (client-side)         │  CRUD su componenti, domini, integrazioni, relazioni
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ 4. PERSISTENZA           │  Salvataggio su Supabase con versioning, diff, quality score
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ 5. VISUALIZZAZIONE       │  Grafo interattivo a 3 colonne + Inspector
│    (ProjectBlueprintTab) │  Ricerca full-text, highlighting relazioni
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│ 6. CONSUMO DOWNSTREAM    │  Blueprint rules → bias per stima
│    (pipeline di stima)   │  Blueprint formatter → baseline architetturale nei prompt
│                          │  Activity signal adapter → segnali priorità massima
└──────────────────────────┘
```

**Stati del blueprint:**
- **`draft`** — Stato iniziale post-generazione, prima di review umana
- **`reviewed`** — L'utente ha esaminato i nodi
- **`approved`** — L'utente ha validato il blueprint come corretto

---

## 4. Generazione AI

**File:** [netlify/functions/lib/ai/actions/generate-project-from-documentation.ts](netlify/functions/lib/ai/actions/generate-project-from-documentation.ts)

Il blueprint viene generato nel **Pass 2** di una pipeline a 3 passaggi:

| Pass | Modello | T | maxTokens | Input | Output |
|------|---------|---|-----------|-------|--------|
| **Pass 1** | gpt-4o-mini | 0.2 | 4000 | Testo documentale completo + catalogo tech | `ProjectDraft` + `StructuredDocumentDigest` |
| **Pass 2** | gpt-5 | 0.2 | 8000 | SDD (JSON) + metadati Pass 1 + vocabolario attività | `ProjectTechnicalBlueprint` grezzo |
| **Pass 3** | gpt-4o-mini | 0.3 | 3000 | SDD + blueprint (nomi/tipi) + catalogo standard | `ProjectActivity[]`  |

### Pass 2 in dettaglio

**Prompt:** `TECHNICAL_BLUEPRINT_SYSTEM_PROMPT` in [netlify/functions/lib/ai/prompts/project-from-documentation.ts](netlify/functions/lib/ai/prompts/project-from-documentation.ts)

Il prompt istruisce il modello a:
1. Estrarre componenti architetturali dall'SDD (max 10)
2. Identificare domini dati (max 20)
3. Catalogare integrazioni con sistemi esterni (max 15)
4. Stabilire relazioni tra i nodi (max 20)
5. Calcolare coverage e confidence
6. Annotare quality flags, assunzioni, informazioni mancanti

**Schema validation:** JSON Schema strict mode (OpenAI structured outputs) + validazione Zod server-side (`TechnicalBlueprintSchema`).

**Input al Pass 2:**
```
DIGEST STRUTTURATO DEL DOCUMENTO:
{SDD serializzato come JSON}

METADATI PROGETTO ESTRATTI:
- Nome, Descrizione, Tipo, Dominio, Scope, Metodologia, Tecnologia

CATALOGO ATTIVITÀ DISPONIBILI (terminologia):
  ANALYSIS: [lista codici]
  DEV: [lista codici]
  ...
```

---

## 5. Normalizzazione Post-AI

**File:** [netlify/functions/lib/ai/post-processing/normalize-blueprint.ts](netlify/functions/lib/ai/post-processing/normalize-blueprint.ts)

Dopo la generazione AI, il blueprint grezzo attraversa **10 step deterministici** di normalizzazione. Nessuna AI, completamente testabile.

### 5.1 I 10 Step

| Step | Nome | Descrizione | Effetto |
|------|------|-------------|---------|
| **1** | Reclassificazione | Sposta componenti con tipo `integration`/`external_system`/`custom_connector` o il cui nome matcha pattern noti nella colonna Integrazioni | Corregge errori AI di classificazione |
| **2** | Deduplica cross-categoria | Se lo stesso nome appare in components e integrations, rimuove il duplicato dalla categoria meno appropriata | Elimina duplicati cross-colonna |
| **3** | Deduplica semantica | Confronto nomi normalizzati + alias noti (es. `office365` = `microsoft365`, `postgres` = `postgresql`) all'interno della stessa categoria | Elimina duplicati intra-colonna |
| **4** | Rimozione nodi generici | Rimuove nodi con nomi troppo vaghi ("Database", "API", "Sistema") | Pulisce il rumore |
| **5** | Stabilizzazione IDs | Genera IDs deterministici: `cmp_` + slug, `dom_` + slug, `int_` + slug | IDs stabili per diff e relazioni |
| **6** | Validazione relazioni | Verifica che `fromNodeId` e `toNodeId` puntino a nodi esistenti. Tenta risoluzione per nome prima di eliminare | Rimuove relazioni orfane |
| **7** | Consolidazione evidence | Tronca snippet a 200 chars, deduplica evidence identiche | Uniforma formato evidence |
| **8** | Quality flags | Calcola flag deterministici basati sulla struttura (empty columns, generic nodes, weak evidence, ecc.) | Annotazione qualità |
| **9** | Coverage | Ricalcola copertura basata su numero nodi e relazioni | Override dell'auto-valutazione AI |
| **10** | Validazione strutturale | Emette warning per blueprint sbilanciati (troppe componenti, colonne vuote, nodi senza descrizione) | Log diagnostico |

### 5.2 Pattern di Reclassificazione (Step 1)

`KNOWN_EXTERNAL_PATTERNS` — regex che innescano la migrazione componente→integrazione:

| Pattern | Sistemi matchati |
|---------|-----------------|
| `outlook\|exchange\|sharepoint\|teams\|office 365\|microsoft 365` | Microsoft ecosystem |
| `salesforce\|sap\|oracle\|workday\|servicenow` | ERP/CRM enterprise |
| `stripe\|paypal\|braintree\|adyen` | Payment gateways |
| `twilio\|sendgrid\|mailchimp\|mailgun` | Messaging services |
| `slack\|discord\|telegram\|whatsapp` | Chat platforms |
| `google (maps\|analytics\|calendar\|workspace\|drive)` | Google services |
| `aws\|azure\|gcp` | Cloud providers |
| `jira\|confluence\|trello\|asana` | Project management |
| `github\|gitlab\|bitbucket` | DevOps |
| `active directory\|ldap\|okta\|auth0` | Identity providers |
| `smtp\|imap\|pop3` | Email protocols |
| `external\|third.party\|terze? parti` | Generic external patterns |

### 5.3 Alias Noti per Deduplica (Step 3)

Alias semantici normalizzati per evitare duplicati:

| Alias | Forma canonica |
|-------|---------------|
| `office365`, `o365`, `ms365` | `microsoft365` |
| `mssql` | `sqlserver` |
| `postgres` | `postgresql` |
| `mongo` | `mongodb` |
| `ad` | `activedirectory` |
| `gcp` | `googlecloudplatform` |
| `aws` | `amazonwebservices` |

---

## 6. Persistenza e Versionamento

**File:** [src/lib/project-technical-blueprint-repository.ts](src/lib/project-technical-blueprint-repository.ts)

### 6.1 Operazioni CRUD

| Operazione | Funzione | Descrizione |
|------------|----------|-------------|
| **Read latest** | `getLatestProjectTechnicalBlueprint(projectId)` | Ritorna la versione più recente (highest version) |
| **List versions** | `listProjectTechnicalBlueprintVersions(projectId)` | Tutte le versioni, newest first |
| **Create** | `createProjectTechnicalBlueprint(input)` | Crea nuova versione con auto-increment, diff e quality score |
| **Update** | `updateProjectTechnicalBlueprint(blueprintId, patch)` | Aggiorna in-place (stessa versione), per editing post-creazione |

### 6.2 Logica di Creazione

Al salvataggio di una nuova versione:

```
1. Fetch versione precedente (se esiste)
2. nextVersion = previousVersion + 1  (oppure 1 se è la prima)
3. Se esiste versione precedente:
   a. computeProjectBlueprintDiff(previous, next) → BlueprintDiffSummary
   b. formatChangeSummary(diff) → stringa leggibile
4. computeBlueprintQualityScore(blueprint) → qualityScore
5. INSERT in Supabase con tutti i campi calcolati
```

### 6.3 Mapping Row ↔ Domain

La tabella usa snake_case (Supabase), il dominio usa camelCase. Il mapping è gestito da due funzioni:

- `mapBlueprintRowToDomain(row)` — snake_case → camelCase, `null` → `undefined`
- `mapInputToRow(input, version)` — camelCase → snake_case, `undefined` → `null`

---

## 7. Visualizzazione: Grafo a 3 Colonne

### 7.1 Architettura UI

```
ProjectBlueprintTab
│
├── ProjectBlueprintGraph (React Flow canvas)
│   └── BlueprintNode (singolo nodo custom)
│
├── ProjectBlueprintInspector (pannello laterale)
│   ├── BlueprintOverview (quando nessun nodo selezionato)
│   └── NodeDetail (quando un nodo è selezionato)
│
└── Search bar (con highlighting real-time)
```

**File principale:** [src/components/projects/blueprint/ProjectBlueprintTab.tsx](src/components/projects/blueprint/ProjectBlueprintTab.tsx)

### 7.2 Layout a 3 Colonne

**File:** [src/lib/projects/project-blueprint-graph.ts](src/lib/projects/project-blueprint-graph.ts)

Il grafo è organizzato in 3 colonne verticali:

| Colonna | Posizione X | Contenuto | Colore nodo |
|---------|------------|-----------|-------------|
| **Sinistra** | 0 | Data Domains | Verde (#22c55e) |
| **Centro** | 400 | Core Components | Blu (#3b82f6) |
| **Destra** | 800 | Integrations | Viola (#a855f7) |

Dimensioni nodo per tipo:

| Tipo | Larghezza | Altezza |
|------|-----------|---------|
| Component | 220–260px | 80px |
| Data Domain | 160–200px | 64px |
| Integration | 180–220px | 72px |

Gap verticale tra nodi: 24px. I nodi nella colonna centro con tipo `backend`, `database`, `infrastructure` sono marcati come "Core" (isPrimary).

### 7.3 Edges e Relazioni

Le relazioni del blueprint vengono mappate in edges con colori semantici:

| Tipo relazione | Colore | Significato |
|----------------|--------|-------------|
| `reads` | Cielo (#0ea5e9) | Il nodo legge dati dal target |
| `writes` | Ambra (#f59e0b) | Il nodo scrive dati verso il target |
| `orchestrates` | Indaco (#6366f1) | Il nodo orchestra/controlla il target |
| `syncs` | Teal (#14b8a6) | Sincronizzazione bidirezionale |
| `owns` | Verde (#22c55e) | Proprietà/ownership del target |
| `depends_on` | Rosso (#ef4444) | Dipendenza dal target |

### 7.4 Interazioni

- **Click su nodo:** Seleziona il nodo, evidenzia nodi connessi (via adjacency map), dimma gli altri (opacity 0.25)
- **Click su canvas vuoto:** Deseleziona, ripristina opacità normale
- **Ricerca:** Nodi matchati vengono evidenziati con bordo ambra; nodi non matchati vengono dimmati

### 7.5 Indicatori Visivi sui Nodi

| Indicatore | Posizione | Significato |
|------------|-----------|-------------|
| Badge tipo | Top-left interno | Tipo componente (es. "backend", "form") |
| "Core" | Accanto al badge | Componente core (backend/database/infrastructure) |
| "Critical" | Accanto al badge | `businessCriticality === 'high'` |
| ✓ verde | Top-right esterno | `reviewStatus === 'approved'` |
| ◉ blu | Top-right esterno | `reviewStatus === 'reviewed'` |
| ! giallo | Top-left esterno | Nodo senza evidence |
| Bordo 3px | Border | Nodo core o high-criticality |
| Saturazione ridotta | Intero nodo | Nodo senza evidence |

---

## 8. Inspector e Curation

**File:** [src/components/projects/blueprint/ProjectBlueprintInspector.tsx](src/components/projects/blueprint/ProjectBlueprintInspector.tsx)

### 8.1 Modalità Overview (nessun nodo selezionato)

Mostra un riepilogo del blueprint:
- Summary del progetto
- Conteggi per categoria (componenti, domini, integrazioni)
- Architectural notes
- Assumptions
- Missing information
- Quality score badge
- Coverage indicator

### 8.2 Modalità NodeDetail (nodo selezionato)

Mostra tutti i dettagli del nodo:
- Tipo e kind con badge colorato
- Label "Core" / "Critical" se applicabile
- Review status badge
- Description completa
- **Evidence** — snippet dalla documentazione originale con conteggio
- **Relazioni tipizzate** — relazioni entranti/uscenti con tipo e target
- **Nodi connessi** — lista nodi direttamente collegati (da adjacency map)
- Insights generati euristicamente ("Why this matters")

### 8.3 Review Cards (in fase Creation)

**File:** [src/components/projects/blueprint/BlueprintNodeReviewCard.tsx](src/components/projects/blueprint/BlueprintNodeReviewCard.tsx)

Durante la creazione del progetto (prima del salvataggio), ogni nodo viene presentato in una card di review che permette:
- **Conferma** — accetta il nodo come generato
- **Rifiuto** — esclude il nodo dal blueprint
- **Reclassificazione** — cambia la categoria (es. componente → integrazione)
- **Editing inline** — modifica nome, descrizione, tipo

**File:** [src/components/projects/blueprint/BlueprintRelationReviewCard.tsx](src/components/projects/blueprint/BlueprintRelationReviewCard.tsx)

Le relazioni hanno card dedicate per:
- Visualizzazione source → target con tipo
- Modifica tipo relazione
- Eliminazione

---

## 9. Blueprint Search

**File:** [src/lib/projects/blueprint-search.ts](src/lib/projects/blueprint-search.ts)

Ricerca full-text client-side (nessun embedding, nessuna API). Esecuzione istantanea nel browser.

**Campi cercati per tipo nodo:**

| Tipo | Campi cercati |
|------|--------------|
| Component | `name`, `description`, `type`, `evidence[].snippet` |
| Data Domain | `name`, `description`, `evidence[].snippet` |
| Integration | `systemName`, `description`, `direction`, `evidence[].snippet` |
| Relation | `type`, `fromNodeId`, `toNodeId` |

**Logica:**
- Substring matching case-insensitive
- Minimo 2 caratteri per attivare
- Score 0–1 basato su posizione del match (nome > descrizione > evidence > tipo)
- Ogni risultato include `graphNodeId` per cross-reference con il grafo React Flow
- Set di `highlightedNodeIds` passato al grafo per highlighting visivo

---

## 10. Quality Score

**File:** [netlify/functions/lib/domain/project/blueprint-quality-score.ts](netlify/functions/lib/domain/project/blueprint-quality-score.ts)

Il quality score è un valore **deterministico** 0–1 calcolato al momento della persistenza. Parte da 1.0 e applica penalità per problemi strutturali.

### 10.1 Penalità

| Penalità | Peso | Condizione |
|----------|------|------------|
| `emptyColumn` | −0.12 | Una colonna (components / dataDomains / integrations) è vuota |
| `tooManyGenericNodes` | −0.08 | Flag `too_many_generic_nodes` presente |
| `coreNodeWithoutEvidence` | −0.06 (per nodo, max −0.12) | Nodo con `businessCriticality: 'high'` senza evidence |
| `missingRelations` | −0.10 | Zero relazioni nel blueprint |
| `majorityUnreviewed` | −0.05 | >50% dei nodi in stato `draft` |
| `dataDomainWithoutOwner` | −0.04 | Flag `data_domain_without_owner_component` |
| `integrationWithoutComponent` | −0.04 | Flag `integration_without_connected_component` |
| `veryLowCoverage` | −0.08 | `coverage < 0.3` |
| `veryLowConfidence` | −0.06 | `confidence < 0.3` |

### 10.2 Verdetti

| Range | Verdetto |
|-------|----------|
| ≥ 0.85 | **excellent** |
| ≥ 0.65 | **good** |
| ≥ 0.45 | **fair** |
| < 0.45 | **poor** |

### 10.3 Tre Metriche Distinte

| Metrica | Fonte | Cosa misura |
|---------|-------|-------------|
| **confidence** | AI (auto-valutazione) | Correttezza dell'estrazione |
| **coverage** | Normalizzazione (euristica) | Ampiezza della copertura architetturale |
| **qualityScore** | `computeBlueprintQualityScore()` | Qualità strutturale post-normalizzazione |

---

## 11. Semantic Diff tra Versioni

**File:** [netlify/functions/lib/domain/project/blueprint-diff.ts](netlify/functions/lib/domain/project/blueprint-diff.ts)

Quando viene creata una nuova versione del blueprint, il sistema calcola automaticamente un diff semantico rispetto alla versione precedente.

### 11.1 Cosa viene confrontato

| Aspetto | Metodo |
|---------|--------|
| **Nodi aggiunti** | ID presente in v(n) ma non in v(n-1) |
| **Nodi rimossi** | ID presente in v(n-1) ma non in v(n) |
| **Nodi aggiornati** | Stesso ID, diversa `description` o `type` |
| **Nodi reclassificati** | Stesso ID, diverso `kind` (es. component → integration) |
| **Relazioni aggiunte/rimosse** | Chiave composita: `fromNodeId→toNodeId→type` |
| **Assunzioni cambiate** | Confronto array ordinato |
| **Missing information cambiata** | Confronto array ordinato |
| **Breaking changes** | Rimozione di nodi core (backend, database, infrastructure) o integrazioni |

### 11.2 Change Summary

`formatChangeSummary(diff)` produce una stringa leggibile:
```
Added: Workflow Engine, SAP Connector | Removed: Legacy API | +2 relation(s) | ⚠ BREAKING architectural changes
```

---

## 12. Utilizzo Downstream: Pipeline di Stima

Il blueprint viene consumato dalla pipeline di stima in **tre modi distinti**.

### 12.1 Blueprint Rules Engine

**File:** [netlify/functions/lib/domain/estimation/blueprint-rules.ts](netlify/functions/lib/domain/estimation/blueprint-rules.ts)

Motore deterministico (nessuna AI) che traduce la struttura del blueprint in biases, driver e rischi per la stima.

**7 regole valutate:**

| # | Regola | Condizione | Effetto |
|---|--------|------------|--------|
| 1 | **Integration complexity** | ≥2 integrazioni `bidirectional` | Boost gruppi INTEGRATION+TESTING, rischio `INTEGRATION_COMPLEXITY_RISK` |
| 2 | **Many integrations** | ≥4 integrazioni totali | Driver `INTEGRATION_EFFORT` |
| 3 | **Data domain richness** | ≥2 high-criticality o ≥4 totali | Boost gruppi DATA+MIGRATION+MODELING |
| 4 | **Workflow+External+Reporting** | Tutti e tre presenti | Rischi `COORDINATION_RISK` + `TIMELINE_RISK` |
| 5 | **Missing database** | Data domains presenti ma nessuna componente database | Rischio `MISSING_DATABASE_RISK` |
| 6 | **Weak evidence** | >50% nodi senza evidence | Reset di tutti i bias (blueprint non affidabile) |
| 7 | **Relation complexity** | ≥2 `orchestrates` o ≥3 `depends_on` | Boost keyword orchestration, rischio `DEPENDENCY_CHAIN_RISK` |
| 8 | **High criticality** | ≥3 nodi con `businessCriticality: 'high'` | Boost testing/validation, driver `QUALITY_ASSURANCE_EFFORT` |

**Output:** `BlueprintRuleResult`
```typescript
{
    activityBiases: {
        boostGroups: string[];      // Es. ['INTEGRATION', 'TESTING']
        boostKeywords: string[];    // Es. ['api', 'integration', 'e2e']
    },
    suggestedDrivers: ProjectContextRuleSuggestion[];
    suggestedRisks: ProjectContextRuleSuggestion[];
    notes: string[];
}
```

### 12.2 Blueprint Context Integration

**File:** [netlify/functions/lib/domain/estimation/blueprint-context-integration.ts](netlify/functions/lib/domain/estimation/blueprint-context-integration.ts)

Merge additivo dei risultati delle blueprint rules con i project context rules. Le blueprint rules **non sovrascrivono** mai le project context rules — si aggiungono. In caso di conflitto su codice driver/rischio, il project context vince.

```
mergeProjectAndBlueprintRules(projectRules, blueprintRules) → ProjectContextRuleResult unificato
```

### 12.3 Blueprint Formatter per Prompt

**File:** [netlify/functions/lib/ai/formatters/project-blueprint-formatter.ts](netlify/functions/lib/ai/formatters/project-blueprint-formatter.ts)

Formatta il blueprint come blocco testuale da iniettare nei prompt di stima dell'AI.

**Budget:** Max 15.000 caratteri totali (`AI_PTB_MAX_CHARS`, configurabile via env).

**Priorità contenuti:**
1. **Blocco strutturato** (sempre incluso): summary, componenti (nome+tipo), integrazioni (nome+direzione), domini dati (nome), note architetturali
2. **SDD** (se disponibile, prioritario): digest strutturato del documento come contesto fattuale
3. **sourceText** (fallback): documento originale troncato a 12.000 chars (`AI_PTB_SOURCE_TEXT_MAX_CHARS`)

**Delimitatori anti-injection:**
- SDD: `<<<PROJECT_DIGEST_START>>>` ... `<<<PROJECT_DIGEST_END>>>`
- Source text: `<<<PROJECT_DOC_START>>>` ... `<<<PROJECT_DOC_END>>>`

L'istruzione default iniettata è:
> *"Questa baseline descrive il progetto esistente. La stima deve riguardare solo il lavoro aggiuntivo del NUOVO requisito, non il progetto già in essere."*

### 12.4 Project Activity Signal Adapter

**File:** [netlify/functions/lib/domain/pipeline/project-activity-signal-adapter.ts](netlify/functions/lib/domain/pipeline/project-activity-signal-adapter.ts)

Converte le project activities (PRJ_*) in segnali per il `CandidateSynthesizer` della pipeline. Le project activities ricevono il peso sorgente massimo (**4.0**) — la priorità più alta nell'intero sistema di candidatura.

**Calcolo score per segnale:**
```
score = confidence (0–1, default 0.7)
      + 0.15 se blueprintNodeName matcha un nodo nel blueprint corrente
→ clamped a [0, 1]
```

**Layer assignment:** Prima usa `blueprintNodeType`, poi fallback su `group`:
| blueprintNodeType | Layer |
|-------------------|-------|
| `component` | frontend |
| `dataDomain` | data |
| `integration` | integration |

| Activity group | Layer |
|---------------|-------|
| `DEV` | logic |
| `TEST` | logic |
| `ANALYSIS` | frontend |
| `OPS` | configuration |
| `GOVERNANCE` | configuration |

---

## 13. Blueprint Activity Mapper

**File:** [netlify/functions/lib/blueprint-activity-mapper.ts](netlify/functions/lib/blueprint-activity-mapper.ts)

Mapper **deterministico** separato dalla generazione AI. Mappa i nodi del blueprint (dell'Estimation Blueprint, non del Project Technical Blueprint) a attività del catalogo standard.

**Attenzione:** Questo mapper opera sull'Estimation Blueprint (livello requisito), non direttamente sul PTB. Tuttavia la logica di mapping per layer/tech è condivisa e il PTB influenza il contesto.

**Flow:**
```
Blueprint.components  → layer/intervention/complexity → activity patterns
Blueprint.integrations → integration activities
Blueprint.dataEntities → data/field activities
Blueprint.testingScope → testing activities
Gap analysis           → selectTopActivities fills remaining slots
```

**Pattern map:** Ogni combinazione (layer, techCategory) → lista di prefissi di codice attività. Es.:
- Power Platform + frontend → `PP_DV_FORM`, `PP_DV_FIELD`, `PP_ANL_ALIGN`
- Backend + logic → `BE_API_SIMPLE`, `BE_API_COMPLEX`, `BE_ANL_ALIGN`
- Frontend + frontend → `FE_UI_COMPONENT`, `FE_FORM`, `FE_ANL_UX`

**Copertura diagnostica:** Il risultato include un `CoverageReport` con:
- Gruppi coperti vs. mancanti
- Componenti non mappati
- Percentuale di copertura
- Rapporto blueprint vs. fallback

---

## 14. Schema Database

**Tabella:** `project_technical_blueprints`  
**Migrazioni:** [supabase/migrations/20260401_project_technical_blueprints.sql](supabase/migrations/20260401_project_technical_blueprints.sql), [supabase/migrations/20260402_blueprint_v2_enrichment.sql](supabase/migrations/20260402_blueprint_v2_enrichment.sql)

### 14.1 Colonne

| Colonna | Tipo | Default | Vincolo | Note |
|---------|------|---------|---------|------|
| `id` | UUID | `gen_random_uuid()` | PK | |
| `project_id` | UUID | — | FK → projects(id) ON DELETE CASCADE | |
| `version` | INTEGER | 1 | NOT NULL | Auto-incrementato dal repository |
| `source_text` | TEXT | NULL | | Documento originale |
| `summary` | TEXT | NULL | | Sintesi AI |
| `components` | JSONB | `'[]'` | NOT NULL | Array di `BlueprintComponent` |
| `data_domains` | JSONB | `'[]'` | NOT NULL | Array di `BlueprintDataDomain` |
| `integrations` | JSONB | `'[]'` | NOT NULL | Array di `BlueprintIntegration` |
| `architectural_notes` | JSONB | `'[]'` | NOT NULL | Array di stringhe |
| `assumptions` | JSONB | `'[]'` | NOT NULL | Array di stringhe |
| `missing_information` | JSONB | `'[]'` | NOT NULL | Array di stringhe |
| `confidence` | NUMERIC | NULL | | 0–1 |
| `relations` | JSONB | NULL | | Array di `BlueprintRelation` (v2) |
| `coverage` | NUMERIC | NULL | CHECK 0–1 | (v2) |
| `quality_flags` | TEXT[] | NULL | | (v2) |
| `quality_score` | NUMERIC | NULL | CHECK 0–1 | (v2) |
| `review_status` | TEXT | NULL | CHECK IN ('draft','reviewed','approved') | (v2) |
| `change_summary` | TEXT | NULL | | (v2) |
| `diff_from_previous` | JSONB | NULL | | `BlueprintDiffSummary` (v2) |
| `structured_digest` | JSONB | NULL | | `StructuredDocumentDigest` (aggiunto in migrazione separata) |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | `now()` | NOT NULL | Trigger auto-update |

### 14.2 Indici

| Indice | Colonne |
|--------|---------|
| `idx_project_technical_blueprints_project_id` | `project_id` |
| `idx_project_technical_blueprints_project_version` | `project_id, version DESC` |

### 14.3 Row Level Security

| Policy | Operazione | Condizione |
|--------|-----------|------------|
| View | SELECT | `project_id` appartiene a un progetto nella org dell'utente |
| Create | INSERT | Utente è admin o editor nella org del progetto |
| Update | UPDATE | Utente è admin o editor nella org del progetto |

---

## 15. Mappa dei File

### Tipi e Dominio

| File | Ruolo |
|------|-------|
| [netlify/functions/lib/domain/project/project-technical-blueprint.types.ts](netlify/functions/lib/domain/project/project-technical-blueprint.types.ts) | Tutti i tipi TypeScript del blueprint (backend) |
| [src/types/project-technical-blueprint.ts](src/types/project-technical-blueprint.ts) | Re-export dei tipi per il frontend |

### Generazione

| File | Ruolo |
|------|-------|
| [netlify/functions/ai-generate-project-from-documentation.ts](netlify/functions/ai-generate-project-from-documentation.ts) | Handler Netlify (auth, validation, catalogs) |
| [netlify/functions/lib/ai/actions/generate-project-from-documentation.ts](netlify/functions/lib/ai/actions/generate-project-from-documentation.ts) | Orchestratore pipeline 3-pass |
| [netlify/functions/lib/ai/prompts/project-from-documentation.ts](netlify/functions/lib/ai/prompts/project-from-documentation.ts) | Prompt e JSON Schema per Pass 1 e Pass 2 |
| [netlify/functions/lib/ai/post-processing/normalize-blueprint.ts](netlify/functions/lib/ai/post-processing/normalize-blueprint.ts) | Normalizzazione deterministica 10-step |

### Persistenza

| File | Ruolo |
|------|-------|
| [src/lib/project-technical-blueprint-repository.ts](src/lib/project-technical-blueprint-repository.ts) | CRUD Supabase + diff + quality score |
| [netlify/functions/lib/domain/project/blueprint-diff.ts](netlify/functions/lib/domain/project/blueprint-diff.ts) | Semantic diff tra versioni |
| [netlify/functions/lib/domain/project/blueprint-quality-score.ts](netlify/functions/lib/domain/project/blueprint-quality-score.ts) | Calcolo quality score deterministico |

### Frontend UI

| File | Ruolo |
|------|-------|
| [src/components/projects/blueprint/ProjectBlueprintTab.tsx](src/components/projects/blueprint/ProjectBlueprintTab.tsx) | Orchestratore: carica + grafo + inspector + search |
| [src/components/projects/blueprint/ProjectBlueprintGraph.tsx](src/components/projects/blueprint/ProjectBlueprintGraph.tsx) | Grafo React Flow a 3 colonne |
| [src/components/projects/blueprint/BlueprintNode.tsx](src/components/projects/blueprint/BlueprintNode.tsx) | Nodo singolo nel grafo |
| [src/components/projects/blueprint/ProjectBlueprintInspector.tsx](src/components/projects/blueprint/ProjectBlueprintInspector.tsx) | Pannello dettagli (overview + node detail) |
| [src/components/projects/blueprint/BlueprintNodeReviewCard.tsx](src/components/projects/blueprint/BlueprintNodeReviewCard.tsx) | Card di review nodo (creation phase) |
| [src/components/projects/blueprint/BlueprintRelationReviewCard.tsx](src/components/projects/blueprint/BlueprintRelationReviewCard.tsx) | Card di review relazione (creation phase) |
| [src/lib/projects/project-blueprint-graph.ts](src/lib/projects/project-blueprint-graph.ts) | Builder modello grafo (layout + adjacency) |
| [src/lib/projects/blueprint-search.ts](src/lib/projects/blueprint-search.ts) | Ricerca full-text client-side |

### Consumer di Creazione

| File | Ruolo |
|------|-------|
| [src/components/projects/CreateProjectFromDocumentation.tsx](src/components/projects/CreateProjectFromDocumentation.tsx) | Wizard creazione da documentazione |
| [src/components/projects/CreateProjectFromSources.tsx](src/components/projects/CreateProjectFromSources.tsx) | Wizard creazione da sorgenti multiple |
| [src/components/projects/EditProjectDialog.tsx](src/components/projects/EditProjectDialog.tsx) | Dialog editing con tab BlueprintTab |

### Downstream Stima

| File | Ruolo |
|------|-------|
| [netlify/functions/lib/domain/estimation/blueprint-rules.ts](netlify/functions/lib/domain/estimation/blueprint-rules.ts) | Regole deterministiche → bias/driver/rischi |
| [netlify/functions/lib/domain/estimation/blueprint-context-integration.ts](netlify/functions/lib/domain/estimation/blueprint-context-integration.ts) | Merge blueprint rules + project context rules |
| [netlify/functions/lib/ai/formatters/project-blueprint-formatter.ts](netlify/functions/lib/ai/formatters/project-blueprint-formatter.ts) | Formatter per prompt stima (budget 15K) |
| [netlify/functions/lib/ai/formatters/project-activities-formatter.ts](netlify/functions/lib/ai/formatters/project-activities-formatter.ts) | Formatter attività PRJ_* per prompt stima |
| [netlify/functions/lib/domain/pipeline/project-activity-signal-adapter.ts](netlify/functions/lib/domain/pipeline/project-activity-signal-adapter.ts) | Attività → segnali (peso 4.0 max) |
| [netlify/functions/lib/blueprint-activity-mapper.ts](netlify/functions/lib/blueprint-activity-mapper.ts) | Mapper deterministico blueprint → attività catalogo |

### Database

| File | Ruolo |
|------|-------|
| [supabase/migrations/20260401_project_technical_blueprints.sql](supabase/migrations/20260401_project_technical_blueprints.sql) | Tabella base + RLS |
| [supabase/migrations/20260402_blueprint_v2_enrichment.sql](supabase/migrations/20260402_blueprint_v2_enrichment.sql) | Colonne v2 (relations, quality, review) |
| [supabase/migrations/20260412_blueprint_structured_digest.sql](supabase/migrations/20260412_blueprint_structured_digest.sql) | Colonna SDD |

---

## 16. Glossario

| Termine | Significato |
|---------|-------------|
| **PTB** | Project Technical Blueprint — l'artefatto documentato qui |
| **SDD** | Structured Document Digest — analisi AI del testo documentale |
| **Evidence** | Citazione testuale dalla documentazione che prova l'esistenza di un nodo |
| **Coverage** | Percentuale di copertura architetturale del blueprint (0–1) |
| **Quality Score** | Score deterministico 0–1 basato su penalità strutturali |
| **Quality Flags** | Flag testuali che segnalano problemi (es. `empty_center_column`) |
| **Normalizzazione** | Pipeline deterministica a 10 step che pulisce il blueprint AI |
| **Review Status** | Stato di curation: draft → reviewed → approved |
| **Blueprint Rules** | Motore deterministico che traduce la struttura in bias di stima |
| **Signal Adapter** | Convertitore attività → segnali per il CandidateSynthesizer |
| **Activity Mapper** | Mapper deterministico blueprint → attività catalogo standard |
| **Estimation Blueprint** | Blueprint a livello requisito (diverso dal PTB a livello progetto) |
| **Pass 1/2/3** | I tre passaggi della pipeline AI di generazione progetto |
