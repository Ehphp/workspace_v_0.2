# Selezione Attività — Schema Definitivo

> **A cosa serve questo doc**
> Capire **come, quando e perché** un'attività finisce nella stima.
> Letto dall'alto al basso ti dà il modello mentale completo. Usato come reference, vai direttamente alla sezione che ti serve.

---

## TL;DR (a colpo d'occhio)

```
┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│   INPUT     │──▶│   SEGNALI   │──▶│  CANDIDATI   │──▶│   DECISIONE  │──▶ ATTIVITÀ
│             │   │             │   │              │   │              │      FINALI
│ requisito + │   │  5 fonti    │   │ score pesato │   │  5 fasi      │
│ artefatti   │   │             │   │ + primary    │   │  filtranti   │
└─────────────┘   └─────────────┘   └──────────────┘   └──────────────┘
   wizard           extractors      CandidateSynth.    DecisionEngine
                                    (catalogo+score)   (regole+cap)
```

**3 concetti chiave:**

1. **Score** = `Σ (contributo_fonte × peso_fonte) / Σ pesi_attivi` — media pesata dei contributi delle fonti che hanno parlato di quel codice.
2. **`primarySource`** = la fonte col contributo *pesato più alto* per quel candidato. **Non** è l'unica fonte: è solo quella che ha pesato di più.
3. **"Selezionata"** = è passata da **tutte e 5** le fasi della `DecisionEngine`.

---

## 1. Le 5 fonti di segnali

| Fonte               | Peso | Da dove arriva                                    | Tipica di…                                     |
|---------------------|:----:|---------------------------------------------------|------------------------------------------------|
| `project-activity`  | 4.0  | Attività custom del progetto (`PRJ_*`)            | Calibrazione progetto: vince sempre se presente |
| `blueprint`         | 3.0  | `EstimationBlueprint` (componenti/integrazioni/dati/test) | Mapping strutturale deterministico             |
| `impact-map`        | 2.0  | `ImpactMap` (azioni × layer)                      | Comprensione tecnica del cambiamento           |
| `understanding`     | 1.5  | `RequirementUnderstanding` (perimetro, complessità) | Contesto + classificazione                     |
| `keyword`           | 1.0  | Match testuale su descrizione + risposte interview | Baseline — sempre presente                     |

> **Nota:** `context` (0.5) e `manual` (0.0) esistono come tipi ma in produzione non sono attivamente alimentati.

### `topN` keyword dinamico

I segnali keyword sono "supplementari" quando ci sono artefatti ricchi. Il numero di candidati keyword scende man mano che salgono gli artefatti:

| Artefatti attivi | `topN` keyword |
|:----------------:|:--------------:|
| 0                | 15             |
| 1                | 12             |
| 2                | 10             |
| 3                | 8              |

Formula: `Math.max(8, 15 - artifactSignalCount * 2)` in `run-estimation-pipeline.ts:173`.

---

## 2. Come nasce uno Score (esempio worked-out)

Per ogni `activityCode` toccato da almeno un segnale:

```
score(code) = Σ (best_score_per_fonte × peso_fonte)
              ───────────────────────────────────────
                       Σ pesi_fonti_presenti
```

**Esempio reale:**

```
Candidato: PP_DV_FORM
  blueprint     contributo 0.95   ×  peso 3.0  =  2.85
  impact-map    contributo 0.80   ×  peso 2.0  =  1.60
  keyword       contributo 0.50   ×  peso 1.0  =  0.50
  ──────────────────────────────────────────────────────
  somma pesata  = 4.95
  somma pesi    = 3.0 + 2.0 + 1.0 = 6.0
  SCORE FINALE  = 4.95 / 6.0  =  0.825

primarySource = blueprint  (2.85 è il contributo pesato più alto)
contributions  = { blueprint: 0.95, impactMap: 0.80, keyword: 0.50 }
```

Codice in `candidate-synthesizer.ts:248-268`.

> **Importante:** `contributions` (visibili nell'`ActivityTable` come `bp/im/un/kw`) sono i **contributi grezzi**, NON pesati. Servono a vedere chi ha parlato e quanto. Lo score finale è la media pesata.

---

## 3. La `DecisionEngine` — 5 fasi in ordine

Tutte e 5 vengono sempre eseguite. Ogni fase produce voci di `decisionTrace` (visibili nel debug).

```
┌──────────────────────┐
│ 1. SCORE GATE        │  score >= 0.5  →  passa
│                      │  altrimenti    →  excluded
└──────────────────────┘
           ▼
┌──────────────────────┐
│ 2. MANDATORY KEYWORD │  parole-chiave nel requisito → forza include
│                      │  (anche se score < 0.5)
└──────────────────────┘
           ▼
┌──────────────────────┐
│ 3. COVERAGE ENFORCE  │  layer HIGH scoperto + best candidate >= 0.25
│                      │  →  forza include
└──────────────────────┘
           ▼
┌──────────────────────┐
│ 4. REDUNDANCY        │  stesso gruppo + stesso layer
│                      │  →  tieni solo il migliore (PRJ batte globale)
└──────────────────────┘
           ▼
┌──────────────────────┐
│ 5. TOP-K CAP         │  selected.length > 10
│                      │  →  rimuovi i più deboli (no coverage, no mandatory)
└──────────────────────┘
           ▼
       SELECTED
```

### Fase 1 — Score Gate

- **Threshold:** `minScore = 0.5` (config `DEFAULT_CONFIG`)
- Sotto soglia → `excluded` (può rientrare nelle fasi 2 o 3)
- File: `decision-engine.ts:97`

### Fase 2 — Mandatory Keyword

- Regole hardcoded in `mandatory-rules.ts` per tech category
- Match con **word boundary `\b`** (regex), non `includes()` → "ui" non matcha "recruiting"
- Se la parola compare → forza inclusione del prefix
- Tre vie:
  1. Già selezionato → conferma
  2. Era escluso → riportato dentro
  3. Non era candidato → creato sintetico (`score 0.1`, source `keyword-fallback`)
- File: `decision-engine.ts:133`

### Fase 3 — Coverage Enforcement

- Solo per layer `HIGH`: **frontend, logic, data**
- Se nessun candidato selezionato copre il layer → cerca il miglior escluso per quel layer
- **Filtro anti-rumore:** lo aggiunge solo se `best.score >= minCoverageScore (0.25)`. Sotto, lascia il gap aperto (forzare un'attività con score 0.05 inquina di più di quanto aggiunga).
- File: `decision-engine.ts:216`

### Fase 4 — Redundancy Elimination

- Chiave di gruppo: prefisso senza suffisso `_SIMPLE`/`_COMPLEX`
- Chiave di confronto: `${groupPrefix}::${layer}`
- Stesso slot → tieni quello con **score più alto**
- **Eccezione progetto:** `PRJ_*` rimpiazza una globale per lo stesso slot, **indipendentemente dallo score** (calibrazione progetto vince)
- File: `decision-engine.ts:286`

### Fase 5 — Top-K Cap

- **`maxSelected = 10`**
- Se `selected > 10`: ordina per score crescente e rimuove i più deboli
- **Protetti** dal cap:
  - Aggiunti da Coverage (fase 3)
  - Aggiunti da Mandatory (fase 2)
- **NON protetti:** PRJ_*. La loro forza viene già dal peso 4.0 nello score, proteggerli qui li lascerebbe monopolizzare gli slot.
- File: `decision-engine.ts:351`

---

## 4. Lettura del Debug Dashboard

### Card "Pipeline Trace" — header
- **`agentic`** vs **`deterministic-fallback`** = quale path è stato preso
- **`conf X%`** = `aggregateConfidence` calcolata sugli artefatti disponibili
- **`overlap X%`** = quanto la selezione dell'agente coincide con la deterministica baseline (solo path agentic)
- **`stale`** = artefatti più recenti del blueprint → segnale potenzialmente obsoleto

### Sezione "Signal Sources"
| Colonna             | Significato                                                                      |
|---------------------|----------------------------------------------------------------------------------|
| Badge fonte         | Nome della fonte (con colore convenzionale)                                      |
| `N signals`         | Quanti `NormalizedSignal` ha emesso quella fonte                                 |
| Barra + `XX%`       | **`primarySourceShare`** — in quanti candidati selezionati è la fonte primaria   |
| `avg X.XX`          | Score medio dei top-N candidati di quella fonte                                  |
| Riga **dashed** (silent) | Fonte che ha attribuito candidati ma **non ha un proprio SignalSet** (es: PRJ via blueprint) |

### Sezione "Agent Delta vs Deterministic"
- `overlap` = % di codici comuni tra agente e baseline deterministica
- `+N added` = scelte dall'agente, non dal deterministic
- `−N removed` = scartate dall'agente, ma presenti nel deterministic

### Sezione "Decision Trace"
Una riga per **ogni** decisione fatta da `DecisionEngine`:

| Colonna  | Cosa contiene                                            |
|----------|----------------------------------------------------------|
| Step     | `score-gate` / `mandatory-keyword` / `coverage` / `redundancy` / `top-k-cap` |
| Action   | `select` / `exclude` / `add-coverage` / `add-mandatory`  |
| Code     | Codice dell'attività                                     |
| Reason   | Stringa human-readable (es: `"Score 0.85 >= threshold 0.5"`) |
| Score    | Score corrente del candidato                             |

### Sezione "Activity Table" (attività selezionate)
| Colonna             | Significato                                                          |
|---------------------|----------------------------------------------------------------------|
| Code (mono)         | Codice — troncato se lungo                                           |
| Nome                | Descrizione human-readable                                           |
| Badge fonte         | `primarySource` di quel candidato                                    |
| Score (mono)        | Score finale dopo merge pesato                                       |
| `Nh`                | Ore base (pre-complessità)                                           |
| Barre `bp/im/un/kw/pa` | Contributi **grezzi** per ogni fonte che ha parlato del codice    |
| Reason              | Motivo della selezione (LLM se path agentic, regola se deterministic) |

### Card "Artifact Bar"
4 indicatori (blueprint / impact-map / understanding / project-activity):
- **Verde** = trovato in DB e usato
- **Strikethrough** = mancante o disabilitato dal kill switch

---

## 5. FAQ veloci

### Q: Una fonte ha N signal ma 0% — è un bug?
**No.** `primarySourceShare` misura il **dominio**, non la presenza. 0% significa: "ha contribuito agli score, ma non è mai stata la fonte col contributo più alto in nessun candidato". Vedi i contributi grezzi nelle barre `bp/im/...` dell'`ActivityTable` per la presenza effettiva.

### Q: La somma delle percentuali in Signal Sources non fa 100 — perché?
Perché conta solo le fonti che vincono in qualche candidato (il `primarySource`). Le **silent sources** (riga dashed) colmano il gap mostrando le fonti che hanno attribuito candidati senza avere un proprio SignalSet. Esempio tipico: un `PRJ_*` può essere attribuito tramite blueprint match.

### Q: Perché agentic seleziona ~4 attività e deterministic ~10?
Perché:
- L'agente filtra con **giudizio semantico** (capisce che 7 candidati simili sono ridondanti)
- Il deterministic applica solo **soglie numeriche** (`minScore 0.5`, `maxSelected 10`)
- Il vero filtro qualitativo è la soglia, ma il keyword decay lineare (rank 1 → 1.0, rank N → 0.1) può tenere artificialmente alto lo score di candidati marginali
- Il cap a 10 è **l'ultimo paracadute**, non il filtro principale

### Q: "Forzato da regola mandatoria: keyword 'ui' → PP_DV_FORM" su un requisito che non contiene "ui" — perché?
**Bug risolto.** Era `String.includes('ui')` che matchava "build", "recruiting", ecc. Ora è regex `\bui\b` con word boundary in `mandatory-rules.ts`.

### Q: Nel deterministico vedo solo PRJ_* attività — perché?
**Bug risolto.** Il `topKCap` proteggeva incondizionatamente i `PRJ_*`, lasciandoli monopolizzare i 10 slot. Ora competono per score: il loro vantaggio (peso 4.0) li tiene comunque alti, ma non li immunizza dal cap.

### Q: Decision Trace e Signal Sources % funzionano in entrambi i path?
Sì. La `DecisionEngine` viene **sempre** eseguita per produrre la baseline; nel path agentic il suo trace è disponibile in parallelo all'output dell'agente. `primarySourceShare` è ricalcolato uguale in entrambe le path (fix recente in `ai-estimate-from-interview.ts`).

---

## 6. Riferimenti file

| Concetto                          | File                                                            |
|-----------------------------------|-----------------------------------------------------------------|
| Pipeline pura (no I/O)            | `netlify/functions/lib/domain/estimation/run-estimation-pipeline.ts` |
| Sintesi candidati + scoring       | `netlify/functions/lib/domain/pipeline/candidate-synthesizer.ts` |
| Decision engine (5 fasi)          | `netlify/functions/lib/domain/pipeline/decision-engine.ts`       |
| Config + tipi DecisionEngine      | `netlify/functions/lib/domain/pipeline/decision-engine.types.ts` |
| Pesi fonti + layer priority       | `netlify/functions/lib/domain/pipeline/pipeline-domain.ts`       |
| Mandatory rules                   | `netlify/functions/lib/domain/pipeline/mandatory-rules.ts`       |
| Handler agentic + fallback        | `netlify/functions/ai-estimate-from-interview.ts`                |
| Dashboard standalone              | `src/pages/dev/PipelineDebug.tsx`                                |
| Dashboard tab nel requirement     | `src/components/requirements/detail/tabs/PipelineDebugTab.tsx`   |
| Trace card                        | `src/components/estimation/debug/PipelineTraceCard.tsx`          |
| Tabella attività                  | `src/components/estimation/debug/ActivityTable.tsx`              |
