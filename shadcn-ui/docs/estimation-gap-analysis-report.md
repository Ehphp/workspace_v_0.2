# Report Comparativo: Sistema di Stima Attuale vs Architettura Target

---

## 1. Executive Summary

Il sistema di stima attuale è un prodotto ingegneristicamente sofisticato, dotato di pipeline AI multi-round (planner + estimation + reflection), RAG storico, validazione deterministica e un catalogo attività strutturato per tecnologia. Tuttavia, l'architettura corrente è stata progettata con un paradigma fondamentalmente diverso da quello target: **il sistema attuale è un "selettore di attività assistito da AI"**, non una **"pipeline di ragionamento strutturato sulla complessità"**.

### Giudizio sintetico di allineamento

| Dimensione | Allineamento |
|---|---|
| Raccolta requisito | ⚠️ Parziale — descrizione + metadati, ma nessuna analisi formale di perimetro, obiettivi business, stato iniziale/finale |
| Scomposizione tecnica | ✅ Presente — catalogo attività con selezione AI + user override |
| Driver di complessità | ✅ Presente — sistema di driver con moltiplicatori, ma applicati uniformemente (non per componente) |
| Gestione rischi | ✅ Presente — rischi con pesi, contingency deterministica |
| Separazione complessità/effort | ⚠️ Parziale — driver moltiplicativi separano, ma manca un profilo di complessità indipendente |
| Analisi componenti impattati | ❌ Assente — nessuna mappa esplicita frontend/backend/DB/integrazioni |
| Flusso logico del requisito | ❌ Assente — nessuna ricostruzione formale del flusso operativo |
| Analisi dati strutturata | ❌ Assente — dati trattati come categoria di domanda, non come fase |
| Analisi integrazioni strutturata | ❌ Assente — integrazioni trattate come categoria, non come fase analitica |
| WBS gerarchica | ❌ Assente — solo lista piatta di attività |
| Ipotesi / esclusioni / assunzioni | ❌ Assente — nessun campo strutturato |
| Output auditabile e motivato | ⚠️ Parziale — AI reasoning salvato come testo libero, non strutturato per fase |

**Gap complessivo stimato: 55-60%.** Il sistema attuale copre bene la parte di scomposizione in attività e calcolo dell'effort, ma manca quasi totalmente la parte di **analisi strutturata** che precede e informa la stima.

---

## 2. Ricostruzione dell'Implementazione Attuale

### 2.1 Architettura generale

Il sistema è un wizard a 5 step che guida l'utente dalla descrizione del requisito fino alla stima finale:

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5
 Desc    Tech     Interview  Drivers   Results
 +Meta   Preset   +AI Est.   +Risks    +Save
```

### 2.2 Moduli principali coinvolti

| Modulo | Ruolo |
|---|---|
| `RequirementWizard.tsx` | Orchestratore UI del wizard a 5 step |
| `WizardStep1.tsx` | Raccolta descrizione, priorità, stato, owner + normalizzazione AI |
| `WizardStep2.tsx` | Selezione preset tecnologico |
| `WizardStepInterview.tsx` | Intervista tecnica AI-driven (1-3 domande) |
| `WizardStep4.tsx` | Configurazione driver (moltiplicatori) e rischi (pesi) |
| `WizardStep5.tsx` | Visualizzazione risultati + export + salvataggio |
| `useWizardState.ts` | Stato persistente del wizard in localStorage |
| `useRequirementInterview.ts` | Gestione ciclo di vita intervista AI |
| `requirement-interview-api.ts` | Client API per endpoint AI |
| `ai-requirement-interview.ts` | Round 0: planner (ASK/SKIP) + pre-stima |
| `ai-estimate-from-interview.ts` | Round 1: selezione attività + reasoning |
| `agent-orchestrator.ts` | Pipeline agentica (DRAFT→REFLECT→REFINE→VALIDATE) |
| `reflection-engine.ts` | Revisione "Senior Consultant" della bozza |
| `agent-tools.ts` | Tool del modello: search_catalog, query_history, validate_estimation, get_activity_details |
| `deterministic-rules.ts` | Regole deterministiche: trigger keyword, size variant, confidence |
| `rag.ts` | Retrieval di stime storiche simili (few-shot learning) |
| `vector-search.ts` | Ricerca semantica pgvector su attività e requisiti |
| `EstimationEngine.ts` (SDK) | Calcolo deterministico finale: baseDays × driverMult × (1+contingency) |

### 2.3 Flusso reale della stima

**Fase 1 — Input utente:**
- L'utente scrive una descrizione testuale del requisito (15-2000 caratteri)
- Seleziona metadati: priorità, stato, owner, preset tecnologico

**Fase 2 — Round 0 (Planner AI):**
- Il sistema fa una pre-stima (minHours, maxHours, confidence)
- Decide se servono domande di approfondimento (ASK) o se può stimare direttamente (SKIP)
- Soglie: SKIP se confidence ≥ 0.90 AND range ≤ 16h; oppure se RAG match ≥ 85%
- Se ASK: genera 1-3 domande con impatto atteso sulla riduzione dell'intervallo

**Fase 3 — Intervista tecnica:**
- L'utente risponde alle domande (single-choice, multiple-choice, range)
- Le domande coprono 8 categorie: INTEGRATION, DATA, SECURITY, PERFORMANCE, UI_UX, ARCHITECTURE, TESTING, DEPLOYMENT

**Fase 4 — Round 1 (Estimation AI):**
- Il modello seleziona attività dal catalogo (enum-constrained, code validi)
- Applica regole deterministiche: keyword trigger → attività obbligatorie, risposta → size variant (_SM/_LG)
- In modalità agentica: ciclo DRAFT → REFLECT → REFINE → VALIDATE con 4 tool disponibili
- Output: lista attività con ore base, reasoning, titolo generato, driver suggeriti, rischi suggeriti

**Fase 5 — Configurazione utente:**
- L'utente sceglie il valore di ciascun driver (dropdown con moltiplicatori: 0.8x → 2.0x)
- L'utente seleziona i rischi applicabili (checkbox con pesi)

**Fase 6 — Calcolo deterministico:**
```
baseDays = Σ(activity.baseHours) / 8
driverMultiplier = Π(driver.multiplier)
subtotal = baseDays × driverMultiplier
riskScore = Σ(risk.weight)
contingency% = f(riskScore)     // 10% → 25%
totalDays = subtotal × (1 + contingency%)
```

**Fase 7 — Output e persistenza:**
- Visualizzazione: totalDays, breakdown per gruppo/tecnologia, attività con badge AI
- Export: PDF / CSV
- Salvataggio atomico: requirement + estimation + attività + driver + rischi

### 2.4 Sottosistemi concorrenti

Esistono **tre modalità di stima parallele**:
1. **Wizard completo** (5 step, intervista AI, driver manuali) — modalità principale
2. **Bulk estimate** ("Stima Tutti") — stima automatica batch, driver neutri, senza intervista
3. **Manual edit** — l'utente seleziona manualmente attività/driver/rischi
4. **Quick estimation** (deprecated) — formula semplicistica basata su conteggio parole

---

## 3. Modello Target Sintetizzato

L'architettura target concepisce la stima come una **pipeline di ragionamento a 12 fasi**:

```
1. Comprensione requisito
   ↓
2. Mappa componenti impattati
   ↓
3. Analisi flusso logico
   ↓
4. Analisi dati
   ↓
5. Analisi integrazioni
   ↓
6. Scomposizione in task tecnici (WBS)
   ↓
7. Valutazione complessità con driver
   ↓
8. Distinzione complessità vs tempo
   ↓
9. Conversione in effort (gg/uomo)
   ↓
10. Gestione rischi, ipotesi, incertezza
    ↓
11. Output strutturato completo
    ↓
12. Principio fondante: stima del lavoro complessivo, non del tempo di scrittura codice
```

Il modello target non è una formula, ma un **processo di progressiva comprensione e decomposizione** dove ogni fase produce un output formale che alimenta la successiva.

---

## 4. Confronto Dettagliato per Fase

### Fase 1: Comprensione del Requisito

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Obiettivo business | Esplicito, documentato | Non catturato formalmente | ❌ |
| Output atteso | Esplicito | Non catturato | ❌ |
| Attori coinvolti | Espliciti | Campo `business_owner` (singolo) | ⚠️ Parziale |
| Stato iniziale/finale | Espliciti | Non catturati | ❌ |
| Perimetro funzionale | Delimitato formalmente | Implicito nella descrizione testuale | ⚠️ Parziale |

**Come è implementata oggi:**
Lo Step 1 del wizard raccoglie una descrizione testuale libera (15-2000 char) con un bottone opzionale "Analizza e Migliora" che normalizza il testo via AI. Il planner (Round 0) produce una pre-stima e una complessità stimata (LOW/MEDIUM/HIGH), ma non genera un output strutturato di comprensione del requisito.

**Note:** La comprensione del requisito è **implicita** — avviene dentro il prompt LLM ma non è esternalizzata come artefatto ispezionabile. L'utente non vede mai una rappresentazione formale di "cosa il sistema ha capito del requisito".

**Copertura: PARZIALE (20%)**

---

### Fase 2: Identificazione dei Componenti Impattati

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Mappa UI/frontend | Componente → letto/modificato/creato | Non esiste | ❌ |
| Logica applicativa | Componente → impatto | Non esiste | ❌ |
| Database/dati | Tabelle → impatto | Non esiste | ❌ |
| Integrazioni | Sistema → impatto | Non esiste | ❌ |
| Classificazione per tipo di lavoro | Leggere/modificare/creare | Non esiste | ❌ |

**Come è implementata oggi:**
Non esiste. Il sistema lavora per **attività-catalogo** (es. `PP_DV_FORM_SM`, `BE_INT_API`), non per componenti di sistema. L'AI seleziona attività dal catalogo, ma non produce mai una mappa di impatto architetturale. Il concetto di "componente" è assente dall'intera pipeline.

**Copertura: ASSENTE (0%)**

---

### Fase 3: Analisi del Flusso Logico

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Punto di ingresso | Esplicito | Non modellato | ❌ |
| Validazioni | Elencate | Non modellate | ❌ |
| Trasformazioni | Documentate | Non modellate | ❌ |
| Persistenza | Documentata | Non modellata | ❌ |
| Eccezioni/branching | Documentati | Non modellati | ❌ |
| Dipendenze funzionali | Esplicite | Non modellate | ❌ |

**Come è implementata oggi:**
Non esiste come fase formale. Le keyword deterministiche riconoscono pattern come "flusso", "workflow", "trigger" per includere attività di tipo FLOW, ma non c'è alcuna ricostruzione del flusso logico del requisito. Il modello AI probabilmente ragiona internamente sul flusso, ma questo ragionamento non è esternalizzato.

**Copertura: ASSENTE (0%)**

---

### Fase 4: Analisi dei Dati

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Entità coinvolte | Elencate formalmente | Non catturate | ❌ |
| Nuovi campi/oggetti | Documentati | Non catturati | ❌ |
| Mapping dati | Esplicito | Non catturato | ❌ |
| Volume dati | Valutato | Non catturato | ❌ |
| Performance/indicizzazione | Valutati | Non catturati | ❌ |

**Come è implementata oggi:**
DATA è una delle 8 categorie di domanda nell'intervista. Se il planner genera una domanda in categoria DATA, l'utente risponde, e la risposta influenza la selezione delle attività (es. `_LG` se i dati sono complessi). Ma non esiste un output strutturato "analisi dati" con entità, mapping, volumi.

**Copertura: ASSENTE come fase formale (5% — catturata implicitamente come categoria di domanda)**

---

### Fase 5: Analisi delle Integrazioni

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Sistemi esterni | Elencati | Non catturati formalmente | ❌ |
| Formato dati/protocolli | Documentati | Non catturati | ❌ |
| Sync/async | Valutato | Non catturato | ❌ |
| Gestione errori/retry | Documentati | Non catturati | ❌ |
| Dipendenze da terze parti | Esplicite | Non catturate | ❌ |

**Come è implementata oggi:**
Analogo alla Fase 4: INTEGRATION è una categoria di domanda. Keyword come "api", "integrazione", "webhook" triggerano attività. Ma non esiste un'analisi strutturata dei sistemi coinvolti, dei protocolli o della complessità integrativa.

**Copertura: ASSENTE come fase formale (5%)**

---

### Fase 6: Scomposizione in Attività Tecniche

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Analisi tecnica | Task specifico | ✅ Gruppo ANALYSIS nel catalogo |
| Sviluppo backend | Task specifico | ✅ Attività backend (BE_*) |
| Sviluppo frontend | Task specifico | ✅ Attività frontend (FE_*) |
| Modifica dati/query | Task specifico | ✅ Attività dati (DATA_*) |
| Modifica integrazione | Task specifico | ✅ Attività integrazione (INT_*) |
| Configurazione | Task specifico | ✅ Attività OPS/config |
| Test tecnici | Task specifico | ✅ Gruppo TEST |
| Test funzionali | Task specifico | ✅ Attività UAT/test |
| Bug fixing | Task specifico | ⚠️ Non esplicito nel catalogo |
| Documentazione | Task specifico | ✅ Attività GOVERNANCE |
| Gerarchia task (parent-child) | WBS strutturata | ❌ Lista piatta |
| Dipendenze tra task | Esplicite | ❌ Non presenti |
| Assegnazione risorse | Per task | ❌ Non presente |

**Come è implementata oggi:**
Questa è la fase **più forte** del sistema attuale. Il catalogo attività è ricco (200+ codici), organizzato per gruppo (ANALYSIS, DEV, TEST, OPS, GOVERNANCE) e per tecnologia. L'AI seleziona attività dal catalogo con ragionamento esplicito (reason + fromQuestionId per ogni attività). I size variant (_SM/_LG) modulano le ore base.

Tuttavia, la WBS è una **lista piatta** — non c'è gerarchia, non ci sono dipendenze, non c'è sequenziamento temporale.

**Copertura: PRESENTE (70%) — forte sul contenuto ma debole sulla struttura**

---

### Fase 7: Valutazione della Complessità con Driver

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Logica business | Driver con livelli | ✅ Driver configurabili (opzioni con moltiplicatore) |
| Dati | Driver | ✅ Presente come driver |
| Integrazioni | Driver | ✅ Presente come driver |
| UI | Driver | ✅ Presente come driver |
| Impatto sul sistema | Driver | ⚠️ Parziale — non specificamente isolato |
| Performance | Driver | ✅ Categoria domanda + driver |
| Affidabilità/error handling | Driver | ⚠️ Non sempre presente |
| Sicurezza | Driver | ✅ Categoria domanda + driver |
| Testabilità | Driver | ⚠️ Non specificamente isolato |
| Motivazione per punteggio | Per driver, esplicita | ✅ AI suggerisce valore con `reason` |
| Applicazione per componente | Driver applicato per componente | ❌ Applicazione uniforme globale |

**Come è implementata oggi:**
Il sistema ha driver con opzioni a moltiplicatore (es. COMPLEXITY: LOW=0.8x, MEDIUM=1.0x, HIGH=1.5x). L'AI suggerisce valori con motivazione (`suggestedDrivers[]` con `reason` e `fromQuestionId`). L'utente può accettare o modificare i valori nello Step 4.

Il limite principale è l'**applicazione uniforme**: tutti i driver moltiplicano l'intero baseDays, non è possibile applicare un driver diverso per componente o area.

**Copertura: PRESENTE (65%)**

---

### Fase 8: Distinzione tra Complessità e Tempo

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Profilo di complessità indipendente | Artefatto separato | ❌ Non esiste come entità propria |
| Complessità ≠ effort | Fasi separate | ⚠️ Driver moltiplicativi = surrogato |
| Fase intermedia di modellazione | Esplicita | ⚠️ Il prodotto driver.multiplier è la fase intermedia |

**Come è implementata oggi:**
Il sistema separa parzialmente:
- **Effort base**: ore delle attività (baseHours) → baseDays
- **Complessità**: driver moltiplicativi → driverMultiplier
- **Rischio**: peso dei rischi → contingency%

Tuttavia, non esiste un **profilo di complessità** come entità indipendente. I driver non sono una valutazione autonoma della complessità: sono moltiplicatori agganciati direttamente all'effort. Non c'è una fase in cui si dice "questo requisito ha complessità alta per logica business e media per integrazioni" senza immediatamente tradurlo in un moltiplicatore numerico.

**Copertura: PARZIALE (40%)**

---

### Fase 9: Conversione in Effort

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Mapping score → intervallo | Opzione A | ❌ Non presente — va diretto a giorni |
| Somma task + fattori correttivi | Opzione B | ✅ baseDays × driverMult × (1+contingency) |
| Logica leggibile | Sì | ✅ Formula deterministica, visibile, replicabile |
| Logica giustificabile | Motivazione | ⚠️ AI reasoning è testo libero, non strutturato |

**Come è implementata oggi:**
La formula è chiara, deterministica e auditabile:
```
totalDays = (Σ baseHours / 8) × Π(driverMultiplier) × (1 + contingency%)
```
Il sistema usa l'Opzione B del target (somma task + fattori correttivi). L'opzione A (score → intervallo) non è presente.

**Copertura: PRESENTE (75%)**

---

### Fase 10: Gestione di Rischi, Ipotesi e Incertezza

| Aspetto | Target | Implementazione attuale | Copertura |
|---|---|---|---|
| Rischi | Catalogati con peso | ✅ Tabella `risks` con weight |
| Assumptions | Documentate | ❌ Non catturate in modo strutturato |
| Esclusioni | Documentate | ❌ Non catturate |
| Variabili non note | Documentate | ❌ Non catturate |
| Dipendenze esterne | Documentate | ❌ Non catturate |
| Effort base | Distinguibile | ✅ `baseDays` prima dei moltiplicatori |
| Contingency/buffer | Distinguibile | ✅ `contingencyDays` calcolato separatamente |
| Incertezza | Espressa come intervallo | ⚠️ Pre-stima (Round 0) ha minHours/maxHours ma non persistita |

**Come è implementata oggi:**
I **rischi** sono ben gestiti: catalogo con pesi, selezione utente, aggregazione in riskScore, conversione in contingency%. L'effort base è distinto dalla contingency.

Le **assunzioni**, **esclusioni**, **variabili non note** e **dipendenze esterne** **non esistono** come concetti formali nel sistema. L'AI reasoning può contenerne menzione in testo libero, ma non sono salvate come campi strutturati.

L'intervallo di incertezza della pre-stima (minHours/maxHours) è **effimero** — usato solo per la decisione ASK/SKIP e poi scartato.

**Copertura: PARZIALE (40%)**

---

### Fase 11: Output Strutturato Completo

| Campo target | Presente nell'output | Note |
|---|---|---|
| Sintesi requisito | ⚠️ Titolo generato (max 60 char) | Non è una vera sintesi |
| Componenti impattati | ❌ | Non catturati |
| Attività tecniche | ✅ | Con ore, ragione, da quale domanda |
| Driver di complessità | ✅ | Con valore, moltiplicatore, ragione |
| Effort stimato | ✅ | totalDays con breakdown completo |
| Rischi | ✅ | Codici selezionati con pesi |
| Assumptions | ❌ | Non catturate |
| Esclusioni | ❌ | Non catturate |
| Motivazione della stima | ⚠️ | `aiReasoning` è testo libero, non strutturato per fase |

**Come è implementata oggi:**
L'output salvato contiene: totalDays, baseDays, driverMultiplier, riskScore, contingencyPercent, attività (con flag AI), driver (con valore selezionato), rischi, e `ai_reasoning` come testo. Senior consultant analysis aggiunge: discrepancies, risk analysis, implementation tips.

Ma mancano: sintesi strutturata, mappa componenti, assunzioni, esclusioni, e una motivazione organizzata per fase.

**Copertura: PARZIALE (55%)**

---

### Fase 12: Principio Architetturale Fondante

| Aspetto | Target | Implementazione attuale |
|---|---|---|
| Stima del lavoro complessivo | Capire + modificare + integrare + testare + correggere + incertezza | ⚠️ Parziale |
| Pipeline di ragionamento | Multi-step, ogni fase produce output | ⚠️ Multi-round AI, ma non multi-fase analitica |
| Non "tempo di scrittura codice" | Il lavoro include analisi, comprensione, test, correzione | ✅ Le attività includono ANALYSIS, TEST, GOVERNANCE, OPS |

**Come è implementata oggi:**
Il catalogo attività è progettato per catturare il lavoro oltre la scrittura di codice: include analisi, test, governance, deploy, documentazione. In questo senso il principio è rispettato a livello di **contenuto**.

Tuttavia, il **processo** non è una pipeline di ragionamento multi-fase: è un ciclo raccolta-input → AI seleziona attività → utente configura driver → calcolo. La comprensione del requisito e l'analisi della complessità avvengono **implicitamente dentro il prompt AI**, non come fasi osservabili e auditabili.

**Copertura: PARZIALE (50%)**

---

## 5. Differenze Architetturali Principali

### 5.1 Paradigma di stima

| | Attuale | Target |
|---|---|---|
| **Metafora** | Selettore di attività assistito da AI | Pipeline di ragionamento strutturato |
| **Approccio** | Descrizione → AI → lista attività → calcolo | Descrizione → analisi multi-fase → profilo complessità → breakdown → effort |
| **Granularità analitica** | Una singola fase analitica (AI) | 6+ fasi analitiche distinte e ispezionabili |

**Implicazione:** Nel sistema attuale, la "comprensione" del requisito, l'identificazione dei componenti, l'analisi dei dati, l'analisi delle integrazioni e il flusso logico **avvengono tutti in un singolo prompt LLM** — il Round 1 di stima. Questo rende il ragionamento opaco e non auditabile per fase.

### 5.2 Modello dei dati di stima

| | Attuale | Target |
|---|---|---|
| **Entità principale** | `estimation` con attività/driver/rischi pivot | Estimation con profilo di complessità, breakdown gerarchico, assunzioni, esclusioni |
| **Complessità** | Moltiplicatori uniformi globali | Profilo multi-dimensionale per area |
| **Incertezza** | Contingency deterministica da riskScore | Intervallo di stima, buffer esplicito, variabili non note |

### 5.3 Trasparenza del processo

| | Attuale | Target |
|---|---|---|
| **Motivazione** | `ai_reasoning` (testo libero) | Motivazione strutturata per fase |
| **Auditabilità** | Log di esecuzione agentica (telemetria) | Output ispezioneazionabile per ogni step |
| **Ripetibilità** | Formula deterministica, ma prompt AI non completamente deterministico | Ogni fase produce artefatto stabile |

### 5.4 Ruolo dell'AI

| | Attuale | Target |
|---|---|---|
| **AI fa** | Seleziona attività + suggerisce driver/rischi | Guida ogni fase analitica producendo artefatti intermedi |
| **Utente fa** | Descrive requisito + configura driver/rischi + salva | Valida e arricchisce ogni fase |
| **Punto di controllo** | Post-selezione (Step 4-5) | Ad ogni fase analitica |

### 5.5 Gestione dell'incertezza

| | Attuale | Target |
|---|---|---|
| **Tipo** | Contingency % deterministica (10-25%) | Rischi + ipotesi + esclusioni + variabili non note + buffer |
| **Granularità** | Un solo numero (riskScore → contingency%) | Multi-dimensionale, esplicabile |
| **Persistenza** | Contingency calcolata ma intervallo pre-stima effimero | Tutto l'intervallo di incertezza persistito |

---

## 6. Anti-pattern e Limiti dell'Implementazione Attuale

### 6.1 Stima come "Black Box" AI

**Problema:** L'intera analisi del requisito (comprensione, componenti, flusso, dati, integrazioni) avviene implicitamente dentro un singolo prompt LLM. L'utente vede solo l'output finale (lista attività + reasoning testuale).

**Rischio:** Impossibilità di validare il ragionamento intermedio. Se l'AI sbaglia l'analisi del requisito, l'errore si propaga silenziosamente nella selezione delle attività.

### 6.2 Coupling tra raccolta dati e scoring

**Problema:** Le domande dell'intervista (Round 0) e la selezione delle attività (Round 1) sono accoppiate: le domande sono scelte in base all'impatto sulla riduzione dell'intervallo di stima, non sulla comprensione del requisito. L'intervista serve a migliorare la stima, non a capire il requisito.

**Rischio:** Domande importanti per la comprensione ma a basso impatto sulla stima possono essere omesse.

### 6.3 Flat Activity List vs. Hierarchical WBS

**Problema:** Le attività sono una lista piatta senza gerarchie, dipendenze o sequenziamento. Non è possibile raggruppare task in macro-aree di lavoro o stabilire precedenze.

**Rischio:** Per requisiti complessi, una lista di 15-20 attività flat non comunica la struttura del lavoro e rende difficile il tracking dell'esecuzione.

### 6.4 Driver uniformi (non per componente)

**Problema:** I moltiplicatori dei driver vengono applicati all'intero baseDays. Non è possibile dire "la complessità è alta per il backend ma bassa per il frontend".

**Rischio:** Sovrastima o sottostima sistematica per requisiti con complessità disomogenea tra aree tecniche.

### 6.5 Assunzioni ed esclusioni implicite

**Problema:** Non c'è modo strutturato di documentare cosa è incluso e cosa è escluso dalla stima. Le assunzioni dell'AI sono incorporate nel reasoning testuale ma non estraibili.

**Rischio:** Scope creep, contestazioni sulla stima, impossibilità di distinguere tra "non stimato" e "stimato a zero".

### 6.6 Intervallo di incertezza effimero

**Problema:** La pre-stima (Round 0) produce un intervallo minHours/maxHours ma questo non viene persistito. L'utente vede solo il punto di stima finale (totalDays).

**Rischio:** Falsa precisione. Una stima di "12.50 giorni" senza contesto di incertezza è meno utile di "10-15 giorni con 12.50 come stima centrale".

### 6.7 Complessità ≡ Moltiplicatore

**Problema:** La complessità non è un concetto indipendente nel sistema — è sempre un moltiplicatore. Non esiste un "profilo di complessità" che possa essere analizzato prima di calcolare l'effort.

**Rischio:** Impossibilità di confrontare la complessità di due requisiti indipendentemente dal loro effort base.

---

## 7. Gap Analysis

### 7.1 Cosa manca per arrivare al modello target

| Gap | Descrizione | Criticità |
|---|---|---|
| **Requirement Understanding Module** | Fase formale di comprensione del requisito con output strutturato (obiettivo, perimetro, attori, stato iniziale/finale) | 🔴 Alta |
| **Component Impact Map** | Mappa dei componenti/moduli di sistema impattati, con classificazione leggere/modificare/creare | 🔴 Alta |
| **Logical Flow Analysis** | Ricostruzione del flusso operativo del requisito (ingresso → validazione → trasformazione → persistenza → output) | 🟡 Media |
| **Data Analysis Phase** | Analisi strutturata di entità, campi, volumi, mapping, performance | 🟡 Media |
| **Integration Analysis Phase** | Analisi strutturata dei sistemi esterni, protocolli, sync/async, error handling | 🟡 Media |
| **Hierarchical WBS** | Work breakdown con gerarchia, dipendenze, sequenziamento | 🔴 Alta |
| **Independent Complexity Profile** | Profilo di complessità multi-dimensionale separato dall'effort | 🟡 Media |
| **Per-component Drivers** | Applicazione dei driver per area/componente anziché uniforme | 🟡 Media |
| **Assumptions/Exclusions** | Campi strutturati per ipotesi, esclusioni, variabili non note, dipendenze esterne | 🔴 Alta |
| **Uncertainty Range** | Persistenza dell'intervallo di incertezza (min/max/stima centrale) | 🟡 Media |
| **Phased Reasoning Output** | Motivazione strutturata per fase analitica, non testo libero | 🟡 Media |

### 7.2 Cosa va rifattorizzato

| Componente | Refactoring necessario |
|---|---|
| **Pipeline AI (Round 0 + Round 1)** | Scomporre il singolo prompt LLM in fasi analitiche distinte, ciascuna con output strutturato |
| **Data Model** | Aggiungere tabelle/colonne per: component_impact, complexity_profile, assumptions, exclusions, uncertainty_range |
| **Wizard UI** | Aggiungere step intermedi per validazione delle analisi (componenti, flusso, dati, integrazioni) |
| **EstimationEngine** | Supportare driver per componente e profilo di complessità indipendente |
| **Output** | Ristrutturare l'output finale per includere tutte le fasi analitiche |

### 7.3 Cosa può essere riusato

| Componente | Riusabilità | Note |
|---|---|---|
| **Catalogo attività** | ✅ Alta | Già strutturato per gruppo e tecnologia, buona copertura |
| **Driver framework** | ✅ Alta | L'architettura è estendibile per supportare driver per componente |
| **Risk framework** | ✅ Alta | Funziona bene, serve aggiungere assumptions/exclusions |
| **EstimationEngine SDK** | ✅ Alta | Formula solida, deterministica, testabile |
| **Pipeline agentica** | ✅ Alta | DRAFT→REFLECT→REFINE è un buon pattern, va esteso con più fasi |
| **RAG + Vector Search** | ✅ Alta | Già funzionante per similarità storica |
| **Intervista tecnica** | ✅ Media | Le 8 categorie sono un buon punto di partenza per le fasi analitiche |
| **Prompt engineering** | ⚠️ Media | Va ristrutturato per produrre output multi-fase |
| **Telemetria** | ✅ Alta | Già solida, va estesa per le nuove fasi |
| **Export PDF/CSV** | ✅ Alta | Va arricchito con le nuove sezioni |

---

## 8. Proposta di Evoluzione

### 8.1 Roadmap di Alto Livello

#### Fase A — Foundation (Quick Wins)
**Priorità: Alta | Effort: Medio**

1. **Aggiungere campi assumptions/exclusions** al data model e al wizard
   - Nuove colonne in `estimations` o tabella dedicata `estimation_assumptions`
   - Step nel wizard per inserire/validare ipotesi ed esclusioni
   - L'AI suggerisce assunzioni nel reasoning → estrazione strutturata

2. **Persistere l'intervallo di incertezza**
   - Salvare minDays/maxDays dalla pre-stima (Round 0) nell'estimation
   - Mostrare l'intervallo nell'output insieme al punto di stima

3. **Strutturare il reasoning per sezione**
   - Invece di un singolo `ai_reasoning: string`, salvare un JSON con sezioni (comprensione, attività, driver, rischi)
   - Impatto minimo su prompt, alto su trasparenza

#### Fase B — Analytical Enrichment
**Priorità: Alta | Effort: Alto**

4. **Requirement Understanding Module**
   - Nuovo step post-descrizione: l'AI produce un output strutturato (obiettivo, perimetro, attori, precondizioni)
   - L'utente valida prima di procedere alla stima
   - Diventa il "contratto" su cui si basa la stima

5. **Component Impact Map**
   - L'AI analizza il requisito e produce una mappa: {frontend, backend, database, integrazioni, configurazioni} × {leggere, modificare, creare}
   - Nuovo step nel wizard, nuovo tipo nel data model

6. **Phase-specific analysis outputs**
   - Analisi dati (se pertinente): entità, campi, volumi
   - Analisi integrazioni (se pertinente): sistemi, protocolli, sync/async
   - Attivate condizionalmente in base al requisito

#### Fase C — Structural Maturity
**Priorità: Media | Effort: Alto**

7. **Hierarchical WBS**
   - Raggruppare attività in macro-aree (es. Backend, Frontend, Test, Deploy)
   - Aggiungere dipendenze opzionali tra macro-aree
   - Nuovo modello dati: `estimation_task_groups` con parent-child

8. **Independent Complexity Profile**
   - Nuova entità `complexity_profile`: {logica_business, dati, integrazioni, UI, impatto_sistema, performance, sicurezza, testabilità} × {none, low, medium, high, very_high}
   - Calcolato dall'AI, validato dall'utente, usato come input per il calcolo dell'effort
   - I driver attuali diventano la "traduzione" del profilo in moltiplicatori

9. **Per-component Driver Application**
   - I driver possono essere applicati per gruppo di attività anziché globalmente
   - Es. complessità HIGH solo sulle attività backend, MEDIUM sul frontend

#### Fase D — Process Maturity
**Priorità: Media-Bassa | Effort: Medio**

10. **Multi-step Pipeline Visibility**
    - L'utente vede ogni fase analitica come un tab/step nel wizard
    - Ogni fase mostra l'artefatto AI + possibilità di override
    - Il reasoning finale è la composizione di tutti gli artefatti

11. **Logical Flow Visualization**
    - Per requisiti complessi: diagramma di flusso generato dall'AI
    - Opzionale, attivabile per requisiti HIGH

### 8.2 Priorità consigliate

```
[Immediato]  Assumptions/exclusions + Intervallo incertezza + Reasoning strutturato
[Breve]      Requirement Understanding Module + Component Impact Map
[Medio]      Hierarchical WBS + Complexity Profile indipendente
[Lungo]      Per-component drivers + Multi-step pipeline visibility
```

---

## 9. Conclusione

### Valutazione finale

Il sistema attuale è un prodotto **tecnicamente maturo e ben ingegnerizzato** per il paradigma che implementa: un selettore di attività AI-assisted con validazione agentica, RAG storico e calcolo deterministico. La qualità ingegneristica (reflection loop, variance reduction, telemetria, guardrail) è notevole.

Tuttavia, confrontato con l'architettura target, il gap è **strutturale, non implementativo**: non si tratta di aggiungere feature al sistema attuale, ma di ripensare il modello concettuale della stima. Il target chiede una **pipeline di ragionamento multi-fase con artefatti intermedi ispezionabili**, dove l'attuale sistema implementa una **pipeline AI opaca con output finale strutturato**.

### Principali insight

1. **Il sistema è forte dove il target è semplice (calcolo effort) e debole dove il target è ricco (analisi strutturata).** Le fasi 1-5 del target (comprensione, componenti, flusso, dati, integrazioni) sono quasi totalmente assenti, mentre le fasi 6-9 (scomposizione, driver, conversione) sono ben coperte.

2. **L'intelligence è concentrata nell'AI, non nel processo.** Il sistema si affida a un LLM molto capace per fare un salto diretto "descrizione → attività", dove il target chiede un processo graduato con validazione umana intermedia. Se l'AI sbaglia l'analisi (che è implicita), l'errore è silenzioso.

3. **Il refactoring più impattante non è tecnico ma concettuale.** Aggiungere fasi analitiche strutturate richiede ridisegnare il flusso di lavoro, non solo aggiungere tabelle. Il wizard da 5 step dovrebbe diventare un processo a 8-10 step con checkpoint di validazione.

4. **L'infrastruttura esistente è un ottimo punto di partenza.** La pipeline agentica, il RAG, il vector search, la reflection, la telemetria e il catalogo attività sono tutti riusabili in un'architettura più ricca. Il redesign è additivo, non sostitutivo.

5. **La priorità numero uno è la trasparenza.** Il gap più critico non è la mancanza di analisi (che l'AI probabilmente fa internamente) ma la **mancanza di esternalizzazione**: l'utente non può vedere, validare o correggere il ragionamento intermedio. Rendere visibile ciò che l'AI già fa internamente è il primo passo verso l'architettura target.
