# V2 Pipeline — Piano Residuale di Fix

**Data:** 12 aprile 2026  
**Fonte:** Audit validazione 9 fasi V2 (12/04/2026)  
**Scope:** Solo fix necessari sul main path. Non è un piano di feature.

---

## Stato di partenza post-audit

| Fase | Stato reale | Classificazione |
|------|------------|-----------------|
| 1 — Dynamic Sizing | **DONE** | Nessun intervento |
| 2 — Confidence Orchestrator | PARTIAL | Wiring incompleto + dead code |
| 3 — Driver/Risk Refactor | **DONE** | Bug minore |
| 4 — PTB Injection | PARTIAL | **BUG CRITICO** — main path senza PTB |
| 5 — Element States | NOT EFFECTIVE | Scope V3 |
| 6 — Staleness Enforcement | NOT EFFECTIVE | **BUG CRITICO** — enforcement irraggiungibile |
| 7 — Artifact Invalidation | NOT EFFECTIVE | Dead code → rimuovere |
| 8 — Decision Model Ext. | PARTIAL | Wiring incompleto |
| 9 — Pipeline Logger | PARTIAL | Wiring incompleto |

---

## 1. Critical Fixes — Main Path

### FIX-1: PTB non iniettato nel prompt dell'agent di stima

**Tipo:** BUG — il formatter esiste, è importato, ma non viene MAI chiamato nel handler di stima.  
**Impatto:** L'agente LLM genera stime SENZA conoscere l'architettura del progetto. Le stime ignorano componenti esistenti, integrazioni, e domini dati. La qualità della stima su progetti con PTB è degradata in modo silenzioso.  
**Rischio se non fixato:** Stime incoerenti con il contesto architetturale reale del progetto. Nessun errore visibile — il problema è invisibile all'utente.

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/lib/ai/agent/agent-types.ts` | Aggiungere `projectTechnicalBlueprintBlock?: string` a `AgentInput` |
| `netlify/functions/ai-estimate-from-interview.ts` | Chiamare `formatProjectTechnicalBlueprintBlock(body.projectTechnicalBlueprint)` e passare il risultato in `agentInput` |
| `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | In `buildUserPrompt()`: iniettare `input.projectTechnicalBlueprintBlock` nel prompt utente (dopo il project context) |

**Verifica:** Dopo il fix, il prompt utente dell'agent DEVE contenere la sezione `BASELINE ARCHITETTURA PROGETTO` quando `body.projectTechnicalBlueprint` è presente.

---

### FIX-2: Staleness enforcement irraggiungibile pre-stima

**Tipo:** BUG ARCHITETTURALE — `buildCanonicalProfile()` è chiamata solo nel save flow (post-stima). `isStale=false` è hardcoded nei handler. `requiresRegeneration` non è letto da nessun consumer.  
**Impatto:** La pipeline genera stime su artefatti stale (understanding cambiata, blueprint aggiornato) senza penalità di confidence né blocco. L'utente non sa che sta stimando su dati obsoleti.  
**Rischio se non fixato:** Stime basate su artefatti incoerenti tra loro. Il sistema non avvisa mai che si sta stimando un requisito il cui understanding è cambiato dopo il blueprint.

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/ai-estimate-from-interview.ts` | **Opzione A (leggera):** Chiamare `evaluateStaleReasons()` direttamente (richiede solo `requirement_analyses` row + versioni artefatti dal body). Passare il risultato `isStale` a `computeAggregateConfidence()` al posto di `false`. Aggiungere `staleReasons` alla response. **Opzione B (completa):** Chiamare `buildCanonicalProfile()` pre-sintesi e usare `canonical.requiresRegeneration`. Più costosa (DB roundtrip). |
| `netlify/functions/ai-requirement-interview.ts` | Stessa logica: sostituire `false` con staleness reale in `computeAggregateConfidence()` |

**Decisione architetturale necessaria:** scegliere tra Opzione A (no DB, staleness dal body, leggera) e Opzione B (DB roundtrip, profilo completo). Raccomando **Opzione A** per il main path.

**Verifica:** Con artefatti stale, `aggregateConfidence` DEVE essere penalizzata (moltiplicatore ×0.85) e `staleReasons` DEVE apparire nella response.

---

## 2. Wiring Incompleto da Completare

### FIX-3: `aggressiveExpansion` è dead code

**Tipo:** Wiring incompleto — il flag è computato e loggato ma non altera nessun comportamento.  
**Impatto:** Quando la confidence è bassa (<0.50), la pipeline dovrebbe espandere la ricerca (più segnali, topN più alto). Attualmente non lo fa.  
**Rischio se non fixato:** Con bassa confidence, il sistema genera lo stesso numero di keyword signals di quando la confidence è alta. L'esplorazione non si adatta.

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/ai-estimate-from-interview.ts` | Quando `pipelineConfig.aggressiveExpansion === true`: passare `topN: 15` (invece di default 10) a `keywordToNormalizedSignals()`. Se non ha senso implementarlo ora → **rimuovere il flag** da `PipelineConfig` e dai log per non lasciare dead code. |

**Decisione:** Implementare o rimuovere. Non lasciare dead code.

---

### FIX-4: Decision model — colonne sempre NULL

**Tipo:** Wiring incompleto — `element_states`, `based_on_understanding_version`, `based_on_impact_map_id` esistono nel DB e nel service ma non ricevono mai valori reali.  
**Impatto:** Le colonne `based_on_understanding_version` e `based_on_impact_map_id` servono per la tracciabilità artefatto→decisione. Senza di esse, non si può ricostruire su quali artefatti una stima era basata.

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/lib/domain/estimation/save-orchestrator.ts` | Aggiungere `based_on_understanding_version` e `based_on_impact_map_id` a `DomainSaveInput`. Popolarli dal `body` della request (il frontend manda già understanding e impact map). Passarli a `createEstimationDecision()`. |
| `src/lib/domain-save.ts` | Aggiungere i campi a `WizardDomainSaveInput` / `createDecision()` se il frontend gestisce il save direttamente. |

**NOTA:** `element_states` **non va wired ora** — dipende da Phase 5 (scope V3). Wirare solo le due colonne di tracciabilità.

---

### FIX-5: Logger — flush mancante su error path + coverage minima

**Tipo:** Wiring incompleto — il logger è creato ma: (a) non viene flushato nel path di errore/fallback, (b) copre solo 2/12 step, (c) non è nella response HTTP.  
**Impatto minore:** Loss di trace diagnostica quando la pipeline fallisce (il caso dove serve di più).

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/ai-estimate-from-interview.ts` | Aggiungere `pipelineLog.flush()` nel catch block (path deterministico/fallback). Aggiungere 3-4 log entries ai punti chiave: signal extraction, vector search, decision engine, driver/risk merge. Opzionale: aggiungere `pipelineTrace: pipelineLog.entries()` alla response. |
| `netlify/functions/ai-requirement-interview.ts` | Importare `createPipelineLogger`, creare logger e aggiungere entries ai punti chiave (decision enforcement, RAG retrieval). |

---

### FIX-6: `skipInterview` threshold conflict

**Tipo:** Wiring rischioso — la soglia `>0.75` per artifact confidence bypassa la soglia `0.90` del modello.  
**Impatto:** Con artefatti forti (understanding + impact map) ma requirement description ambigua, l'interview viene skippata anche se il modello vorrebbe chiedere chiarimenti.

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/lib/domain/pipeline/pipeline-config.ts` | Alzare `skipInterview` a `confidence > 0.85` per allinearla alla semantica di "alta certezza". Oppure documentare esplicitamente che il bypass è intenzionale. |

---

### FIX-7: AI-empty fallback usa `contextRules` invece di `mergedRules`

**Tipo:** Bug minore — quando l'AI non torna drivers, il fallback perde i driver/risk suggeriti dal blueprint.  
**Impatto basso:** Solo quando l'AI ritorna array vuoti (raro).

**File da toccare:**

| File | Azione |
|------|--------|
| `netlify/functions/ai-estimate-from-interview.ts` | Riga ~L710/L718: sostituire `contextRules.suggestedDrivers` con `mergedRules.suggestedDrivers` e `contextRules.suggestedRisks` con `mergedRules.suggestedRisks`. |

---

## 3. Defer / Remove

### DEFER: Phase 5 — Element State Tracking → V3

**Motivazione:** È un effort full-stack (wizard UI, state tracking, save passthrough) che richiede design UX. I tipi e le colonne DB sono pronti. Il codice non blocca nulla.  
**Azione ora:** Nessuna. I tipi esistenti servono come foundation per V3. La colonna `element_states` resta `[]` — nessun impatto.

### REMOVE: Phase 7 — `artifact-invalidation.service.ts`

**Motivazione:** File mai importato, mai chiamato. Esegue solo SELECT + console.log (non scrive DB). Completamente ridondante con `evaluateStaleReasons()` di Phase 6 che già rileva `UNDERSTANDING_UPDATED`, `BLUEPRINT_UPDATED`, etc.  
**Azione:**

| File | Azione |
|------|--------|
| `netlify/functions/lib/domain/estimation/artifact-invalidation.service.ts` | **Eliminare il file.** |

### DEFER: Phase 6 — `requiresRegeneration` consumer nel wizard → V3

**Motivazione:** FIX-2 risolve il problema principale (staleness enforcement pre-stima). Mostrare un avviso "artefatti stale" nel wizard è UX improvement, non bug. Richiede design frontend.  
**Azione ora:** Solo FIX-2. Il consumer frontend è scope V3.

### DEFER: FK constraint `fk_est_decisions_impact_map`

**Motivazione:** Richiede conferma nome tabella (`impact_map` vs `impact_maps`).  
**Azione:** Verificare nome tabella e uncommentare nel prossimo migration batch.

---

## 4. Riepilogo Azioni File-by-File

| File | Fix | Priorità |
|------|-----|----------|
| `netlify/functions/lib/ai/agent/agent-types.ts` | FIX-1: campo `projectTechnicalBlueprintBlock` | 🔴 CRITICAL |
| `netlify/functions/ai-estimate-from-interview.ts` | FIX-1: call formatter + pass a agentInput | 🔴 CRITICAL |
| | FIX-2: sostituire `isStale=false` con staleness reale | 🔴 CRITICAL |
| | FIX-3: implementare o rimuovere `aggressiveExpansion` | 🟡 MEDIUM |
| | FIX-5: flush su error, log entries aggiuntivi | 🟡 MEDIUM |
| | FIX-7: `contextRules` → `mergedRules` nel fallback AI-empty | 🟢 LOW |
| `netlify/functions/lib/ai/agent/agent-orchestrator.ts` | FIX-1: iniettare PTB block in `buildUserPrompt()` | 🔴 CRITICAL |
| `netlify/functions/ai-requirement-interview.ts` | FIX-2: sostituire `isStale=false` con staleness reale | 🔴 CRITICAL |
| | FIX-5: aggiungere pipeline logger | 🟡 MEDIUM |
| `netlify/functions/lib/domain/pipeline/pipeline-config.ts` | FIX-6: alzare soglia `skipInterview` a 0.85 | 🟡 MEDIUM |
| | FIX-3: rimuovere `aggressiveExpansion` se non implementato | 🟡 MEDIUM |
| `netlify/functions/lib/domain/estimation/save-orchestrator.ts` | FIX-4: passare `based_on_understanding_version` + `based_on_impact_map_id` | 🟡 MEDIUM |
| `src/lib/domain-save.ts` | FIX-4: aggiungere campi tracciabilità | 🟡 MEDIUM |
| `netlify/functions/lib/domain/estimation/artifact-invalidation.service.ts` | REMOVE: eliminare | 🟢 LOW |

---

## Ordine di Esecuzione Raccomandato

```
FIX-1 (PTB injection)          ← impatto qualità stima, invisibile all'utente
  ↓
FIX-2 (staleness pre-stima)    ← impatto coerenza artefatti
  ↓
FIX-7 (mergedRules fallback)   ← one-liner, zero rischio
  ↓
FIX-3 (aggressiveExpansion)    ← decisione: implement or remove
  ↓
FIX-6 (skipInterview threshold) ← decisione: raise or document
  ↓
FIX-4 (decision tracciabilità) ← wiring across 2 files
  ↓
FIX-5 (logger completion)      ← polish, non bloccante
  ↓
REMOVE Phase 7                  ← cleanup dead code
```
