# Sprint 4 — Product Evolution

**Durata**: 8 giorni di sviluppo  
**Prerequisiti completati**: Sprint 2 (actual fields + `estimation_accuracy` view), Sprint 3 (resilience layer)  
**Tema**: Chiudere il loop di apprendimento AI, versionare i prompt, migliorare l'esperienza bulk, ed estendere l'export

---

## Stato attuale rilevato dal codice

| Area | File chiave | Stato |
|---|---|---|
| RAG | `netlify/functions/lib/ai/rag.ts` (287 righe) | `fetchEstimationHistory()` **non include `actual_hours` / `deviation_percent`**; `buildRAGPromptFragment()` mostra solo stima, mai consuntivo |
| Export | `src/lib/export/` (4 file: pdf 589 LOC, excel 281, csv 210, index 124) + `ExportDialog.tsx` (328) | **Completamente implementato** — PDF/Excel/CSV con dialog, wired in EstimationTab + WizardStep5. Mancano: dati consuntivo negli export + bulk export a livello progetto |
| Prompt registry | `netlify/functions/lib/ai/prompt-registry.ts` (198), migration `20260228_ai_prompts_registry.sql` | Tabella `ai_prompts` ha `version INT DEFAULT 1` ma constraint `prompt_key TEXT UNIQUE` **impedisce versioni multiple**. Nessun A/B testing |
| Bulk ops | `ai-bulk-estimate-with-answers.ts` (272) + `job-manager.ts` (81) + `bulk-interview-api.ts` polling | Polling 2s, max 60 attempt (120s timeout). Solo PENDING/COMPLETED/FAILED. **Nessun progresso per-requisito** |

---

## S4-1 · RAG Feedback Loop (2 giorni)

### Obiettivo
Quando il RAG fornisce esempi storici all'AI, se quei requisiti hanno consuntivo (Sprint 2) lo deve mostrare nel prompt, permettendo al modello di auto-calibrarsi vedendo stima-vs-realtà.

### Giorno 1 — Backend RAG

#### 1a. Estendere `HistoricalExample` interface

**File**: `netlify/functions/lib/ai/rag.ts`  

```typescript
export interface HistoricalExample {
    requirementId: string;
    requirementTitle: string;
    requirementDescription: string;
    similarity: number;
    totalDays: number;
    baseDays: number;
    activities: Array<{ code: string; name: string; baseHours: number }>;
    techPresetName?: string;
    // ── NEW (S4-1) ──────────────────────────────────────
    actualHours?: number;          // ore reali (da estimation.actual_hours)
    deviationPercent?: number;     // % scostamento calcolato dalla view
    hasActuals: boolean;           // flag per template condizionale
}
```

#### 1b. Modificare `fetchEstimationHistory()` per includere `actual_hours`

Aggiungere `actual_hours` al `SELECT` nella query supabase:

```typescript
const { data: estimation, error: estimationError } = await supabase
    .from('estimations')
    .select(`
        total_days,
        base_days,
        actual_hours,
        estimation_activities (
            activity_id,
            activities (code, name, base_hours)
        )
    `)
    .eq('requirement_id', requirementId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
```

Calcolare `deviationPercent` inline:

```typescript
const actualHours = estimation.actual_hours ?? undefined;
const deviationPercent = (actualHours != null && estimation.total_days > 0)
    ? Math.round(((actualHours / 8 - estimation.total_days) / estimation.total_days) * 1000) / 10
    : undefined;

return {
    totalDays: estimation.total_days,
    baseDays: estimation.base_days,
    activities,
    techPresetName,
    actualHours,
    deviationPercent,
    hasActuals: actualHours != null,
};
```

#### 1c. Aggiornare `buildRAGPromptFragment()`

Aggiungere feedback nel prompt fragment quando il consuntivo è disponibile:

```typescript
lines.push(
    `Example ${i + 1} (${Math.round(ex.similarity * 100)}% similar):`,
    `Title: ${ex.requirementTitle}`,
    `Description: ${ex.requirementDescription.substring(0, 200)}…`,
    `Tech Stack: ${ex.techPresetName || 'Unknown'}`,
    `Total Estimate: ${ex.totalDays} days (base: ${ex.baseDays} days)`,
);

// S4-1: Accuracy feedback quando disponibile
if (ex.hasActuals && ex.actualHours != null) {
    const actualDays = (ex.actualHours / 8).toFixed(1);
    const emoji = (ex.deviationPercent ?? 0) > 20 ? '⚠️' : '✅';
    lines.push(
        `${emoji} ACTUAL: ${actualDays} days (${ex.actualHours}h) — deviation: ${ex.deviationPercent}%`,
    );
}

lines.push(`Activities selected:`, activitiesList, '');
```

#### 1d. Aggiornare `getRAGSystemPromptAddition()`

```typescript
export function getRAGSystemPromptAddition(): string {
    return `
**HISTORICAL LEARNING**:
When provided with HISTORICAL EXAMPLES of similar past requirements:
1. Use them as reference for activity selection patterns
2. Consider their hour estimates as calibration data
3. **When ACTUAL data is provided**, compare estimated vs actual days. If estimates were too high/low, adjust your prediction accordingly
4. Weight examples with actual data more heavily — they represent ground truth
5. Adapt based on specific differences in the current requirement
6. Focus on activities that consistently appear in similar requirements
`;
}
```

#### 1e. Priorità RAG: preferire esempi con consuntivo

Nella funzione `retrieveRAGContext()`, ordinare gli esempi per dare priorità a quelli con consuntivo:

```typescript
// Dopo il for-loop di raccolta examples
examples.sort((a, b) => {
    // Prioritize examples with actual data
    if (a.hasActuals && !b.hasActuals) return -1;
    if (!a.hasActuals && b.hasActuals) return 1;
    // Then by similarity
    return b.similarity - a.similarity;
});
// Trim after sorting
context.examples = examples.slice(0, MAX_HISTORICAL_EXAMPLES);
```

### Giorno 2 — Test & Metriche

#### 2a. Unit test per RAG feedback

**File**: `src/test/rag-feedback.test.ts` (nuovo)

```typescript
import { describe, it, expect } from 'vitest';

describe('RAG Feedback Loop', () => {
    it('should include actual hours in prompt when available', () => {
        // Mock a historical example with actuals
        const example = {
            totalDays: 10,
            baseDays: 8,
            actualHours: 96, // 12 days → +20% deviation
            deviationPercent: 20.0,
            hasActuals: true,
            // ...other fields
        };
        // Build prompt and verify "ACTUAL:" line appears
    });

    it('should sort examples preferring those with actuals', () => {
        // 3 examples: 1 with actuals (similarity 0.7), 2 without (similarity 0.9, 0.85)
        // After sort, the one with actuals should come first
    });

    it('should handle missing actuals gracefully', () => {
        // All 3 examples without actual_hours — no "ACTUAL:" lines
    });
});
```

#### 2b. Estendere `recordRAGCall()` metric

Aggiungere al log strutturato il campo `examplesWithActuals`:

```typescript
recordRAGCall({
    hasExamples: context.hasExamples,
    exampleCount: context.examples.length,
    examplesWithActuals: context.examples.filter(e => e.hasActuals).length,  // NEW
    avgSimilarity: avgSim,
    latencyMs: context.searchLatencyMs,
});
```

#### 2c. Aggiornare docs

**File**: `docs/estimation-engine.md` — aggiungere sezione "RAG Feedback Loop"  
**File**: `docs/ai-integration.md` — aggiornare sezione RAG con il nuovo flusso

---

## S4-2 · Export Enhancement — Consuntivo & Bulk Progetto (1 giorno)

### Obiettivo
Il sistema export è già funzionante (PDF/Excel/CSV), ma non include i dati consuntivo (Sprint 2) e non ha un pulsante bulk export a livello progetto.

### 2a. Estendere i tipi export

**File**: `src/types/export.ts`

```typescript
export interface ExportableEstimation {
    // ...existing fields...
    // ── NEW (S4-2) ──────────────────────────────────────
    actuals?: {
        actualHours: number;
        actualDays: number;     // actualHours / 8
        deviationPercent: number;
        startDate?: string;
        endDate?: string;
        notes?: string;
    };
}
```

### 2b. Aggiungere sezione consuntivo nel PDF

**File**: `src/lib/export/pdfGenerator.ts`

Dopo la sezione "AI Reasoning", aggiungere:

```typescript
// === CONSUNTIVO (se disponibile) ===
if (estimation.actuals) {
    yPosition = drawActualsSection(doc, estimation, pageWidth, margin, yPosition);
}
```

Implementare `drawActualsSection()`:
- Box con sfondo verde chiaro o giallo (a seconda della deviation)
- Campi: Ore reali, Giorni reali, Scostamento %, Date inizio/fine reali, Note
- Badge "UNDER" / "ON TARGET" / "OVER" basato su deviation

### 2c. Aggiungere sheet "Consuntivo" in Excel

**File**: `src/lib/export/excelGenerator.ts`

In `addSingleEstimationSheets()`, aggiungere un foglio "Consuntivo" quando `estimation.actuals` è presente:

```typescript
if (estimation.actuals) {
    const actualsData = [
        ['CONSUNTIVO'],
        [''],
        ['Ore Reali', estimation.actuals.actualHours],
        ['Giorni Reali', estimation.actuals.actualDays],
        ['Scostamento %', estimation.actuals.deviationPercent],
        ['Data Inizio Reale', estimation.actuals.startDate || '-'],
        ['Data Fine Reale', estimation.actuals.endDate || '-'],
        ['Note', estimation.actuals.notes || '-'],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(actualsData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Consuntivo');
}
```

### 2d. Colonna consuntivo nella tabella bulk Excel

In `addSummarySheet()` e `addDetailedSheet()`, aggiungere le colonne:
- "Ore Reali", "Scostamento %" nelle righe dove il consuntivo è disponibile

### 2e. Pulsante export a livello progetto

**File**: `src/pages/requirements/RequirementsList.tsx` (o equivalent list view)

Aggiungere un `<Button>` "Esporta Progetto" nella toolbar che:
1. Raccoglie tutte le estimation più recenti per ogni requirement della lista
2. Apre `<ExportDialog>` passando l'array di `ExportableEstimation[]`

```tsx
import { ExportDialog } from '@/components/export/ExportDialog';

// Nello stato del componente:
const [exportDialogVisible, setExportDialogVisible] = useState(false);
const projectEstimations: ExportableEstimation[] = useMemo(() => {
    return requirements
        .filter(r => r.latestEstimation)
        .map(r => mapToExportableEstimation(r));
}, [requirements]);
```

### 2f. Aggiornare docs

**File**: `docs/estimation-engine.md` — aggiungere menzione export con consuntivo

---

## S4-3 · Prompt Versioning & A/B Testing (3 giorni)

### Obiettivo
Permettere di avere multiple versioni di uno stesso prompt, attivarne una per volta, A/B testare varianti, e tracciare le performance per versione.

### Giorno 1 — Schema & Migration

#### 3a. Migration: refactoring `ai_prompts`

**File**: `supabase/migrations/20260310_prompt_versioning.sql`

```sql
-- ============================================
-- Sprint 4 – S4-3: Prompt Versioning & A/B Testing
-- ============================================

-- 1) Drop unique constraint on prompt_key (allows multiple versions)
ALTER TABLE ai_prompts DROP CONSTRAINT IF EXISTS ai_prompts_prompt_key_key;

-- 2) Add versioning and A/B testing columns
ALTER TABLE ai_prompts
  ADD COLUMN IF NOT EXISTS variant      TEXT DEFAULT 'default',   -- 'default', 'A', 'B'
  ADD COLUMN IF NOT EXISTS traffic_pct  INT  DEFAULT 100 CHECK (traffic_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS usage_count  BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_confidence DECIMAL(4,3) DEFAULT NULL, -- rolling avg from AI responses
  ADD COLUMN IF NOT EXISTS promoted_at  TIMESTAMPTZ DEFAULT NULL;  -- when this version became active

-- 3) New unique constraint: one active prompt per key+variant
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompts_key_variant_active
  ON ai_prompts (prompt_key, variant)
  WHERE is_active = TRUE;

-- 4) Function to increment usage count atomically
CREATE OR REPLACE FUNCTION increment_prompt_usage(p_prompt_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE ai_prompts SET usage_count = usage_count + 1 WHERE id = p_prompt_id;
$$;

GRANT EXECUTE ON FUNCTION increment_prompt_usage TO authenticated;

-- 5) Function to record confidence feedback
CREATE OR REPLACE FUNCTION record_prompt_confidence(
  p_prompt_id UUID,
  p_confidence DECIMAL(4,3)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ai_prompts SET
    avg_confidence = CASE
      WHEN avg_confidence IS NULL THEN p_confidence
      ELSE ROUND((avg_confidence * usage_count + p_confidence) / (usage_count + 1), 3)
    END,
    usage_count = usage_count + 1
  WHERE id = p_prompt_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_prompt_confidence TO authenticated;

-- 6) View per confronto A/B
CREATE OR REPLACE VIEW prompt_ab_comparison AS
SELECT
  prompt_key,
  variant,
  version,
  is_active,
  traffic_pct,
  usage_count,
  avg_confidence,
  promoted_at,
  updated_at
FROM ai_prompts
WHERE is_active = TRUE
ORDER BY prompt_key, variant;
```

#### 3b. Aggiornare RLS

Aggiungere nella stessa migration:

```sql
-- Admin can write prompts
CREATE POLICY "ai_prompts_admin_write"
    ON ai_prompts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.user_id = auth.uid()
            AND om.role IN ('admin', 'owner')
        )
    );
```

### Giorno 2 — Backend prompt-registry refactor

#### 3c. Interfaccia `PromptRecord` aggiornata

**File**: `netlify/functions/lib/ai/prompt-registry.ts`

```typescript
interface PromptRecord {
    id: string;           // UUID — necessario per tracking
    prompt_key: string;
    version: number;
    variant: string;      // 'default' | 'A' | 'B'
    traffic_pct: number;
    system_prompt: string;
    is_active: boolean;
}
```

#### 3d. `getPrompt()` → `getPromptWithMeta()`

Refactor della funzione principale per supportare A/B testing:

```typescript
export interface PromptResult {
    promptId: string;       // UUID — per feedback tracking
    systemPrompt: string;
    variant: string;
    version: number;
}

export async function getPromptWithMeta(key: string): Promise<PromptResult> {
    // 1. Check cache
    const cached = promptCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const selected = selectVariant(cached.records);
        return toResult(selected);
    }

    // 2. Fetch ALL active records for this key (may be multiple variants)
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('ai_prompts')
        .select('id, prompt_key, version, variant, traffic_pct, system_prompt, is_active')
        .eq('prompt_key', key)
        .eq('is_active', true);

    if (error || !data?.length) {
        // Fallback to local
        const local = LOCAL_FALLBACKS[key];
        return {
            promptId: `local-${key}`,
            systemPrompt: local || '',
            variant: 'local-fallback',
            version: 0,
        };
    }

    // 3. Cache ALL variants
    promptCache.set(key, { records: data, timestamp: Date.now() });

    // 4. Select variant based on traffic_pct
    const selected = selectVariant(data);
    return toResult(selected);
}
```

#### 3e. `selectVariant()` — selezione probabilistica

```typescript
/**
 * Weighted random selection based on traffic_pct.
 * If only one variant, returns it directly.
 * traffic_pct values don't need to sum to 100 — they're normalized.
 */
function selectVariant(records: PromptRecord[]): PromptRecord {
    if (records.length === 1) return records[0];

    const totalTraffic = records.reduce((sum, r) => sum + r.traffic_pct, 0);
    let random = Math.random() * totalTraffic;

    for (const record of records) {
        random -= record.traffic_pct;
        if (random <= 0) return record;
    }

    return records[0]; // fallback
}
```

#### 3f. Backward compatibility

Mantenere `getPrompt(key): Promise<string>` come wrapper:

```typescript
/** @deprecated Use getPromptWithMeta for new code */
export async function getPrompt(key: string): Promise<string> {
    const result = await getPromptWithMeta(key);
    return result.systemPrompt;
}
```

#### 3g. Feedback tracking — nuova utility

**File**: `netlify/functions/lib/ai/prompt-feedback.ts` (nuovo)

```typescript
import { getSupabaseClient } from './supabase-client';

/**
 * Record confidence feedback for a prompt variant.
 * Called after AI response is received, using the confidence
 * score from the structured output.
 */
export async function recordPromptFeedback(
    promptId: string,
    confidence: number
): Promise<void> {
    if (promptId.startsWith('local-')) return; // skip local fallbacks

    try {
        const supabase = getSupabaseClient();
        await supabase.rpc('record_prompt_confidence', {
            p_prompt_id: promptId,
            p_confidence: Math.min(1, Math.max(0, confidence)),
        });
    } catch (err) {
        console.error('[prompt-feedback] Failed to record:', err);
    }
}
```

#### 3h. Integrare in endpoint AI

In ogni endpoint che usa `getPrompt()`, migrare a `getPromptWithMeta()` e tracciare il feedback:

```typescript
// Prima (esempio in suggest-activities.ts):
const systemPrompt = await getPrompt('estimate_from_interview');

// Dopo:
const promptMeta = await getPromptWithMeta('estimate_from_interview');
const systemPrompt = promptMeta.systemPrompt;

// Dopo ricezione risposta AI:
if (aiResponse.confidence) {
    await recordPromptFeedback(promptMeta.promptId, aiResponse.confidence);
}
```

File da aggiornare:
- `netlify/functions/suggest-activities.ts`
- `netlify/functions/normalize-requirement.ts`
- `netlify/functions/generate-title.ts`
- `netlify/functions/ai-bulk-estimate-with-answers.ts`
- `netlify/functions/generate-interview-questions.ts`
- `netlify/functions/estimate-from-interview.ts`

### Giorno 3 — Admin UI & Dashboard

#### 3i. Pagina admin prompt management

**File**: `src/pages/admin/PromptManagement.tsx` (nuovo)

Layout:
```
┌──────────────────────────────────────────────┐
│ Gestione Prompt AI                           │
├──────────────────────────────────────────────┤
│ [normalization ▼]                            │
│                                              │
│ ┌─ Variant: default (v3) ──── 80% traffico ─┐
│ │ avg_confidence: 0.87  │  usage: 1,204      │
│ │ [Modifica] [Attiva/Disattiva]              │
│ └────────────────────────────────────────────┘
│ ┌─ Variant: B (v1) ────────── 20% traffico ─┐
│ │ avg_confidence: 0.91  │  usage: 302        │
│ │ [Modifica] [Promuovi] [Disattiva]          │
│ └────────────────────────────────────────────┘
│                                              │
│ [+ Nuova Variante]                           │
├──────────────────────────────────────────────┤
│ Confronto A/B                                │
│ ┌─ Bar chart: confidence per variant ───────┐│
│ │  default ████████░░  0.87                 ││
│ │  B       █████████░  0.91                 ││
│ └───────────────────────────────────────────┘│
│ Raccomandazione: variante B ha +4.6% di     │
│ confidence con 302 campioni. [Promuovi B →] │
└──────────────────────────────────────────────┘
```

Componenti necessari:
- `PromptSelector` — dropdown per scegliere il prompt_key
- `VariantCard` — card con stats e azioni (edit, toggle, promote)
- `ABComparisonChart` — bar chart con recharts (già installato)
- `PromptEditor` — textarea con preview (opzionale: monaco editor)

#### 3j. API endpoint per gestione prompt

**File**: `netlify/functions/manage-prompts.ts` (nuovo)

Operazioni (protette da role admin/owner):
- `GET` — lista tutti i prompt attivi con stats
- `POST` — crea nuova variante
- `PATCH` — aggiorna contenuto, traffic_pct
- `POST /promote` — promuove una variante a `default` e disattiva le altre

#### 3k. Route in App.tsx

```typescript
{ path: '/admin/prompts', element: <PromptManagement /> }
```

#### 3l. Aggiornare docs

**File**: `docs/ai-integration.md` — nuova sezione "Prompt Versioning & A/B Testing"  
**File**: `docs/api/ai-endpoints.md` — documentare `manage-prompts` endpoint  
**File**: `docs/data-model.md` — aggiornare schema `ai_prompts` con nuove colonne

---

## S4-4 · Bulk Operations Progress (2 giorni)

### Obiettivo
Dare visibilità granulare sul progresso della stima bulk (per-requisito), mostrando un progress bar dettagliato e risultati parziali.

### Giorno 1 — Backend

#### 4a. Estendere il modello Job

**File**: `netlify/functions/lib/ai/job-manager.ts`

```typescript
export interface JobData {
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    result?: any;
    error?: string;
    // ── NEW (S4-4) ──────────────────────────────────────
    progress?: {
        total: number;          // numero totale requisiti
        completed: number;      // requisiti completati
        failed: number;         // requisiti falliti
        currentItem?: string;   // titolo o ID del requisito corrente
        partialResults?: any[]; // risultati parziali già disponibili
    };
}
```

Aggiungere helper:

```typescript
/**
 * Update job progress without overwriting the full job
 */
export async function updateJobProgress(
    jobId: string,
    progress: JobData['progress']
): Promise<void> {
    const client = getRedisClient();
    const raw = await client.get(`job:${jobId}`);
    if (!raw) return;

    const job: JobData = JSON.parse(raw);
    job.progress = progress;

    await client.setEx(`job:${jobId}`, JOB_TTL_SECONDS, JSON.stringify(job));
}
```

#### 4b. Emettere progresso nel bulk estimate

**File**: `netlify/functions/ai-bulk-estimate-with-answers.ts`

Nel loop di stima per-requisito, aggiungere `updateJobProgress()`:

```typescript
const partialResults: any[] = [];

for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];

    // Aggiornare progresso PRIMA di stiare
    await updateJobProgress(jobId, {
        total: requirements.length,
        completed: i,
        failed: partialResults.filter(r => !r.success).length,
        currentItem: req.title || `Requisito ${i + 1}`,
        partialResults,
    });

    try {
        const estimation = await estimateSingleRequirement(req, ...);
        partialResults.push({ success: true, reqId: req.id, estimation });
    } catch (err) {
        partialResults.push({ success: false, reqId: req.id, error: err.message });
    }
}
```

#### 4c. Endpoint job-status: restituire progress

**File**: `netlify/functions/ai-job-status.ts`

Verificare che il response includa il campo `progress`:

```typescript
// Il campo progress è già nel job data, basta non filtrarlo
return {
    statusCode: 200,
    body: JSON.stringify({
        status: job.status,
        result: job.result,
        error: job.error,
        progress: job.progress,   // ← assicurarsi che venga passato
    }),
};
```

### Giorno 2 — Frontend

#### 4d. Componente `BulkProgressTracker`

**File**: `src/components/bulk/BulkProgressTracker.tsx` (nuovo)

```tsx
interface BulkProgressTrackerProps {
    total: number;
    completed: number;
    failed: number;
    currentItem?: string;
    partialResults?: PartialResult[];
}

export function BulkProgressTracker({
    total, completed, failed, currentItem, partialResults
}: BulkProgressTrackerProps) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{completed}/{total} requisiti stimati</span>
                    <span>{percent}%</span>
                </div>
                <Progress value={percent} className="h-3" />
            </div>

            {/* Current item indicator */}
            {currentItem && (
                <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Stima in corso: {currentItem}</span>
                </div>
            )}

            {/* Partial results list */}
            {partialResults && partialResults.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {partialResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            {r.success
                                ? <CheckCircle className="h-3 w-3 text-green-500" />
                                : <XCircle className="h-3 w-3 text-red-500" />}
                            <span>{r.title || r.reqId}</span>
                            {r.success && (
                                <Badge variant="outline" className="text-xs">
                                    {r.estimation?.totalDays?.toFixed(1)}gg
                                </Badge>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Error count */}
            {failed > 0 && (
                <p className="text-xs text-destructive">
                    {failed} {failed === 1 ? 'requisito' : 'requisiti'} non stimato/i
                </p>
            )}
        </div>
    );
}
```

#### 4e. Integrare nel polling frontend

**File**: `src/lib/bulk-interview-api.ts`

Aggiornare il loop di polling per leggere `progress`:

```typescript
// Callback opzionale per progress updates
type OnProgressCallback = (progress: {
    total: number;
    completed: number;
    failed: number;
    currentItem?: string;
    partialResults?: any[];
}) => void;

// Nel while loop:
const pollData = await pollResponse.json();

// Report progress to UI
if (pollData.progress && onProgress) {
    onProgress(pollData.progress);
}
```

#### 4f. Hook `useBulkInterview` — esporre progress state

**File**: `src/hooks/useBulkInterview.ts`

Aggiungere allo stato del hook:

```typescript
const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

// Passare callback a generateBulkEstimatesFromInterview:
const result = await generateBulkEstimatesFromInterview(
    sanitizedRequirements,
    techCategory,
    answers,
    (progress) => setBulkProgress(progress)  // NEW
);
```

Esporre nel return object:

```typescript
return {
    ...existingReturn,
    bulkProgress,   // { total, completed, failed, currentItem, partialResults }
};
```

#### 4g. Usare in WizardStep

Nella UI wizard (o nella pagina bulk), sostituire il generico spinner con `<BulkProgressTracker>`:

```tsx
{phase === 'estimating' && bulkProgress && (
    <BulkProgressTracker
        total={bulkProgress.total}
        completed={bulkProgress.completed}
        failed={bulkProgress.failed}
        currentItem={bulkProgress.currentItem}
        partialResults={bulkProgress.partialResults}
    />
)}
```

#### 4h. Aggiornare docs

**File**: `docs/ai-integration.md` — documentare il progress tracking bulk  
**File**: `docs/api/ai-endpoints.md` — aggiornare response schema `ai-job-status` con campo `progress`

---

## Riepilogo Timeline

| Giorno | Task | File principali | Output |
|--------|------|-----------------|--------|
| 1 | S4-1a..e: RAG feedback backend | `rag.ts` | RAG usa actual_hours nel prompt |
| 2 | S4-1: test + metriche | `rag-feedback.test.ts`, `rag-metrics.ts` | Copertura test, log strutturati |
| 3 | S4-2: export con consuntivo + bulk progetto | `pdfGenerator.ts`, `excelGenerator.ts`, `export.ts`, `RequirementsList.tsx` | PDF/Excel con consuntivo, export progetto |
| 4 | S4-3a..b: schema + migration prompt versioning | `20260310_prompt_versioning.sql` | DB pronto per A/B |
| 5 | S4-3c..h: prompt-registry refactor + feedback tracking | `prompt-registry.ts`, `prompt-feedback.ts`, 6 endpoint update | Backend A/B funzionante |
| 6 | S4-3i..l: admin UI + chart + route | `PromptManagement.tsx`, `manage-prompts.ts` | UI admin prompt |
| 7 | S4-4a..c: backend progress tracking | `job-manager.ts`, `ai-bulk-estimate-with-answers.ts` | Progress granulare in Redis |
| 8 | S4-4d..h: frontend progress tracker | `BulkProgressTracker.tsx`, `useBulkInterview.ts` | Progress bar visibile in UI |

---

## Dipendenze tra task

```
S4-1 (RAG feedback)
  └── Dipende da: S2-1 (actual_hours columns + estimation_accuracy view)
  └── Indipendente da S4-2, S4-3, S4-4

S4-2 (Export enhancement)
  └── Dipende da: S2-1 (actual fields), export system esistente (✅ già implementato)
  └── Indipendente da S4-1, S4-3, S4-4

S4-3 (Prompt versioning)
  └── Dipende da: ai_prompts table esistente (✅)
  └── Indipendente — può procedere in parallelo con S4-1 e S4-2

S4-4 (Bulk progress)
  └── Dipende da: job-manager.ts + ai-bulk-estimate-with-answers.ts esistenti (✅)
  └── Indipendente — può procedere in parallelo con tutto il resto
```

> **Parallelismo**: Con 2 sviluppatori, S4-1+S4-2 (3gg) e S4-3+S4-4 (5gg) possono procedere in parallelo. Sprint completabile in **5 giorni effettivi** con team di 2.

---

## Criteri di accettazione

| Task | Criterio | Come verificare |
|------|----------|-----------------|
| S4-1 | Prompt RAG include "ACTUAL: X days" per requisiti con consuntivo | Log strutturato con `examplesWithActuals > 0` in endpoint AI |
| S4-1 | Esempi con consuntivo prioritizzati | Test unitario: esempio con actuals appare prima di esempio senza |
| S4-2 | PDF / Excel includono sezione consuntivo | Export di una estimation con actual_hours valorizzato |
| S4-2 | Export progetto funzionante | Click "Esporta Progetto" → Excel scaricato con N requirements |
| S4-3 | A/B split funzionante | 2 varianti con 50/50 traffic → dopo 100 chiamate, distribuzione ~50% ciascuna |
| S4-3 | Confidence tracking | `avg_confidence` aggiornata nella view `prompt_ab_comparison` |
| S4-3 | Admin UI operativa | Pagina `/admin/prompts` mostra varianti, permette edit/promuovi |
| S4-4 | Progress granulare | Durante bulk estimate, polling restituisce `completed: N/total` incrementale |
| S4-4 | UI mostra progress bar | `BulkProgressTracker` visibile durante stima con risultati parziali |

---

## Rischio e mitigazione

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| A/B testing genera inconsistenza nelle stime | Media | Alto | Traffic split conservativo (90/10) per nuove varianti. Log completo per audit |
| Redis TTL scade durante bulk lungo | Bassa | Alto | JOB_TTL_SECONDS aumentato da 3600 a 7200 per bulk. Polling rileva orfani |
| Prompt con consuntivo troppo lungo (token limit) | Bassa | Medio | `buildRAGPromptFragment` già tronca activities a 5 e description a 200 chars. Linea "ACTUAL" aggiunge solo ~15 token per esempio |
| Admin modifica prompt in produzione rompendo AI | Media | Alto | Ogni edit crea nuova version (non sovrascrive). Possibilità di rollback immediato disattivando |
