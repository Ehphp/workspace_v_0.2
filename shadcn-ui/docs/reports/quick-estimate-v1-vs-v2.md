# Quick Estimate: confronto V1 vs V2

> Documento di confronto tra i due flussi di stima rapida disponibili nel sistema Syntero.

---

## 1. Panoramica

| Aspetto | V1 (`useQuickEstimation`) | V2 (`useQuickEstimationV2`) |
|---|---|---|
| **Filosofia** | Singola chiamata AI → calcolo deterministico | Pipeline multi-artefatto → calcolo deterministico |
| **Endpoint AI** | `ai-suggest` (1 chiamata) | 5 endpoint in sequenza: understanding → impact-map → blueprint → interview-planner → estimation |
| **Modello LLM** | gpt-5 (via `suggest-activities`) | gpt-4o-mini (artefatti) + gpt-4o (estimation) |
| **Funzione deterministica** | `quickFinalizeEstimation()` | `interviewFinalizeEstimation()` |
| **Driver & Risk** | Defaults neutri del preset | AI-suggested (calibrati sul requisito) |
| **Confidenza** | Non calcolata | Score 0–1, policy di escalation |
| **Artefatti AI** | Nessuno | Understanding, Impact Map, Blueprint, pre-stima |
| **UX di attesa** | Spinner semplice | AI Thinking Stream (chat feed + typewriter + shimmer) |
| **Abort/Cancel** | Non supportato | Supportato (abort ref) |
| **Trace/Observability** | Nessuna | traceId + per-step timing + log strutturato |
| **Escalation** | Non prevista | Automatica (confidenza < 0.60 o planner = ASK) |
| **Demo mode fallback** | MOCK_TECHNOLOGIES | MOCK_TECHNOLOGIES + MOCK_ACTIVITIES + MOCK_DRIVERS + MOCK_RISKS |

---

## 2. Architettura del flusso

### V1 — Singola chiamata

```
┌─────────────┐
│  User Input  │ description + techPresetId
└──────┬──────┘
       │
       ▼
┌──────────────┐     POST /ai-suggest
│ suggestActivities() │────────────────────► Netlify Function
│ (src/lib/openai.ts) │◄────────────────────  { activityCodes, reasoning }
└──────┬───────┘
       │
       │  Filter codes vs allowedActivities
       │  Fallback → defaultCodesFromPivot (technology_activities FK)
       ▼
┌────────────────────────┐
│ quickFinalizeEstimation │  Driver values = preset defaults (1.0)
│ (estimation-utils.ts)   │  Risk adjustments = nessuno
└──────────┬─────────────┘
           │
           ▼
    FinalizedEstimation
    { totalDays, totalHours, breakdown[] }
```

**Caratteristiche chiave V1:**
- 1 sola chiamata di rete verso l'AI
- L'AI restituisce solo `activityCodes[]` + `reasoning` + `isValidRequirement`
- I driver rimangono a valore neutro (nessun adjustment)
- I rischi non sono applicati
- Nessun artefatto intermedio è prodotto o conservato
- L'utente vede solo il risultato finale

### V2 — Pipeline multi-artefatto

```
┌─────────────┐
│  User Input  │ description + techPresetId + projectContext?
└──────┬──────┘
       │
  ┌────▼───────────────────────────────────────────────────────┐
  │                    PIPELINE ORCHESTRATOR                     │
  │                 (useQuickEstimationV2 hook)                  │
  │                                                              │
  │  Step 0: loadMasterData ─────────► Supabase (cached)         │
  │     ↓                                                        │
  │  Step 1: Understanding ──────────► ai-requirement-understanding│
  │     ↓  artifacts.understanding                                │
  │     ↓  ⟵ liveInsight: "Obiettivo identificato: ..."         │
  │     ↓                                                        │
  │  Step 2: Impact Map ─────────────► ai-impact-map              │
  │     ↓  artifacts.impactMap                                    │
  │     ↓  ⟵ liveInsight: "3 layer architetturali impattati"    │
  │     ↓                                                        │
  │  Step 3: Blueprint ──────────────► ai-estimation-blueprint    │
  │     ↓  artifacts.blueprint                                    │
  │     ↓  ⟵ liveInsight: "5 componenti, confidenza 82%"        │
  │     ↓                                                        │
  │  Step 4: Interview Planner ──────► ai-requirement-interview   │
  │     ↓  decision = ASK | SKIP                                  │
  │     ↓  preEstimate = { minHours, maxHours, confidence }       │
  │     ↓  ⟵ liveInsight: "Requisito chiaro — stima diretta"    │
  │     ↓                                                        │
  │  Step 5: Estimation ─────────────► ai-estimate-from-interview │
  │     ↓  activities[], suggestedDrivers[], suggestedRisks[]     │
  │     ↓  reasoning, confidenceScore                             │
  │     ↓                                                        │
  │  Step 6: Finalize ───────────────► interviewFinalizeEstimation│
  │     ↓  Driver values = AI-calibrated                          │
  │     ↓  Risk adjustments = AI-suggested                        │
  │     ↓                                                        │
  │  Escalation check (confidence + planner decision)             │
  └────┬───────────────────────────────────────────────────────┘
       │
       ▼
  QuickEstimationV2Result
  { estimation, activities, reasoning, confidenceScore,
    suggestedDrivers, artifacts, trace, shouldEscalate }
```

**Caratteristiche chiave V2:**
- 5 chiamate AI sequenziali (ciascuna entro il timeout Netlify di 26s)
- Ogni artefatto alimenta il successivo (cascading context)
- Ogni step è **soft-optional**: se fallisce, la pipeline continua degradata
- I driver sono calibrati dall'AI sul requisito specifico
- I rischi sono suggeriti dall'AI in base all'analisi
- Live insights mostrati durante l'esecuzione
- traceId per correlazione e debugging

---

## 3. Confronto AI endpoint

| Endpoint | V1 | V2 | Modello | Timeout |
|---|---|---|---|---|
| `ai-suggest` | Unico endpoint | Non usato | gpt-5 | 26s |
| `ai-requirement-understanding` | — | Step 1 | gpt-4o-mini | 26s |
| `ai-impact-map` | — | Step 2 | gpt-4o-mini | 26s |
| `ai-estimation-blueprint` | — | Step 3 | gpt-4o-mini | 26s |
| `ai-requirement-interview` | — | Step 4 | gpt-4o | 26s |
| `ai-estimate-from-interview` | — | Step 5 | gpt-4o | 26s |

**V1 totale:** 1 chiamata, ~3-8s  
**V2 totale:** 5 chiamate, ~12-25s (parallelismo non applicato: cascading input)

---

## 4. Funzione deterministica

### V1: `quickFinalizeEstimation()`

```
Input:  activityCodes, allActivities, preset, allDrivers, allRisks
Output: FinalizedEstimation { totalDays, totalHours, perActivity[] }

Logica:
- Filtra attività per codice
- Applica base_hours di ogni attività
- Driver values = tutti a 1.0 (neutri dal preset)
- Risk adjustments = nessuno
- Risultato: somma lineare senza calibrazione
```

### V2: `interviewFinalizeEstimation()`

```
Input:  activityCodes, allActivities, allDrivers, allRisks,
        suggestedDrivers[{code, suggestedValue}], suggestedRisks[], preset
Output: FinalizedEstimation { totalDays, totalHours, perActivity[] }

Logica:
- Filtra attività per codice
- Applica base_hours di ogni attività
- Driver values = AI-suggested (es. complessità = 1.3, qualità = 0.8)
- Risk adjustments = applicati per i rischi suggeriti dall'AI
- Risultato: stima calibrata sul contesto del requisito
```

**Impatto pratico:** Per lo stesso set di attività, V2 produce stime diverse da V1 perché applica driver e rischi non neutri. Una feature complessa con rischio di integrazione avrà una stima V2 più alta rispetto a V1.

---

## 5. Confronto output

### V1 output

```typescript
{
  result: FinalizedEstimation;          // { totalDays, totalHours, breakdown }
  selectedActivities: { code, name, baseHours }[];
  aiReasoning: string;                  // Singola stringa di reasoning
}
```

### V2 output

```typescript
{
  estimation: FinalizedEstimation;      // Stesso tipo, valori diversi (calibrati)
  activities: SelectedActivityWithReason[]; // Code + name + reasoning per attività
  reasoning: string;                    // Reasoning complessivo
  confidenceScore: number;              // 0–1, calcolata dall'AI
  generatedTitle?: string;              // Titolo AI-generated
  suggestedDrivers?: SuggestedDriver[]; // { code, suggestedValue, reasoning }
  suggestedRisks?: string[];            // Risk codes applicati
  artifacts: PipelineArtifacts;         // Understanding, ImpactMap, Blueprint
  trace: PipelineTrace;                 // Per-step timing e status
  shouldEscalate: boolean;              // Flag di escalation
  escalationReason?: string;            // Motivazione per il wizard completo
}
```

---

## 6. UX di attesa

### V1: Spinner statico

```
┌──────────────────────────┐
│                          │
│       🔄 (spinner)       │
│                          │
│   "Calculating..."       │
│                          │
└──────────────────────────┘
```

- Nessun feedback durante l'elaborazione
- L'utente non sa a che punto è
- Durata: 3-8 secondi

### V2: AI Thinking Stream

```
┌──────────────────────────────────────────────┐
│ 🤖  OBIETTIVO IDENTIFICATO                    │
│     Implementare un sistema di notifiche      │
│     push per utenti mobile con supporto▍      │
│                                               │
│ 🤖  3 LAYER ARCHITETTURALI IMPATTATI          │
│     Frontend, Backend API, Push Service       │
│                                               │
│ 🤖  Analisi requisito...                      │
│     ▓▓▓░░░░░░░  (shimmer skeleton)            │
│                                               │
│ ▬▬▬▬ ▬▬▬▬ ▬▬▬▬ ░░░░ ░░░░ ░░░░ ░░░░          │
│ Valutazione complessità...                    │
└──────────────────────────────────────────────┘
```

- Chat feed verticale con messaggi AI
- Ultimo messaggio con effetto **typewriter** (carattere per carattere) + cursore ▍
- **Shimmer skeleton** mentre l'AI pensa allo step successivo
- **Progress bar segmentata** in basso (7 segmenti: emerald/indigo/grigio)
- Auto-scroll verso il basso ad ogni nuovo insight
- Step falliti mostrati con icona ⚠️ e sfondo ambra
- Durata percepita inferiore grazie al feedback continuo

---

## 7. Gestione errori e degradazione

| Scenario | V1 | V2 |
|---|---|---|
| AI non disponibile | Errore → manuale | Step soft-skip → continua con meno contesto |
| Timeout singolo step | Timeout globale | Solo lo step fallisce, pipeline continua |
| `isValidRequirement = false` | Mostra errore, blocca | Non applicabile (validazione distribuita) |
| Nessuna attività compatibile | Errore, fallback pivot | Errore dall'estimation endpoint |
| Rate limit | Errore dedicato | Step soft-skip → degraded |
| Abort utente | Non supportato | `abortRef.current = true` → pipeline interrotta |

---

## 8. Escalation policy (solo V2)

V2 implementa una policy automatica di escalation verso il wizard completo:

| Condizione | Azione |
|---|---|
| `confidenceScore >= 0.80` e planner = SKIP | Nessuna escalation |
| `0.60 <= confidenceScore < 0.80` o planner = ASK | Banner suggerimento → wizard |
| `confidenceScore < 0.60` | Banner forte → wizard consigliato |

V1 non ha alcun meccanismo di escalation — mostra sempre la stima senza qualificazione.

---

## 9. File coinvolti

### V1

| File | Ruolo |
|---|---|
| `src/hooks/useQuickEstimation.ts` | Hook principale |
| `src/lib/openai.ts` → `suggestActivities()` | Client API per `ai-suggest` |
| `src/lib/estimation-utils.ts` → `quickFinalizeEstimation()` | Calcolo deterministico |
| `src/components/estimation/quick-estimate/QuickEstimateResult.tsx` | Componente risultato |
| `netlify/functions/ai-suggest.ts` | Endpoint serverless |
| `netlify/functions/lib/ai/actions/suggest-activities.ts` | Action AI |

### V2

| File | Ruolo |
|---|---|
| `src/hooks/useQuickEstimationV2.ts` | Hook orchestratore pipeline |
| `src/lib/requirement-understanding-api.ts` | Client API understanding |
| `src/lib/impact-map-api.ts` | Client API impact map |
| `src/lib/estimation-blueprint-api.ts` | Client API blueprint |
| `src/lib/requirement-interview-api.ts` | Client API interview + estimation |
| `src/lib/estimation-utils.ts` → `interviewFinalizeEstimation()` | Calcolo deterministico calibrato |
| `src/components/estimation/quick-estimate/QuickEstimateProgress.tsx` | AI Thinking Stream |
| `src/components/estimation/quick-estimate/QuickEstimateResultV2.tsx` | Risultato arricchito (3 tabs + details) |
| `netlify/functions/ai-requirement-understanding.ts` | Endpoint serverless |
| `netlify/functions/ai-impact-map.ts` | Endpoint serverless |
| `netlify/functions/ai-estimation-blueprint.ts` | Endpoint serverless |
| `netlify/functions/ai-requirement-interview.ts` | Endpoint serverless |
| `netlify/functions/ai-estimate-from-interview.ts` | Endpoint serverless |

---

## 10. Confronto costi

| Metrica | V1 | V2 | Delta |
|---|---|---|---|
| **Chiamate AI per stima** | 1 | 5 | +400% |
| **Token input totali (stima)** | ~800-1200 | ~3000-5000 | ~3-4x |
| **Token output totali (stima)** | ~200-400 | ~1500-2500 | ~5-6x |
| **Costo per stima (indicativo)** | ~$0.01-0.02 | ~$0.04-0.08 | ~4x |
| **Tempo totale** | 3-8s | 12-25s | ~3x |
| **Accuratezza percepita** | Bassa (driver neutri) | Alta (driver calibrati + artifacts) | Significativo |

---

## 11. Quando usare quale

| Caso d'uso | Raccomandazione |
|---|---|
| Quick triage di un backlog di 50 requisiti | **V1** — velocità e costo minimo |
| Stima di una singola feature per un'offerta | **V2** — accuratezza e reasoning trasparente |
| Demo / onboarding utente | **V1** — feedback immediato |
| Requisito complesso con integrazione multi-sistema | **V2** — con possibilità di escalation a wizard |
| Budget AI limitato | **V1** |
| Necessità di audit trail | **V2** — traceId + per-step timing |

---

## 12. Migrazione e compatibilità

- V1 e V2 **coesistono** — il componente `QuickEstimate.tsx` attualmente usa V2
- V1 è mantenuto in `useQuickEstimation.ts` per backward compatibility
- Il passaggio da V1 a V2 è un cambio di import nel componente host
- Non ci sono breaking change sulle API Netlify: V2 chiama endpoint aggiuntivi, non modifica quelli esistenti
- Il database non è impattato: entrambi producono `FinalizedEstimation` consumabile dallo stesso schema di persistenza
