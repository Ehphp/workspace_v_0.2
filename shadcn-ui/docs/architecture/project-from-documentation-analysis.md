# Analisi Funzionale e Architetturale — Flusso "Crea Progetto da Documentazione"

**Data:** 2026-04-13  
**Tipo:** Reverse engineering critica, analisi end-to-end  
**Scope:** Pipeline completa documentazione → progetto + blueprint + attività custom  
**Metodo:** Analisi del codice sorgente come fonte primaria, documentazione come supporto secondario

---

## 1. Executive Summary

Il flusso "Crea Progetto da Documentazione" è una pipeline AI a **tre passaggi sequenziali** che prende un testo documentale grezzo (max 20.000 caratteri) e produce:
1. Un **Project Draft** (metadati progetto) + un **Structured Document Digest (SDD)**
2. Un **Technical Blueprint** (componenti, data domain, integrazioni, relazioni)
3. Un set di **Project Activities custom** (attività PRJ_* calibrate sul progetto)

La pipeline usa `gpt-4o-mini` per Pass 1 e Pass 3, `gpt-5` per Pass 2, con JSON Schema strict mode e validazione Zod server-side. L'output non viene persistito automaticamente: l'utente rivede tutto in una UI di review prima del salvataggio.

### I tre problemi più seri

1. **Trasformazione lossy critica tra Pass 1 e Pass 2 (SDD come collo di bottiglia informativo).**  
   Il Pass 2 (blueprint) NON riceve il documento originale — riceve solo il Structured Document Digest (SDD) prodotto dal Pass 1 con gpt-4o-mini. L'SDD è una compressione drastica (20K chars → ~2-4K JSON) che funge da unica fonte per il blueprint. Qualunque dettaglio funzionale, architetturale o tecnico non catturato nell'SDD è **irreversibilmente perso** per il blueprint e per le attività. Il modello più debole (gpt-4o-mini) decide cosa il modello più forte (gpt-5) vedrà.

2. **Le attività custom (Pass 3) vedono una versione ultra-compressa della realtà.**  
   Pass 3 riceve: (a) un riepilogo testuale dell'SDD, (b) una lista piatta di nomi/tipi dal blueprint normalizzato, (c) il catalogo attività standard in formato compatto. Non vede il documento originale, non vede le evidence, non vede le relazioni, non vede le descrizioni dei componenti blueprint. Il risultato tende a **attività generiche** perché il contesto funzionale di dominio è stato compresso a soli nomi di nodi.

3. **Mancanza di un contratto di coerenza forzato tra blueprint e attività.**  
   Le attività dichiarano `blueprintNodeName` e `blueprintNodeType` come campi opzionali (nullable), ma nessun codice verifica che i riferimenti corrispondano a nodi reali del blueprint. La "tracciabilità" blueprint→attività è puramente nominale — l'AI può inventare nomi di nodi mai generati, e nessun validatore lo impedisce.

---

## 2. Mappa del Flusso End-to-End

```
   ┌───────────────────────────┐
   │  UTENTE: Incolla testo    │  (max 20K caratteri)
   │  documentazione           │
   └────────────┬──────────────┘
                │
   ┌────────────▼──────────────┐
   │ Frontend: Sanitizzazione  │  sanitizeDocumentInput()
   │ + Validazione client-side │  src/types/ai-validation.ts
   └────────────┬──────────────┘
                │ POST /.netlify/functions/ai-generate-project-from-documentation
   ┌────────────▼──────────────┐
   │ Netlify Handler:          │  netlify/functions/ai-generate-project-from-documentation.ts
   │ - Auth check              │
   │ - Body validation         │
   │ - sanitizeDocument()      │  netlify/functions/lib/sanitize.ts
   │ - Caricamento cataloghi   │  Supabase: technologies + activities (limit 60)
   │   da Supabase             │
   └────────────┬──────────────┘
                │
   ┌────────────▼──────────────┐
   │ PASS 1: Project Draft +   │  generate-project-from-documentation.ts
   │ Structured Document       │  Modello: gpt-4o-mini, T=0.2
   │ Digest (SDD)              │  Prompt: PROJECT_DRAFT_SYSTEM_PROMPT
   │                           │  Schema: createProjectDraftResponseSchema()
   │ INPUT: sourceText completo│  Validazione: ProjectDraftSchema (Zod)
   │   + catalogo tecnologie   │
   │ OUTPUT: ProjectDraft +    │  ← TRASFORMAZIONE LOSSY PRIMARIA
   │   StructuredDocumentDigest│
   └────────────┬──────────────┘
                │ (SDD estratto, separato da ProjectDraft)
   ┌────────────▼──────────────┐
   │ PASS 2: Technical         │  generate-project-from-documentation.ts
   │ Blueprint Extraction      │  Modello: gpt-5, T=0.2
   │                           │  Prompt: TECHNICAL_BLUEPRINT_SYSTEM_PROMPT
   │ INPUT: SDD (JSON) +       │  Schema: createTechnicalBlueprintResponseSchema()
   │  metadati Pass 1 +        │  Validazione: TechnicalBlueprintSchema (Zod)
   │  vocab attività catalogo  │
   │ OUTPUT: Blueprint grezzo  │
   └────────────┬──────────────┘
                │
   ┌────────────▼──────────────┐
   │ POST-PROCESSING:          │  normalize-blueprint.ts
   │ normalizeProjectTechnical │  10 step deterministici:
   │ Blueprint()               │  1. Riclassifica componenti→integrazioni
   │                           │  2. Deduplica cross-categoria
   │ DETERMINISTICO            │  3. Deduplica semantica intra-categoria
   │                           │  4. Rimuovi nodi generici
   │                           │  5. Stabilizza node IDs
   │                           │  6. Valida relazioni
   │                           │  7. Consolida evidence
   │                           │  8. Quality flags deterministici
   │                           │  9. Coverage deterministica
   │                           │  10. Validazione strutturale
   └────────────┬──────────────┘
                │
   ┌────────────▼──────────────┐
   │ PASS 3: Project Activities│  generate-project-from-documentation.ts
   │ Generation                │  Modello: gpt-4o-mini, T=0.3
   │                           │  Prompt: PROJECT_ACTIVITIES_SYSTEM_PROMPT
   │ INPUT: digest compatto +  │  Schema: createProjectActivitiesResponseSchema()
   │  metadati + blueprint     │  Validazione: ProjectActivitiesResponseSchema (Zod)
   │  (solo nomi/tipi) +       │
   │  catalogo std compatto    │  NON-BLOCKING: fallisce silenziosamente
   │ OUTPUT: 1-30 attività     │
   │  ProjectActivity[]        │
   └────────────┬──────────────┘
                │ deduplica codici
   ┌────────────▼──────────────┐
   │ RESPONSE: Al frontend     │  { projectDraft, technicalBlueprint,
   │                           │    projectActivities, structuredDigest,
   │                           │    metrics }
   └────────────┬──────────────┘
                │
   ┌────────────▼──────────────┐
   │ Frontend: Review & Edit   │  CreateProjectFromDocumentation.tsx
   │ - Modifica metadati       │  Stato locale React (useState per ogni sezione)
   │ - Modifica blueprint      │  CRUD su components, dataDomains, integrations
   │ - Toggle/modifica attività│  Toggle enable/disable, edit inline
   └────────────┬──────────────┘
                │ handleSave()
   ┌────────────▼──────────────┐
   │ PERSISTENZA (3 step):     │
   │ 1. createProject() →      │  src/lib/api.ts → Supabase projects
   │    Supabase projects      │
   │ 2. createProjectTechnical │  src/lib/project-technical-blueprint-repository.ts
   │    Blueprint() → Supabase │  → project_technical_blueprints (v1)
   │    + diff + qualityScore  │  + blueprint-diff.ts + blueprint-quality-score.ts
   │ 3. createProjectActivities│  src/lib/project-activity-repository.ts
   │    () → Supabase bulk     │  → project_activities (solo enabled)
   └───────────────────────────┘
```

### Tabella riassuntiva dei passaggi

| Step | File principale | Deterministico? | Rischio perdita info | Input | Output |
|------|----------------|-----------------|---------------------|-------|--------|
| Sanitizzazione FE | `src/types/ai-validation.ts` | Sì | **Medio** — rimuove `{}` e `<>` | Testo raw | Testo sanitizzato |
| Sanitizzazione BE | `netlify/functions/lib/sanitize.ts` | Sì | **Medio** — stessa logica | Testo sanitizzato | Testo ri-sanitizzato |
| Caricamento cataloghi | Handler netlify | Sì | Basso | DB query | Array tech + activities |
| Pass 1 (Draft + SDD) | `generate-project-from-documentation.ts` | **No (AI)** | **ALTO** — compressione lossy | Testo completo | ProjectDraft + SDD |
| Pass 2 (Blueprint) | `generate-project-from-documentation.ts` | **No (AI)** | **MEDIO-ALTO** — opera su SDD, non documento | SDD + metadati | Blueprint grezzo |
| Normalizzazione | `normalize-blueprint.ts` | Sì | **Basso-Medio** — rimuove nodi | Blueprint grezzo | Blueprint normalizzato |
| Pass 3 (Attività) | `generate-project-from-documentation.ts` | **No (AI)** | **ALTO** — contesto ultra-compresso | Digest + blueprint piatto | GeneratedProjectActivity[] |
| Review utente | `CreateProjectFromDocumentation.tsx` | N/A (umano) | Basso | Output AI | Output rivisto |
| Persistenza | 3 repository | Sì | Basso | Output rivisto | 3 tabelle Supabase |

---

## 3. Analisi Dettagliata della Generazione Blueprint

### 3.1 Entry Point e Catena di Chiamata

```
CreateProjectFromDocumentation.tsx
  → handleGenerate()
    → generateProjectFromDocumentation() [src/lib/project-documentation-api.ts]
      → POST ai-generate-project-from-documentation [netlify handler]
        → generateProjectFromDocumentation() [netlify/functions/lib/ai/actions/generate-project-from-documentation.ts]
          → Pass 1: gpt-4o-mini → ProjectDraft + SDD
          → Pass 2: gpt-5 → Blueprint grezzo
          → normalizeProjectTechnicalBlueprint() [normalize-blueprint.ts]
          → Pass 3: gpt-4o-mini → ProjectActivities
```

### 3.2 Pass 1 — Project Draft + SDD

**File:** [netlify/functions/lib/ai/actions/generate-project-from-documentation.ts](netlify/functions/lib/ai/actions/generate-project-from-documentation.ts)  
**Prompt:** [netlify/functions/lib/ai/prompts/project-from-documentation.ts](netlify/functions/lib/ai/prompts/project-from-documentation.ts) → `PROJECT_DRAFT_SYSTEM_PROMPT`  
**Modello:** `gpt-4o-mini`, temperatura 0.2, maxTokens 4000  
**Schema:** `createProjectDraftResponseSchema()` — JSON Schema strict mode  
**Validazione:** `ProjectDraftSchema` Zod

**Input:** Testo documentale completo (fino a 20K chars) + catalogo tecnologie (opzionale)

**Output:** Oggetto unico che contiene:
- **Part A** — Metadati progetto: name, description, owner, technologyId, projectType, domain, scope, teamSize, deadlinePressure, methodology, confidence, assumptions, missingFields, reasoning
- **Part B** — StructuredDocumentDigest (SDD): functionalAreas[], businessEntities[], externalSystems[], technicalConstraints[], nonFunctionalRequirements[], keyPassages[], ambiguities[], documentQuality

**Valutazione critica:**

| Aspetto | Valutazione | Note |
|---------|-------------|------|
| Schema enforcement | ✅ Buono | JSON Schema strict + Zod validation |
| Copertura documento | ⚠️ Fragile | SDD è l'unica fonte per Pass 2, cattura max ~8 functional areas, ~20 entities, ~15 key passages |
| keyPassages VERBATIM | ⚠️ Non verificabile | Il prompt dice "copia esattamente" ma nessun codice verifica che siano citazioni reali |
| Affidabilità technologyId | ⚠️ Debole | L'AI deve mappare testo libero → UUID del catalogo, errore probabile |
| maxTokens 4000 | ⚠️ Potenzialmente insufficiente | Per documenti ricchi, SDD + metadati in 4000 token potrebbe troncare |

### 3.3 Pass 2 — Technical Blueprint

**Prompt:** `TECHNICAL_BLUEPRINT_SYSTEM_PROMPT`  
**Modello:** `gpt-5`, temperatura 0.2, maxTokens 8000  
**Input critico:** `JSON.stringify(structuredDigest, null, 2)` — il SDD serializzato come JSON, **NON** il documento originale

**Costruzione del prompt Pass 2:**
```
DIGEST STRUTTURATO DEL DOCUMENTO:
{SDD as JSON}

METADATI PROGETTO ESTRATTI (dal pass precedente):
- Nome: ...
- Descrizione: ...
- Tipo: ...
- Dominio: ...
- Scope: ...
- Metodologia: ...
- Tecnologia primaria: {risolto da technologyId}

CATALOGO ATTIVITÀ DISPONIBILI (terminologia):
  ANALYSIS: Allineamento requisiti, Analisi UX, ...
  DEV: Campo Dataverse, Form, ...
```

**Output:** `TechnicalBlueprintSchema` validato con Zod:
- summary, components[] (max 10), dataDomains[] (max 20), integrations[] (max 15)
- relations[] (max 20), coverage, qualityFlags[], architecturalNotes[], assumptions[], missingInformation[], confidence

**Campi affidabili vs fragili:**

| Campo | Affidabilità | Uso downstream | Note |
|-------|-------------|----------------|------|
| components[].name | Media-Alta | Blueprint UI, attività | Qualità dipende da SDD |
| components[].type | Media | Blueprint UI, regole deterministiche | Rischio di tipo generico se tech non chiara |
| components[].evidence[] | **Bassa** | UI, quality score | Dovrebbe venire dai keyPassages SDD, ma non verificato |
| dataDomains[].name | Media | Blueprint UI, attività | Dipende da businessEntities dell'SDD |
| integrations[].direction | Media-Bassa | Blueprint rules, reclassificazione | Spesso "unknown" |
| relations[] | **Bassa** | Blueprint graph UI, quality score | Il prompt dice "non inventare" ma è il campo più speculativo |
| coverage | **Bassa** | Quality score | Auto-valutazione AI, non verificabile |
| qualityFlags[] | Media | Quality score | Utili ma potenzialmente incompleti |
| confidence | **Bassa** | Quality score, UI badge | Auto-valutazione AI |

### 3.4 Post-Processing Deterministico (Normalizzazione)

**File:** [netlify/functions/lib/ai/post-processing/normalize-blueprint.ts](netlify/functions/lib/ai/post-processing/normalize-blueprint.ts)  
**Tipo:** Completamente deterministico, nessuna AI

10 step sequenziali:

1. **Reclassificazione componenti→integrazioni:** Se il tipo è `integration`/`external_system`/`custom_connector` O il nome matcha pattern esterni noti (Outlook, SAP, Stripe, ecc.), il componente viene spostato in integrazioni. **Confermato dal codice.** Lista di pattern in `KNOWN_EXTERNAL_PATTERNS`.

2. **Deduplica cross-categoria:** Se lo stesso nome appare in più categorie, rimuove il duplicato dalla categoria meno appropriata.

3. **Deduplica semantica intra-categoria:** Confronto nomi normalizzati, rimuove duplicati all'interno della stessa categoria.

4. **Rimozione nodi generici:** Nomi come "Database", "API", "Sistema" vengono rimossi. **Rischio:** può rimuovere nodi legittimi il cui nome è genuinamente generico per il dominio.

5. **Stabilizzazione IDs:** Genera IDs deterministici `cmp_`, `dom_`, `int_` + slug del nome.

6. **Validazione relazioni:** Relazioni con `fromNodeId`/`toNodeId` che non corrispondono a nodi validi vengono rimosse. Tenta risoluzione per nome prima di eliminare.

7. **Consolidazione evidence:** Trunca snippet a 200 chars, deduplica evidence identiche.

8. **Quality flags deterministici:** Aggiunge flag basati su struttura (empty columns, generic nodes, weak evidence, ecc.).

9. **Coverage deterministica:** Ricalcola coverage basandosi sul numero di nodi e relazioni.

10. **Warning strutturali:** Log di warning per blueprint sbilanciati o vuoti.

**Valutazione:** Questa fase è la più solida dell'intera pipeline. Ogni step è testabile e deterministico. Il rischio principale è che la rimozione di nodi generici (step 4) possa essere troppo aggressiva.

### 3.5 Persistenza Blueprint

**File:** [src/lib/project-technical-blueprint-repository.ts](src/lib/project-technical-blueprint-repository.ts)  
**Tabella:** `project_technical_blueprints`  
**Formato:** JSONB per components, data_domains, integrations, relations, structured_digest. TEXT per source_text, summary.

Al salvataggio:
1. Determina versione successiva (autoincremento)
2. Se esiste versione precedente, calcola diff semantico (`blueprint-diff.ts`)
3. Calcola quality score deterministico (`blueprint-quality-score.ts`)
4. Persiste tutto in un singolo INSERT

**Campi non persistiti dal frontend che vengono aggiunti:** qualityScore, diffFromPrevious, changeSummary.

### 3.6 Uso Downstream del Blueprint

Il blueprint è usato downstream in due contesti principali:

1. **Estimation pipeline** (tramite `blueprint-rules.ts` + `blueprint-context-integration.ts`):
   - Regole deterministiche che leggono integrations, dataDomains, relations
   - Producono bias (boostGroups, boostKeywords), driver suggeriti, rischi suggeriti
   - Merge con project-context-rules

2. **Blueprint formatter** (`project-blueprint-formatter.ts`):
   - Inietta un blocco testuale di baseline architetturale nelle prompt di stima
   - Prioritizza SDD su sourceText quando disponibile
   - Budget di 15K chars totali con logica di truncation

3. **Project Activity Signal Adapter** (`project-activity-signal-adapter.ts`):
   - Converte attività progetto in segnali per CandidateSynthesizer
   - Peso massimo (4.0) — la priorità più alta nella pipeline di candidatura

**Osservazione critica:** Il blueprint è effettivamente usato downstream, ma in modo selettivo. Le relazioni (`relations`) alimentano solo il quality score e la UI del grafo — non influenzano direttamente la generazione attività né le stime. Le evidence sono usate solo per quality scoring. I campi realmente influenti downstream sono: `components[].name/type`, `integrations[].systemName/direction`, `dataDomains[].name`.

---

## 4. Analisi Dettagliata della Generazione Attività Custom

### 4.1 Entry Point e Catena

La generazione attività è il **Pass 3** della stessa funzione `generateProjectFromDocumentation()`.

**File:** [netlify/functions/lib/ai/actions/generate-project-from-documentation.ts](netlify/functions/lib/ai/actions/generate-project-from-documentation.ts) (linee ~400-470)  
**Prompt:** [netlify/functions/lib/ai/prompts/project-activities-generation.ts](netlify/functions/lib/ai/prompts/project-activities-generation.ts) → `PROJECT_ACTIVITIES_SYSTEM_PROMPT`  
**Modello:** `gpt-4o-mini`, temperatura 0.3, maxTokens 3000  
**Schema:** `createProjectActivitiesResponseSchema()` strict  
**Validazione:** `ProjectActivitiesResponseSchema` Zod  
**Gestione errore:** **NON-BLOCKING** — se Pass 3 fallisce, ritorna `[]`

### 4.2 Da Dove Viene il Contesto per le Attività

Il prompt utente per Pass 3 viene costruito assemblando:

```
CONTESTO DOCUMENTO (dal digest strutturato):
  AREE FUNZIONALI:
    - {title}: {description}          ← dall'SDD
  ENTITÀ DI BUSINESS:
    - {name}: {role}                  ← dall'SDD
  SISTEMI ESTERNI:
    - {name}: {interactionDescription}← dall'SDD
  VINCOLI TECNICI: ...                ← dall'SDD
  REQUISITI NON FUNZIONALI: ...       ← dall'SDD

METADATI PROGETTO:
  - Nome: ...
  - Descrizione: ...
  - Tipo progetto: ...
  - Tecnologia: ...

BLUEPRINT TECNICO:
  COMPONENTS:
    - {name} ({type})                 ← SOLO nome e tipo!
  DATA DOMAINS:
    - {name}                          ← SOLO nome!
  INTEGRATIONS:
    - {systemName} ({direction})      ← SOLO nome e direzione!

CATALOGO ATTIVITÀ STANDARD (riferimento scala effort):
  ANALYSIS: ACT_CODE (Xh), ...
  DEV: ACT_CODE (Xh), ...
```

### 4.3 Valutazione Critica della Generazione

| Aspetto | Valutazione | Severità |
|---------|-------------|----------|
| **Il blueprint arriva ultracompresso** | Solo nomi e tipi, senza descrizioni, evidence, relazioni, confidence | **Alta** |
| **Il documento originale non è accessibile** | Pass 3 vede solo l'SDD riformattato come testo piatto | **Alta** |
| **Catalogo standard come scala, non obiettivo** | Impostazione corretta — il prompt è chiaro nel dire "non copiare" | Buona |
| **Copertura blueprint forzata** | Il prompt dice "ogni componente DEVE avere almeno 1 attività" ma nessun codice lo verifica | **Media** |
| **Deduplica codici** | Post-validazione: `seenCodes` set, mantiene prima occorrenza | Buona |
| **Validazione Zod rigorosa** | Regex `PRJ_*`, range effort 0.125-40, gruppi enum, confidence 0-1 | Buona |
| **Fallback silenzioso** | Se Pass 3 fallisce → `projectActivities = []` senza errore utente | **Media** |
| **Tracciabilità blueprint** | `blueprintNodeName` nullable, mai validato contro nodi reali | **Alta** |
| **maxTokens 3000** | Per 30 attività complesse, può essere insufficiente | **Media** |

### 4.4 Provenienza dei Segnali per le Attività

```
DOCUMENTO ORIGINALE
       │
       ▼ (Pass 1 — gpt-4o-mini)
   [SDD: functionalAreas, businessEntities, externalSystems]
       │
       ├──▶ SDD riformattato come testo → Pass 3
       │
       ▼ (Pass 2 — gpt-5)
   [Blueprint: components, dataDomains, integrations]
       │
       └──▶ Solo nomi+tipi come testo → Pass 3
   
   [Catalogo standard: code + base_hours raggruppati] → Pass 3
   [Metadati progetto: nome, tipo, dominio, scope, tech] → Pass 3
```

**Conclusione:** Le attività custom sono generate in un contesto impoverito rispetto al documento originale. L'informazione passa attraverso due successive compressioni lossy (doc→SDD, SDD→blueprint_nomi) prima di raggiungere il Pass 3.

### 4.5 Rischi Specifici

1. **Genericità:** Senza le descrizioni dei componenti blueprint né il testo originale, le attività tendono a essere varianti di "Sviluppo {nome_componente}" piuttosto che deliverable specifici.

2. **Duplicazione con catalogo:** Nonostante il prompt dica "NON copiare", senza un codice che verifichi la non-sovrapposizione, attività come "PRJ_UNIT_TEST" e il catalogo "BE_UNIT_TEST" possono duplicare lo scope.

3. **Drift dal documento:** Nella catena doc→SDD→blueprint→attività, ogni passaggio reinterpreta il dato. Un requisito funzionale specifico (es. "integrazione con SAP per importare ordini d'acquisto in tempo reale") può diventare un'attività generica come "PRJ_API_SAP" perché la specificità del testo originale non sopravvive fino al Pass 3.

4. **Confidenza senza foundation:** `confidence: 0-1` per ogni attività è auto-assegnata dall'AI. Non c'è baseline né calibrazione.

---

## 5. Data Contracts e Trasformazioni

### 5.1 Mappa delle Trasformazioni

| # | Da | A | Tipo | Reversibile? | Cosa si perde |
|---|-----|---|------|-------------|---------------|
| T1 | Testo raw utente | Testo sanitizzato FE | Deterministico | **No** | Caratteri `<>{}`, control chars |
| T2 | Testo sanitizzato FE | Testo sanitizzato BE | Deterministico | **No** | Stessa logica — doppia sanitizzazione |
| T3 | Testo sanitizzato → Pass 1 | ProjectDraft + SDD (JSON) | **AI** | **No** | **TUTTO ciò che SDD non cattura**: specificità funzionali, flussi dettagliati, edge case, requisiti secondari, formattazione originale, contesto implicito |
| T4 | SDD (JSON) → Pass 2 | Blueprint grezzo (JSON) | **AI** | **No** | Dettagli che non mappano su componenti architetturali: requisiti UX, logica di business fine, vincoli temporali, priorità |
| T5 | Blueprint grezzo → normalizzato | Blueprint normalizzato (JSON) | Deterministico | Parzialmente | Nodi generici rimossi, nodi reclassificati, duplicati eliminati |
| T6 | Blueprint normalizzato → Pass 3 | Testo piatto (nomi + tipi) | **Formattazione** | **No** | **Descrizioni**, evidence, confidence, relazioni, coverage, quality flags, architectural notes |
| T7 | SDD → Pass 3 | Testo piatto (titoli+desc) | **Formattazione** | **No** | keyPassages, ambiguità, documentQuality |
| T8 | Pass 3 output → attività validate | GeneratedProjectActivity[] | Deterministico (Zod) | Sì | Solo attività malformate |
| T9 | Attività validate → DB | project_activities rows | Deterministico (mapping) | Sì (row→domain) | Nulla — mapping 1:1 |
| T10 | Blueprint frontend → DB | project_technical_blueprints row | Deterministico | Sì (row→domain) | Nulla + aggiunta qualityScore, diff |

### 5.2 Criticità Specifiche delle Trasformazioni

**T1/T2 — Doppia sanitizzazione:**
Il frontend chiama `sanitizeDocumentInput()` da `src/types/ai-validation.ts`, poi il backend chiama `ctx.sanitizeDocument()` (che usa `sanitizeDocumentInput()` da `netlify/functions/lib/sanitize.ts`). Stessa logica duplicata in due file indipendenti. Rischio: drift tra le due implementazioni, e la rimozione di `{}` può corrompere documentazione che contiene legittimamente JSON o pseudo-codice.

**T3 — La compressione più critica:**
Un documento di 20K caratteri viene compresso in un SDD con:
- Max 10 functional areas × (200 title + 500 desc + 5×300 passages) ≈ ~20K chars teorici
- Ma con maxTokens 4000 (~3000 chars di JSON output), l'SDD reale è molto più compatto
- keyPassages globali: max 20 × (100 label + 300 text) = max ~8K chars teorici

**T6 — La compressione che uccide le attività:**
Il blueprint normalizzato ha descrizioni, evidence, relazioni, meta-informazioni. Il pass3UserPrompt li riduce a:
```
COMPONENTS:
  - Frontend App (frontend)
  - Workflow Engine (workflow)
DATA DOMAINS:
  - Ordini
  - Fatture
INTEGRATIONS:
  - SAP (bidirectional)
```
Tutta la ricchezza semantica del blueprint è persa per la generazione attività.

### 5.3 Mismatch tra Tipi TypeScript, Schema Runtime, Prompt e Persistenza DB

| Campo | TS Type (backend) | Zod Schema | JSON Schema (prompt) | DB Column | Mismatch? |
|-------|-------------------|------------|---------------------|-----------|-----------|
| `components[].type` | `BlueprintComponentType` (30 valori) | `ComponentTypeEnum` (30 valori) | `enum` (30 valori) | JSONB (nessun vincolo) | ⚠️ **DB non valida il type** |
| `integrations[].direction` | `IntegrationDirection \| undefined` | `.nullable().optional()` | `['string', 'null']` | JSONB | ⚠️ **Mismatch null/undefined** |
| `projectActivities[].blueprintNodeType` | `BlueprintNodeType \| null` | `.nullable()` | `['string', 'null']` | `VARCHAR(30) CHECK` | ✅ DB valida |
| `coverage` | `number \| undefined` | `.optional()` | `{ type: 'number' }` (required) | `NUMERIC CHECK 0-1` | ✅ Coerente |
| `qualityFlags` | `string[] \| undefined` | `.optional().default([])` | `{ type: 'array' }` | `TEXT[]` | ✅ Coerente |
| `projectActivities[].smMultiplier` | `number` (domain) | **Non in schema AI** | **Non in schema AI** | `DECIMAL DEFAULT 0.50` | ⚠️ **AI non genera, default DB** |
| `projectActivities[].lgMultiplier` | `number` (domain) | **Non in schema AI** | **Non in schema AI** | `DECIMAL DEFAULT 2.00` | ⚠️ **AI non genera, default DB** |

**Osservazione critica per sm/lgMultiplier:** L'AI genera `baseHours` e `effortModifier`, ma `smMultiplier` e `lgMultiplier` (varianti small/large) non sono nello schema AI. Vengono impostati a default (`0.50` / `2.00`) nel repository layer. Se questi moltiplicatori dovessero variare per attività, il sistema non ha modo di generarli.

---

## 6. Colli di Bottiglia e Criticità Architetturali

### Criticità ALTA

#### C1 — SDD come single point of failure informativo
**Descrizione:** Il Pass 1 (gpt-4o-mini) produce l'SDD che è l'UNICA fonte per Pass 2 e, indirettamente, per Pass 3. Se l'SDD omette informazioni architetturali critiche, il blueprint e le attività saranno necessariamente incompleti.  
**Impatto funzionale:** Blueprint incompleto → attività incomplete → stima sottodimensionata  
**Impatto tecnico:** Non recuperabile — nessun fallback al documento originale per Pass 2  
**File:** `generate-project-from-documentation.ts` (linee ~290-320)  
**Causa probabile:** Scelta architetturale di usare SDD per mantenere il Pass 2 indipendente dal formato/lunghezza del documento originale  
**Sintomo visibile:** Blueprint con pochi componenti per documenti ricchi; SDD che copre solo le prime sezioni del documento  

#### C2 — Pass 3 opera su contesto impoverito
**Descrizione:** Le attività vengono generate avendo solo nomi/tipi blueprint senza descrizioni, e un digest piatto senza keyPassages. La ricchezza del documento originale è compressa 3 volte.  
**Impatto funzionale:** Attività generiche, poco ancorate al dominio specifico  
**Impatto tecnico:** Impossibile arricchire a posteriori senza rieseguire la pipeline  
**File:** `generate-project-from-documentation.ts` (linee ~420-460)  
**Causa probabile:** Ottimizzazione budget token per Pass 3  
**Sintomo visibile:** Attività con nomi come "PRJ_DEV_MODULE_1" anziché "PRJ_IMPORT_ORDINI_SAP"

#### C3 — Tracciabilità blueprint→attività non enforced
**Descrizione:** `blueprintNodeName` e `blueprintNodeType` nelle attività sono nullable e mai validati. L'AI può dichiarare un'attività ancorata a "Modulo Pagamenti" quando il blueprint non ha nessun nodo con quel nome.  
**Impatto funzionale:** La promessa di tracciabilità blueprint→attività è vuota  
**Impatto tecnico:** Nessun vincolo referenziale runtime o DB  
**File:** `generate-project-from-documentation.ts` (validation), `project-activities-generation.ts` (prompt)  
**Causa probabile:** Complessità di validazione cross-artefatto, non implementata  
**Sintomo visibile:** Hover su attività che mostra "ancorata a X" dove X non esiste nel blueprint

#### C4 — Pass 3 fallisce silenziosamente
**Descrizione:** Se Pass 3 (attività) fallisce per qualunque ragione (timeout, JSON malformato, validation error), il sistema ritorna `projectActivities: []` senza alcun segnale all'utente.  
**Impatto funzionale:** L'utente vede una sezione attività vuota senza capire perché  
**Impatto tecnico:** Nessun retry, nessun fallback, nessun warning visibile  
**File:** `generate-project-from-documentation.ts` (try/catch attorno a Pass 3)  
**Causa probabile:** Design "non-blocking" per non far fallire l'intero flusso  
**Sintomo visibile:** Tab "Attività" vuota dopo generazione apparentemente riuscita

### Criticità MEDIA

#### C5 — Doppia sanitizzazione con rimozione di delimitatori JSON
**Descrizione:** `sanitizeDocumentInput()` rimuove `{` e `}` dal testo documentale. Se la documentazione contiene frammenti di codice, JSON di esempio, o pseudo-codice, questi vengono corrotti prima ancora di raggiungere l'AI.  
**Impatto funzionale:** Perdita di informazioni tecniche rilevanti per documenti tecnici  
**Impatto tecnico:** Irrecuperabile — avviene prima del Pass 1  
**File:** `src/types/ai-validation.ts`, `netlify/functions/lib/sanitize.ts`  
**Causa probabile:** Protezione anti-injection prompt  
**Sintomo visibile:** Blueprint che non cattura dettagli da frammenti di codice

#### C6 — maxTokens 4000 per Pass 1 è potenzialmente insufficiente
**Descrizione:** Per un documento di 20K chars, il Pass 1 deve produrre sia metadati progetto (~500 token) sia SDD completo (~2500+ token). Con 4000 maxTokens, l'output può essere troncato.  
**Impatto funzionale:** SDD incompleto → blueprint incompleto  
**Impatto tecnico:** JSON troncato → parsing failure → eccezione hard  
**File:** `generate-project-from-documentation.ts` (Pass 1 generateContent call)  
**Causa probabile:** Ottimizzazione costo/latenza  
**Sintomo visibile:** "LLM returned invalid JSON for project draft extraction"

#### C7 — Catalogo attività limitato a 60 entries
**Descrizione:** Il handler carica max 60 attività dal catalogo standard per il prompt. Se il catalogo è più ampio, le attività non incluse non influenzeranno né il vocabolario del blueprint né il calibro delle attività custom.  
**Impatto funzionale:** Perdita di contesto per domini con molte attività specifiche  
**Impatto tecnico:** Query con `LIMIT 60` in `ai-generate-project-from-documentation.ts`  
**File:** `netlify/functions/ai-generate-project-from-documentation.ts` (linea ~88)  
**Causa probabile:** Budget token del prompt  
**Sintomo visibile:** Attività custom che non referenziano attività catalogo fuori dal top-60

#### C8 — Nessun meccanismo di re-generazione parziale
**Descrizione:** Se l'utente vuole rigenerare solo le attività (es. dopo aver modificato il blueprint in review), deve ripartire dall'inizio. L'intero flusso è monolitico.  
**Impatto funzionale:** Frizione nell'iterazione: ogni modifica richiede riesecuzione completa  
**Impatto tecnico:** 3 chiamate AI sequenziali, ~30-60 secondi  
**File:** `CreateProjectFromDocumentation.tsx` (handleGenerate)  
**Causa probabile:** Flow progettato come one-shot, non iterativo  
**Sintomo visibile:** Nessun pulsante "Rigenera solo attività" nella UI

### Criticità BASSA

#### C9 — Quality flags e coverage sono metriche decorative
**Descrizione:** `qualityFlags`, `coverage`, `qualityScore` vengono calcolati ma non influenzano decisioni a valle. Un blueprint con score 0.3 viene usato esattamente come uno con score 0.9.  
**Impatto funzionale:** Nessun gating — l'utente non è avvertito in modo actionable  
**Impatto tecnico:** Nessuna logica di branching basata su quality  
**File:** `blueprint-quality-score.ts`, `normalize-blueprint.ts`  
**Causa probabile:** Score introdotto in v2, non ancora integrato in logica decisionale  
**Sintomo visibile:** Badge "Confidence: 40%" senza conseguenze

#### C10 — Relazioni blueprint usate solo per UI e quality
**Descrizione:** Le `relations[]` del blueprint alimentano il grafo visuale e il quality score, ma non influenzano la generazione attività, né il blueprint-rules engine per stima, né il candidate synthesizer.  
**Impatto funzionale:** Informazione architetturale ricca ma sottoutilizzata  
**Impatto tecnico:** Struttura dati presente ma non consumata  
**File:** `blueprint-rules.ts`, `project-activity-signal-adapter.ts`  
**Causa probabile:** Feature aggiunta in v2, downstream non ancora aggiornato

---

## 7. Perdite di Informazione

| # | Passaggio | Dato perso | Effetto downstream | Severità |
|---|-----------|------------|-------------------|----------|
| P1 | Sanitizzazione (T1/T2) | Frammenti codice con `{}`, tag XML-like con `<>` | Blueprint non cattura dettagli tecnici da snippet di codice | **Media** |
| P2 | Doc → SDD (T3) | Requisiti funzionali secondari, edge case, note a piè di pagina, allegati testuali | Blueprint non copre il 100% del perimetro funzionale | **Alta** |
| P3 | Doc → SDD (T3) | Flussi utente dettagliati, step-by-step, diagrammi ASCII inline | Componenti blueprint senza comprensione del ciclo di vita | **Alta** |
| P4 | Doc → SDD (T3) | Nomenclatura specifica del cliente/progetto | SDD può parafrasare/normalizzare nomi → mismatch nomenclatura utente vs sistema | **Media** |
| P5 | SDD → Blueprint (T4) | Granularità dei data domain (campi, vincoli, relazioni tra entità) | dataDomains troppo generici (es. "Ordini" senza specificare "Ordini d'Acquisto" vs "Ordini di Vendita") | **Media** |
| P6 | Blueprint → Pass 3 (T6) | **Descrizioni** componenti, evidence, relazioni, architectural notes | Attività ancorate a nomi senza contesto funzionale | **Alta** |
| P7 | Blueprint → Pass 3 (T6) | **Quality signals** (confidence, coverage) per componente | Pass 3 non può calibrare effort sui componenti meno certi | **Media** |
| P8 | SDD → Pass 3 (T7) | **keyPassages** verbatim, ambiguities, documentQuality | Pass 3 non ha accesso alle citazioni originali per calibrare le attività | **Alta** |
| P9 | Review utente → Save | Modifiche utente al blueprint NON ri-generano le attività | Attività disallineate dal blueprint modificato | **Media** |
| P10 | Tutto il flusso | Formattazione originale del documento (sezioni, titoli, liste numerate) | La struttura documentale perde significato topologico | **Media-Bassa** |

---

## 8. Coerenza tra Blueprint e Attività Custom

### 8.1 Meccanismo di legame attuale

Il legame è **solo nominale**: il prompt di Pass 3 dice "ogni componente del blueprint DEVE avere almeno 1 attività" e "blueprintNodeName deve essere il nome del nodo". Ma:

1. **Nessun codice verifica la copertura.** Dopo la generazione, non c'è check che ogni componente blueprint abbia almeno un'attività con `blueprintNodeName` corrispondente.

2. **Nessun codice valida i riferimenti.** `blueprintNodeName` può contenere un valore inventato dall'AI che non corrisponde a nessun nodo del blueprint normalizzato.

3. **Nessun codice verifica la coerenza dei tipi.** Un'attività con `blueprintNodeType: 'integration'` potrebbe referenziare un nome che nel blueprint è un componente.

### 8.2 Valutazione per area

| Area blueprint | Riflesso nelle attività? | Qualità del legame |
|----------------|------------------------|--------------------|
| Components | Parziale — il prompt lo richiede | ⚠️ Solo per nome, senza contesto |
| DataDomains | Debole — il prompt dice "DOVREBBE" | ⚠️ Opzionale, spesso ignorato per domini non evidenti |
| Integrations | Debole — il prompt dice "DOVREBBE" | ⚠️ Se l'integrazione è generica nel blueprint, l'attività lo sarà ancora di più |
| Relations | **Nessuno** — non passate a Pass 3 | ❌ Relazioni non influenzano attività |
| Assumptions | **Nessuno** — non passate a Pass 3 | ❌ Assunzioni non generano attività correlate |
| MissingInformation | **Nessuno** — non passate a Pass 3 | ❌ Lacune non producono attività di discovery/analisi |
| ArchitecturalNotes | **Nessuno** — non passate a Pass 3 | ❌ Note architetturali non influenzano le attività |
| TestingScope | **N/A** — non esiste nel Project Technical Blueprint | ❌ Il blueprint di progetto non ha testingScope (presente solo nell'Estimation Blueprint) |

### 8.3 Conclusione

Il legame blueprint→attività è **strutturalmente debole**. Il blueprint è ricco di informazioni (relazioni, evidence, notes, assumptions, coverage, quality) ma il Pass 3 ne vede solo ~5% (nomi + tipi). La promessa di tracciabilità (`blueprintNodeName`) non è enforced.

---

## 9. Source of Truth Analysis

### 9.1 Qual è la vera source of truth?

```
DOCUMENTO ORIGINALE (sourceText)
       │
       ├─ è la vera SoT per il contenuto funzionale
       │  ma NON è direttamente consultato dopo Pass 1
       │
       ▼
SDD (Structured Document Digest)
       │
       ├─ è la SoT de facto per il blueprint (Pass 2)
       │  ma è una compressione lossy prodotta da gpt-4o-mini
       │
       ▼
BLUEPRINT (normalizzato)
       │
       ├─ DOVREBBE essere la SoT per la struttura architetturale
       │  MA: le attività non lo consultano integralmente
       │  MA: downstream usa solo un sottoinsieme di campi
       │
       ▼
PROJECT ACTIVITIES
       │
       └─ L'artefatto con il maggior impatto pratico sulla stima
          MA: derivato da contesto impoverito
```

### 9.2 Il blueprint è davvero source of truth?

**No, in senso stretto.** Il blueprint è:
- **SoT per la visualizzazione architetturale** (grafo a 3 colonne, inspector UI) ✅
- **Consultivo per le regole di stima** (blueprint-rules produce bias, non vincoli hard) ⚠️
- **Non-SoT per le attività custom** (Pass 3 vede una proiezione piatta dei nomi) ❌
- **Non-SoT per il formatter di prompt downstream** (il formatter privilegia SDD su blueprint) ⚠️

### 9.3 Chi guida davvero l'output finale?

L'output finale (stima) è guidato da:

1. **Project Activities** → Segnali con peso 4.0 nel CandidateSynthesizer (massima priorità)
2. **Blueprint rules** → Bias su gruppi e keyword (influenza indiretta)
3. **Blueprint formatter** → Blocco testuale iniettato nei prompt di stima (contesto)
4. **Catalogo standard + keyword matching** → Gap-filling dopo blueprint

Le attività custom hanno il peso pratico più alto, ma sono l'artefatto generato con il contesto più povero.

### 9.4 Artefatti con peso apparente ma reale impatto limitato

| Artefatto | Peso apparente | Peso reale |
|-----------|---------------|------------|
| `relations[]` | Alto (grafo, UX) | Basso (solo quality score) |
| `evidence[]` | Alto (tracciabilità) | Basso (solo quality score, UI) |
| `coverage` (AI) | Medio (badge) | Nullo (non usato in decisioni) |
| `confidence` (AI) | Medio (badge) | Nullo (non gating downstream) |
| `qualityScore` | Medio (UI) | Nullo (non gating downstream) |
| `architecturalNotes` | Medio (UI) | Basso (solo formatter) |
| `missingInformation` | Medio (UI) | Nullo (non genera azioni) |

---

## 10. Raccomandazioni Prioritarie

### Quick Wins (basso rischio, alto beneficio immediato)

| # | Raccomandazione | Problema risolto | Beneficio | Rischio | Area/File |
|---|----------------|-----------------|-----------|---------|-----------|
| QW1 | **Passare descrizioni componenti al Pass 3** — aggiungere `${c.description ?? ''}` dopo nome/tipo nel blueprintSummaryLines | C2 — contesto impoverito per attività | Attività più specifiche e contestuali | Basso — solo token budget | `generate-project-from-documentation.ts` (linee ~420-430) |
| QW2 | **Segnalare all'utente quando Pass 3 fallisce** — mostrare un warning toast/banner visibile | C4 — fallimento silenzioso | UX chiara, utente consapevole | Basso | `CreateProjectFromDocumentation.tsx`, `generate-project-from-documentation.ts` |
| QW3 | **Validare blueprintNodeName post-generazione** — check che i nomi referenziati esistano nel blueprint normalizzato | C3 — tracciabilità finta | Eliminazione riferimenti orfani | Basso | `generate-project-from-documentation.ts` (dopo Pass 3 validation) |
| QW4 | **Aumentare maxTokens Pass 1 a 6000+** | C6 — SDD troncato | SDD più completo per documenti ricchi | Basso (costo marginale) | `generate-project-from-documentation.ts` |
| QW5 | **Passare keyPassages dell'SDD al Pass 3** | P8 — citazioni perse | Attività ancorate a evidence testuali | Basso — budget token | `generate-project-from-documentation.ts` (pass3ContextBlock) |

### Refactor di Medio Impatto

| # | Raccomandazione | Problema risolto | Beneficio | Rischio | Area/File |
|---|----------------|-----------------|-----------|---------|-----------|
| M1 | **Pulsante "Rigenera attività"** — disaccoppiare Pass 3 come endpoint indipendente che prende blueprint + SDD e ri-genera le attività | C8 — rigenerazione monolitica | Iterazione rapida dopo modifiche al blueprint | Medio — nuovo endpoint, ma logica già estratta | `ai-generate-project-from-documentation.ts`, `CreateProjectFromDocumentation.tsx` |
| M2 | **Validazione copertura attività deterministico** — post-generazione, verificare che ogni componente blueprint abbia almeno un'attività, e generare attività stubby per gap | Blueprint→attività gap | Copertura garantita deterministicamente | Medio — logica nuova | `generate-project-from-documentation.ts` |
| M3 | **Unificare sanitizzazione** — singola funzione in un modulo condiviso, rimuovere la duplicazione frontend/backend e rendere la rimozione `{}` opzionale/configurabile | C5 — doppia sanitizzazione, perdita `{}` | Preserva codice/JSON nel testo, singola SoT | Medio — test di regressione necessari | `src/types/ai-validation.ts`, `netlify/functions/lib/sanitize.ts` |
| M4 | **Gating basato su qualityScore** — se score < 0.4, mostrare un warning prominente all'utente con suggerimenti per migliorare la documentazione | C9 — quality decorativo | UX guidata, utente consapevole di blueprint fragili | Basso-Medio | `CreateProjectFromDocumentation.tsx`, `blueprint-quality-score.ts` |
| M5 | **Alimentare blueprint-rules con relations** — usare le relazioni per inferire rischi e driver aggiuntivi (es. cicli, hub, nodi isolati) | C10 — relazioni sottoutilizzate | Stima più informata dalla struttura architetturale | Medio | `blueprint-rules.ts` |

### Modifiche Strutturali Profonde

| # | Raccomandazione | Problema risolto | Beneficio | Rischio | Area/File |
|---|----------------|-----------------|-----------|---------|-----------|
| S1 | **Pass 2 con accesso al documento originale + SDD** — dare al blueprint sia l'SDD (per struttura) sia il documento (per dettaglio) evitando la compressione lossy totale | C1 — SDD come single point of failure | Blueprint drasticamente più ricco e accurato | Alto — raddoppia il prompt, richiede budget token elevato | `generate-project-from-documentation.ts` (Pass 2 construction) |
| S2 | **Pass 3 con accesso al blueprint completo** — serializzare il blueprint normalizzato intero (con descrizioni, evidence, relazioni) anziché solo nomi/tipi | C2 + P6 — contesto impoverito | Attività molto più specifiche e tracciabili | Medio-Alto — richiede ottimizzazione token e possibilmente modello più capace | `generate-project-from-documentation.ts` (Pass 3 construction) |
| S3 | **Pipeline incrementale/iterativa** — permettere di ri-eseguire singoli pass preservando gli altri, con invalidation cascade (modifica SDD → invalida blueprint → invalida attività) | C8 + P9 — monolite non iterativo | Flusso professionale di raffinamento progressivo | Alto — richiede re-architettura stato, caching artefatti, UI multi-step | Intero flusso |
| S4 | **Enforcement referenziale blueprint→attività** — dopo la generazione, validare con codice deterministico che ogni `blueprintNodeName` corrisponda a un nodo reale, e che ogni nodo blueprint abbia almeno un'attività. Inserire fill-in deterministico per i gap. | C3 + Sezione 8 — coerenza strutturale | Tracciabilità verificata, copertura completa | Medio — richiede definizione regole di fill-in | `generate-project-from-documentation.ts`, nuovo modulo di validazione |
| S5 | **Separare SDD generation da Project Draft** — due task indipendenti nel Pass 1, possibilmente con modello più potente per l'SDD | C1 + C6 — SDD limitato da gpt-4o-mini e maxTokens condivisi | SDD di qualità superiore senza compromessi sul budget metadati | Medio — un pass aggiuntivo, costo AI | `generate-project-from-documentation.ts`, `project-from-documentation.ts` |

---

## Appendice A — File Coinvolti (Indice Rapido)

### Pipeline principale
| File | Ruolo |
|------|-------|
| `netlify/functions/ai-generate-project-from-documentation.ts` | Handler Netlify (auth, validation, catalogs) |
| `netlify/functions/lib/ai/actions/generate-project-from-documentation.ts` | Orchestratore 3-pass |
| `netlify/functions/lib/ai/prompts/project-from-documentation.ts` | Prompt Pass 1 + Pass 2, JSON Schemas |
| `netlify/functions/lib/ai/prompts/project-activities-generation.ts` | Prompt Pass 3, JSON Schema |
| `netlify/functions/lib/ai/post-processing/normalize-blueprint.ts` | Normalizzazione deterministica |
| `netlify/functions/lib/sanitize.ts` | Sanitizzazione input backend |

### Tipi e dominio
| File | Ruolo |
|------|-------|
| `netlify/functions/lib/domain/project/project-technical-blueprint.types.ts` | Tipi blueprint (backend) |
| `netlify/functions/lib/domain/project/project-activity.types.ts` | Tipi attività (backend) |
| `src/types/project-technical-blueprint.ts` | Tipi blueprint (frontend, re-export) |
| `src/types/project-activity.ts` | Tipi attività (frontend, re-export) |

### Frontend
| File | Ruolo |
|------|-------|
| `src/components/projects/CreateProjectFromDocumentation.tsx` | UI creazione (input, review, save) |
| `src/lib/project-documentation-api.ts` | API client |
| `src/lib/project-technical-blueprint-repository.ts` | Persistenza blueprint |
| `src/lib/project-activity-repository.ts` | Persistenza attività |

### Downstream (stima)
| File | Ruolo |
|------|-------|
| `netlify/functions/lib/domain/estimation/blueprint-rules.ts` | Regole deterministiche da blueprint |
| `netlify/functions/lib/domain/estimation/blueprint-context-integration.ts` | Merge regole blueprint + contesto progetto |
| `netlify/functions/lib/ai/formatters/project-blueprint-formatter.ts` | Formatter blueprint per prompt stima |
| `netlify/functions/lib/ai/formatters/project-activities-formatter.ts` | Formatter attività per prompt stima |
| `netlify/functions/lib/domain/pipeline/project-activity-signal-adapter.ts` | Adattatore attività → segnali pipeline |
| `netlify/functions/lib/blueprint-activity-mapper.ts` | Mapper blueprint → attività catalogo |

### DB
| File | Ruolo |
|------|-------|
| `supabase/migrations/20260401_project_technical_blueprints.sql` | Tabella blueprints |
| `supabase/migrations/20260402_blueprint_v2_enrichment.sql` | Colonne v2 (relations, coverage, quality) |
| `supabase/migrations/20260412_project_activities.sql` | Tabella attività progetto |
| `supabase/migrations/20260412_blueprint_structured_digest.sql` | Colonna SDD |

---

## Appendice B — Legenda Livelli di Confidenza dell'Analisi

- ✅ **Confermato dal codice** — Comportamento verificato leggendo il codice sorgente
- ⚠️ **Dedotto con alta probabilità** — Comportamento inferito da pattern chiari nel codice
- ❓ **Ambiguo / Da verificare** — Non completamente verificabile senza esecuzione o test

Tutti i comportamenti descritti in questo documento sono **confermati dal codice** salvo dove esplicitamente indicato diversamente.
