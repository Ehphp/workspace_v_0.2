# Analisi Funzionale — RequirementDetail Page

> **Data:** 2026-03-21  
> **Scope:** Pagina di dettaglio requisito (`src/pages/requirements/RequirementDetail.tsx`)  
> **Obiettivo:** Documentare struttura, dati, flussi, architettura dei tab e integrazioni della pagina  

---

## 1. Posizione nella navigazione e accesso

| Proprietà | Valore |
|---|---|
| **Route** | `/dashboard/:listId/requirements/:reqId` |
| **Parametri URL** | `listId` (UUID lista requisiti), `reqId` (UUID requisito) |
| **Accesso** | Solo utenti autenticati (hook `useAuth`) |
| **Ritorno** | Pulsante "Back" → `/dashboard/:listId/requirements` oppure `/dashboard` |

La pagina è il punto di convergenza per tutte le operazioni post-creazione su un singolo requisito: visualizzazione, stima, cronologia stime e consuntivazione.

---

## 2. Architettura generale della pagina

```
┌─────────────────────────────────────────────────────┐
│  PageShell (layout globale, header app)             │
│  ┌───────────────────────────────────────────────┐  │
│  │  RequirementHeader (titolo inline-edit, meta)  │  │
│  ├───────────────────────────────────────────────┤  │
│  │  Tab Navigation (4 tab)                        │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  [Panoramica] [Stima] [Timeline] [Cons.] │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  ├───────────────────────────────────────────────┤  │
│  │  Tab Content (render condizionale)             │  │
│  │  - OverviewTab                                 │  │
│  │  - EstimationTab                               │  │
│  │  - HistoryTab                                  │  │
│  │  - ActualHoursTab                              │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Sheet (drawer storico stima selezionata)      │  │
│  │  AlertDialog (errori Quick Estimate)            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 3. Caricamento dati — Hook principali

La pagina carica dati da **5 hook indipendenti** al mount:

| Hook | Dati caricati | Tabelle Supabase | Cache |
|---|---|---|---|
| `useRequirement(listId, reqId, userId)` | `requirement`, `list`, `preset`, `driverValues`, `assignedEstimation` | `requirements`, `lists`, `technologies`, `requirement_driver_values`, `estimations` | 1 min |
| `useEstimationData()` | `presets`, `activities`, `drivers`, `risks` | `technologies`, `activities`, `drivers`, `risks`, `technology_activities` | 1 min |
| `useEstimationHistory(reqId, {page, pageSize})` | `history[]`, `totalCount` | `estimations` + join `estimation_activities`, `estimation_drivers`, `estimation_risks` | 30 sec |
| `useConsultantHistory(reqId)` | `consultantHistory[]` | `consultant_analyses` | 30 sec |
| `useEstimationState({activities, drivers, risks, technologies})` | Stato locale di stima (selezioni, risultato calcolato) | — (in-memory) | — |

### Dati derivati calcolati in pagina

| Variabile | Logica |
|---|---|
| `fallbackTechnologyId` | `requirement.technology_id \|\| requirement.tech_preset_id \|\| list.technology_id \|\| list.tech_preset_id` |
| `activeTechnologyId` | `selectedPresetId \|\| fallbackTechnologyId` |
| `activeTechnology` | Oggetto Technology risolto da `activeTechnologyId` |
| `filteredActivities` | `filterActivitiesByTechnology(activities, activeTechnology, presets)` — filtra per FK canonico o fallback `tech_category` |
| `hasUnsavedChanges` | Confronto numerico `estimationResult` vs `estimationHistory[0]` (totali, attività, rischi) |
| `requirementUnderstanding` | Caricato asincrono via `getLatestRequirementUnderstanding(requirement.id)` |

---

## 4. Header — RequirementHeader

Il componente header è **persistente** sopra tutti i tab.

### Campi visualizzati e editabili

| Campo | Tipo UI | Editabile | Salvataggio |
|---|---|---|---|
| **Titolo** | Testo inline-edit | ✅ Click per editare, blur/Enter per salvare | Ottimistico |
| **Priorità** | Dropdown (LOW/MEDIUM/HIGH) | ✅ Cambio immediato | Ottimistico |
| **Stato** | Dropdown con transizioni workflow | ✅ Solo transizioni consentite | Validato via `canTransition()` |
| **Tecnologia** | Dropdown presets | ✅ Cambio immediato | Ottimistico |
| **Business Owner** | Testo inline-edit | ✅ Click per editare | Ottimistico |
| `req_id` | Badge read-only | ❌ | — |

### Integrazione workflow

- Hook `useWorkflow(requirement)` fornisce `availableTransitions` e `canTransition()`
- Le transizioni bloccate mostrano icona **Lock** con tooltip motivazione
- `GuardResult = { allowed: boolean, reason?: string }`

---

## 5. Tab 1 — Panoramica (OverviewTab)

### Layout
Griglia 70/30:
- **Colonna sinistra (70%):** Contenuti del requisito e artefatti AI
- **Colonna destra (30%):** Pannello riepilogo stima (sticky)

### Sezioni colonna sinistra

| Sezione | Contenuto | Visibilità |
|---|---|---|
| **Descrizione** | Testo descrizione requisito (collassabile) | Sempre |
| **Requirement Understanding** | Card strutturata `RequirementUnderstandingCard` | Solo se `requirementUnderstanding` presente |
| **AI Reasoning** | Ragionamento IA dalla stima | Solo se `latestEstimation.ai_reasoning` presente |
| **Analisi Consulente Senior** | Card `ConsultantAnalysisCard` | Solo se `consultantAnalysis` presente |
| **Storico Analisi Consulente** | Pannello storico consulente | Se presenti record storici |
| **Progresso Implementazione** | `RequirementProgress` (checklist attività) | Se stima assegnata presente |

### Pannello destro (Riepilogo Stima)

| Dato | Formato |
|---|---|
| **Total Days** | Numero grande (hero) — es. "12.5" |
| **Base Hours** | Ore base pre-moltiplicatore |
| **Driver Multiplier** | Fattore moltiplicativo — es. "1.250x" |
| **Contingency** | Percentuale contingenza — es. "15%" |
| **Azioni** | Pulsanti: "Rivedi stima", "Timeline", "Richiedi Consulente" |

### RequirementUnderstandingCard — Sotto-sezioni

Artefatto strutturato AI prodotto dal wizard (Milestone 1). Campi visualizzati:

| Campo | Tipo | Descrizione |
|---|---|---|
| `businessObjective` | stringa | Obiettivo di business (1-500 char) |
| `expectedOutput` | stringa | Output atteso |
| `functionalPerimeter` | stringa[] | Perimetro funzionale (1-8 voci) |
| `exclusions` | stringa[] | Esclusioni esplicite (0-5 voci) |
| `actors` | `{role, interaction}[]` | Attori coinvolti e tipo interazione (1-5) |
| `stateTransition` | `{initialState, finalState}` | Transizione di stato (prima/dopo) |
| `preconditions` | stringa[] | Pre-condizioni (0-5) |
| `assumptions` | stringa[] | Assunzioni (0-5) |
| `complexityAssessment` | `{level, rationale}` | Livello complessità: LOW/MEDIUM/HIGH + motivazione |
| `confidence` | numero 0–1 | Confidenza dell'analisi AI |
| `metadata` | oggetto | Timestamp, modello AI, categoria tech |

Persistenza: tabella `requirement_understanding`, versionato, caricato via `getLatestRequirementUnderstanding()`.

### ConsultantAnalysisCard — Sotto-sezioni

| Campo | Tipo | Descrizione |
|---|---|---|
| `overallAssessment` | enum | `approved` / `needs_review` / `concerns` |
| `estimatedConfidence` | 0-100 | Confidenza nella stima |
| `implementationTips` | Markdown | Suggerimenti implementativi |
| `discrepancies[]` | lista | Tipo (missing_coverage, over_engineering, etc.), severità, descrizione, raccomandazione |
| `riskAnalysis[]` | lista | Categoria (technical, integration, etc.), livello, descrizione, mitigazione |

---

## 6. Tab 2 — Stima (EstimationTab)

### Scopo
Workspace interattivo per costruire o modificare una stima: selezione attività, driver, rischi, con calcolo in tempo reale.

### Layout
```
┌──────────────────────────────────────────────────────────┐
│  Toolbar: Export (PDF/Excel)                              │
├──────────────────────────────────────────────────────────┤
│  RequirementEstimation (griglia 3 colonne)                │
│  ┌────────┬──────────────────────┬──────────────┐        │
│  │ Preset │    Activities         │  Summary     │        │
│  │ Drivers│    (multi-select)     │  (Calc. live)│        │
│  │ Risks  │                       │              │        │
│  └────────┴──────────────────────┴──────────────┘        │
└──────────────────────────────────────────────────────────┘
```

### Dati di input

| Dato | Provenienza | Modificabile |
|---|---|---|
| **Preset tecnologico** | `selectedPresetId` (da hook stato) | ✅ Dropdown |
| **Attività** | `filteredActivities` (filtrate per tecnologia) | ✅ Toggle individuale |
| **Driver** | `drivers[]` (master data) | ✅ Valore selezionabile per ogni driver |
| **Rischi** | `risks[]` (master data) | ✅ Toggle individuale |

### Risultato calcolato in tempo reale (`EstimationResult`)

| Campo | Formula/Logica |
|---|---|
| `baseDays` | Σ(base_hours delle attività selezionate) / 8 |
| `driverMultiplier` | Π(multiplier di ogni driver selezionato) |
| `subtotal` | baseDays × driverMultiplier |
| `riskScore` | Σ(weight dei rischi selezionati) |
| `contingencyPercent` | f(riskScore) — mappatura deterministica |
| `contingencyDays` | subtotal × contingencyPercent / 100 |
| `totalDays` | subtotal + contingencyDays |
| `breakdown` | Raggruppamento per `group` e per `tech` |

### Azioni disponibili

| Azione | Trigger | Effetto |
|---|---|---|
| **AI Suggest** | Pulsante | Chiama `suggestActivities()` → endpoint `ai-suggest` → seleziona attività suggerite |
| **Applica Template** | Pulsante (header preset) | `applyPresetDefaults()` → seleziona attività default del preset |
| **Salva Stima** | Pulsante | `saveEstimationByIds()` → RPC `save_estimation_atomic` (transazionale) |
| **Export** | Dropdown toolbar | Genera PDF o Excel con dati stima corrente |

### Quick Estimate (accessibile da Overview)

Flusso automatizzato one-click:
1. Determina preset tecnologico (fallback chain)
2. Chiama `suggestActivities()` con descrizione requisito
3. Applica selezioni AI
4. Switch automatico a tab Stima
5. Utente rivede e salva

### Validazione pre-salvataggio

- `isEstimationValid`: almeno 1 attività selezionata, preset valido
- `hasUnsavedChanges`: confronto con ultima stima salvata (total_days, activities, risks)
- Indicatore visivo di modifiche non salvate

---

## 7. Tab 3 — Timeline (HistoryTab)

### Scopo
Cronologia completa delle stime salvate per il requisito, con confronto side-by-side.

### Layout
```
┌──────────────────────────────────────────────┐
│  Layout 60/40                                 │
│  ┌────────────────┬─────────────────────────┐│
│  │ HistorySection │  Detail / Comparison     ││
│  │ (lista timeline│  Panel                   ││
│  │  con selezione)│                          ││
│  └────────────────┴─────────────────────────┘│
└──────────────────────────────────────────────┘
```

### Colonna sinistra — HistorySection

| Feature | Dettaglio |
|---|---|
| **Lista** | Timeline verticale delle stime (EstimationTimeline) |
| **Selezione** | Multi-select fino a 2 elementi |
| **Default** | Pre-seleziona `assignedEstimationId` o la più recente |
| **Paginazione** | Page size 50, controlli prev/next |
| **Assign** | Pulsante per assegnare una stima come "ufficiale" del requisito |

### Colonna destra — Pannello dettaglio

| Stato selezione | Contenuto visualizzato |
|---|---|
| **0 selezionati** | Placeholder informativo |
| **1 selezionato** | Dettaglio singola stima: total_days, base_hours, attività, scenario, consulente |
| **2 selezionati** | `MetricComparison`: confronto side-by-side older vs newer |

### Dati per ogni record storico (`EstimationHistoryItem`)

| Campo | Tipo |
|---|---|
| `id` | UUID |
| `total_days` | numero |
| `base_hours` | numero |
| `driver_multiplier` | numero |
| `risk_score` | numero |
| `contingency_percent` | numero |
| `scenario_name` | stringa |
| `created_at` | ISO timestamp |
| `estimation_activities[]` | `{ activity_id, is_ai_suggested, is_done }` |
| `estimation_drivers[]` | `{ driver_id, selected_value }` |
| `estimation_risks[]` | `{ risk_id }` |

### MetricComparison — Metriche confrontate

| Metrica | Visualizzazione |
|---|---|
| Total Days | Delta con trend icon (TrendingUp/Down/Minus) |
| Base Hours | Confronto numerico |
| Risk Score | Confronto numerico |
| Attività | Aggiunte / Rimosse / Invariate |
| Colori | Rosso = aumento, Verde = diminuzione, Grigio = invariato |

---

## 8. Tab 4 — Consuntivo (ActualHoursTab)

### Scopo
Registrazione ore effettive vs stimate per analisi scostamenti (Sprint 2 – S2-2b).

### Prerequisito
Deve esistere almeno una stima salvata (assignedEstimation o history).

### Campi form

| Campo | Tipo | Obbligatorio | Dettaglio |
|---|---|---|---|
| **Ore effettive** | Number input (step 0.5) | ✅ | Ore reali di lavoro |
| **Data inizio effettiva** | Date picker | ❌ | Data di inizio reale |
| **Data fine effettiva** | Date picker | ❌ | Data di completamento reale |
| **Note** | Textarea | ❌ | Commenti liberi |

### Selettore stima (se multiple)

Se il requisito ha più stime in storico, un dropdown consente di selezionare quale stima usare come baseline per il confronto.

### Card riepilogo stima selezionata

| Dato | Valore mostrato |
|---|---|
| Total Days | Giorni stimati |
| Base Hours | Ore base |
| Scenario | Nome scenario |
| Created At | Data creazione stima |

### Calcolo scostamento (real-time durante input)

```
deviationPercent = (actualDays - estimatedDays) / estimatedDays × 100
```

| Range | Colore | Significato |
|---|---|---|
| ≤ 10% | Verde | Scostamento accettabile |
| ≤ 25% | Ambra | Attenzione |
| > 25% | Rosso | Scostamento critico |

### Persistenza

Campi salvati su tabella `estimations` (aggiornamento record esistente):
- `actual_hours`
- `actual_start_date`
- `actual_end_date`
- `actual_notes`
- `actual_recorded_at`
- `actual_recorded_by`

---

## 9. Sheet Drawer — Dettaglio Storico

Attivato dalla selezione in HistoryTab (o da indicatori nella pagina).

### Contenuti

| Sezione | Dettaglio |
|---|---|
| **Hero Number** | Total Days (grande, gradient blue) |
| **Calculation Breakdown** | Base Days, Driver Multiplier, Subtotal |
| **Risk & Contingency** | Risk Score, Contingency % |
| **Activities List** | Nome attività, ore base, badge "AI" se suggerita |
| **Drivers List** | Nome driver, valore selezionato, moltiplicatore |
| **Risks List** | Nome rischio, peso |
| **Formula** | Visualizzazione formula completa: `Subtotal = base × multiplier`, `Total = subtotal × (1 + contingency%)` |

---

## 10. Operazioni AI disponibili dalla pagina

| Operazione | Endpoint | Trigger | Input | Output |
|---|---|---|---|---|
| **AI Suggest** | `ai-suggest` (Netlify FN) | Pulsante tab Stima | Descrizione, preset, attività compatibili, contesto progetto | Lista `activityCodes[]`, `isValidRequirement`, `reasoning` |
| **Quick Estimate** | `ai-suggest` (riuso) | Pulsante Panoramica | Come sopra (automatico) | Stessa risposta, applicazione automatica + switch tab |
| **Consultant Analysis** | `ai-consultant` (Netlify FN) | Pulsante Panoramica | Titolo, descrizione, attività salvate, driver salvati, contesto progetto, tecnologia | `SeniorConsultantAnalysis` (assessment, discrepancies, risks, tips) |

### Nota: Le operazioni AI leggono da dati diversi

- **AI Suggest**: legge lo stato *corrente* del tab Stima (in-memory)
- **Consultant Analysis**: legge la stima *salvata* (`assignedEstimation` o `estimationHistory[0]`) — mai lo stato locale

---

## 11. Schema di persistenza coinvolto

### Tabelle Supabase lette dalla pagina

| Tabella | Uso |
|---|---|
| `requirements` | Dati requisito (titolo, descrizione, priorità, stato, technology_id, assigned_estimation_id) |
| `lists` | Lista padre (nome, descrizione, owner, technology_id) |
| `technologies` | Master data presets tecnologici |
| `activities` | Master data attività stimabili |
| `drivers` | Master data driver con opzioni e moltiplicatori |
| `risks` | Master data rischi con pesi |
| `technology_activities` | Tabella pivot tecnologia ↔ attività |
| `requirement_driver_values` | Valori driver preimpostati a livello requisito |
| `estimations` | Stime salvate (con campi consuntivo) |
| `estimation_activities` | Pivot stima ↔ attività (con `is_ai_suggested`, `is_done`) |
| `estimation_drivers` | Pivot stima ↔ driver (con `selected_value`) |
| `estimation_risks` | Pivot stima ↔ rischi |
| `requirement_understanding` | Artefatto Understanding AI, versionato |
| `consultant_analyses` | Storico analisi consulente senior, con snapshot |

### Mutazioni eseguite dalla pagina

| Operazione | Meccanismo | Transazionalità |
|---|---|---|
| **Salva stima** | RPC `save_estimation_atomic` | ✅ Atomica (server-side) |
| **Aggiorna header** | Update diretto `requirements` | Ottimistico (client) |
| **Salva consuntivo** | Update `estimations` (actual_*) | Singola operazione |
| **Salva analisi consulente** | Insert `consultant_analyses` | Con snapshot req + stima |
| **Toggle progresso attività** | Update `estimation_activities.is_done` | Ottimistico |
| **Assegna stima** | Update `requirements.assigned_estimation_id` | Singola operazione |

---

## 12. Gestione stato locale

### Stati UI

| Stato | Tipo | Scopo |
|---|---|---|
| `activeTab` | stringa | Tab corrente (`info`, `estimation`, `history`, `actuals`) |
| `isAiLoading` | boolean | Loading AI Suggest |
| `isSaving` | boolean | Loading salvataggio stima |
| `isQuickEstimating` | boolean | Loading Quick Estimate |
| `isConsultantLoading` | boolean | Loading analisi consulente |
| `drawerOpen` | boolean | Sheet dettaglio storico |
| `selectedEstimationId` | string\|null | ID stima selezionata per drawer |
| `showQuickEstimateError` | boolean | Dialog errore Quick Estimate |
| `quickEstimateErrorData` | oggetto | Titolo, messaggio, reasoning AI dell'errore |
| `consultantAnalysis` | oggetto\|null | Ultima analisi consulente caricata |
| `requirementUnderstanding` | oggetto\|null | Understanding AI caricato da DB |
| `historyPage` | numero | Pagina corrente storico (1-based) |

### Inizializzazioni automatiche (useEffect)

| Trigger | Azione |
|---|---|
| `requirement.id` cambia | Carica `requirementUnderstanding` via API |
| `consultantHistory` caricato | Inizializza `consultantAnalysis` dal record più recente |
| `fallbackTechnologyId` disponibile | Imposta `selectedPresetId` (solo se non già impostato) |
| `requirementDriverValues` disponibili | Imposta `selectedDriverValues` con valori pre-salvati del requisito |

---

## 13. Flusso utente tipo

```
1. Utente apre RequirementDetail
     ↓
2. Caricamento parallelo: requirement + master data + history + consultant history
     ↓
3. Tab "Panoramica" (default)
   - Vede descrizione, understanding AI (se presente), stima corrente, consulente
   - Azioni: Quick Estimate, Richiedi Consulente, naviga tab
     ↓
4. Tab "Stima" (manuale o via Quick Estimate)
   - Seleziona/modifica preset, attività, driver, rischi
   - Calcolo live mostrato nel pannello destro
   - AI Suggest per suggerimenti automatici
   - Salva → RPC atomica
     ↓
5. Tab "Timeline"
   - Confronta versioni storiche della stima
   - Assegna stima ufficiale
   - Confronto side-by-side (max 2)
     ↓
6. Tab "Consuntivo"
   - Registra ore effettive
   - Calcolo scostamento in tempo reale
   - Salva dati consuntivo
```

---

## 14. Vincoli e note architetturali

| Vincolo | Dettaglio |
|---|---|
| **Wizard = solo creazione** | La pagina RequirementDetail è il punto di edit/review. Il wizard non supporta riapertura. |
| **Understanding = read-only** | L'artefatto Understanding è visualizzato ma non modificabile dalla pagina (prodotto solo dal wizard). |
| **Consultant legge da stima salvata** | L'analisi consulente opera su dati persistiti, non sullo stato in-memory del tab Stima. |
| **Filtro attività per tecnologia** | FK canonico `activity.technology_id` → poi fallback `tech_category`. Include sempre attività MULTI. |
| **Salvataggio atomico** | `save_estimation_atomic` RPC gestisce insert stima + pivot activities/drivers/risks in transazione. |
| **Nessun FK understanding → estimation** | L'understanding è indipendente dalle stime; non influenza la formula di calcolo. |
| **Cache breve** | Master data 1 min, history/consultant 30 sec — adeguato per uso interattivo. |
| **Paginazione storico** | Page size 50, sufficiente per la maggior parte dei requisiti. |

---

## 15. Dipendenze componenti — Mappa completa

```
RequirementDetail.tsx
├── RequirementHeader.tsx
│   ├── useWorkflow()
│   ├── useRequirementActions()
│   ├── PriorityBadge, StateBadge
│   └── Inline-edit fields
│
├── OverviewTab.tsx
│   ├── RequirementUnderstandingCard.tsx
│   ├── RequirementProgress.tsx
│   ├── ConsultantAnalysisCard.tsx
│   └── ConsultantHistoryPanel
│
├── EstimationTab.tsx
│   ├── RequirementEstimation.tsx
│   │   ├── Technology Selector
│   │   ├── Activities Multi-select
│   │   ├── Drivers Value Selectors
│   │   ├── Risks Toggle
│   │   └── Calculation Summary Panel
│   └── ExportDialog.tsx
│
├── HistoryTab.tsx
│   ├── HistorySection.tsx
│   │   └── EstimationTimeline
│   ├── MetricComparison.tsx
│   └── ConsultantAnalysisCard.tsx (collapsible)
│
├── ActualHoursTab.tsx
│   └── useActualHours() hook
│
├── Sheet (drawer storico — inline nel page)
└── AlertDialog (errore Quick Estimate — inline)
```

---

## 16. Metriche e KPI tracciabili dalla pagina

| Metrica | Fonte | Tab |
|---|---|---|
| Giorni totali stimati | `estimationResult.totalDays` | Stima, Panoramica |
| Ore base | `estimationResult.baseDays × 8` | Stima |
| Moltiplicatore driver | `estimationResult.driverMultiplier` | Stima |
| Punteggio rischio | `estimationResult.riskScore` | Stima |
| Contingenza % | `estimationResult.contingencyPercent` | Stima |
| N. attività selezionate | `selectedActivityIds.length` | Stima |
| N. attività suggerite AI | `aiSuggestedIds.length` | Stima |
| Ore effettive | `actual_hours` | Consuntivo |
| Scostamento % | `(actual - estimated) / estimated × 100` | Consuntivo |
| Confidenza consulente | `consultantAnalysis.estimatedConfidence` | Panoramica |
| Assessment consulente | `consultantAnalysis.overallAssessment` | Panoramica |
| Confidenza understanding | `requirementUnderstanding.confidence` | Panoramica |
| Complessità understanding | `requirementUnderstanding.complexityAssessment.level` | Panoramica |
| N. versioni stima | `historyTotalCount` | Timeline |
| Progresso implementazione | `is_done count / total activities` | Panoramica |

---

## Appendice A — Tipi di dato principali

### Requirement (semplificato)
```typescript
{
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  state: RequirementState;         // workflow-driven
  technology_id: string | null;
  tech_preset_id: string | null;   // legacy
  assigned_estimation_id: string | null;
  business_owner: string | null;
  req_id: string;                  // display code
}
```

### EstimationResult (calcolato in-memory)
```typescript
{
  baseDays: number;
  driverMultiplier: number;
  subtotal: number;
  riskScore: number;
  contingencyPercent: number;
  contingencyDays: number;
  totalDays: number;
  breakdown: {
    byGroup: Record<string, number>;
    byTech: Record<string, number>;
  };
}
```

### RequirementUnderstanding
```typescript
{
  businessObjective: string;
  expectedOutput: string;
  functionalPerimeter: string[];
  exclusions: string[];
  actors: { role: string; interaction: string }[];
  stateTransition: { initialState: string; finalState: string };
  preconditions: string[];
  assumptions: string[];
  complexityAssessment: { level: 'LOW'|'MEDIUM'|'HIGH'; rationale: string };
  confidence: number;
  metadata: { generatedAt: string; model: string; techCategory?: string; inputDescriptionLength: number };
}
```

### SeniorConsultantAnalysis
```typescript
{
  implementationTips: string;        // Markdown
  discrepancies: {
    type: 'missing_coverage' | 'over_engineering' | 'activity_mismatch' | 'driver_issue';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
  }[];
  riskAnalysis: {
    category: 'technical' | 'integration' | 'resource' | 'timeline' | 'requirement_clarity';
    level: 'low' | 'medium' | 'high';
    description: string;
    mitigation: string;
  }[];
  overallAssessment: 'approved' | 'needs_review' | 'concerns';
  estimatedConfidence: number;
  generatedAt: string;
}
```

---

*Fine documento. Generato tramite analisi statica del codice sorgente.*
