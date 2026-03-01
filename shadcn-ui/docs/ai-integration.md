# AI Integration

## Scope

AI in Syntero provides **suggestions** and **interview-driven activity selection**. All AI outputs require user confirmation. The calculation engine remains deterministic.

| AI Does | AI Does NOT |
|---------|-------------|
| Propose activity codes based on description | Calculate estimates (engine does this) |
| Select activities based on interview answers | Make final decisions without user confirmation |
| Generate technical interview questions | Choose driver multiplier values |
| Generate concise titles | Store or modify data directly |
| Validate if requirement text makes sense | Access user data from database |
| Suggest drivers/risks (interview flow only) | Override user selections |

---

## Implementation

### Entry Points

AI functionality is distributed across multiple serverless functions:

| Endpoint | Purpose | Context |
|----------|---------|--------|
| `ai-suggest.ts` | Activity suggestions, title generation | Quick estimation flow |
| `ai-requirement-interview.ts` | Generate technical questions | Single-requirement interview |
| `ai-estimate-from-interview.ts` | Select activities from answers | Single-requirement interview |
| `ai-bulk-interview.ts` | Aggregated questions for N requirements | Bulk estimation |
| `ai-bulk-estimate-with-answers.ts` | Batch activity selection | Bulk estimation |
| `ai-generate-questions.ts` | Stage 1: preset wizard questions | Custom preset creation |
| `ai-generate-preset.ts` | Stage 2: generate preset from answers | Custom preset creation |
| `ai-consultant.ts` | Senior consultant analysis | Post-estimation review |
| `ai-generate-embeddings.ts` | Generate vector embeddings | Background/admin job (Phase 1) |
| `ai-check-duplicates.ts` | Semantic activity deduplication | AI Technology Wizard (Phase 3) |
| `ai-vector-health.ts` | Vector search health check *(deprecated)* | Monitoring (Phase 2-4) |
| `ai-health.ts` | Consolidated health check (CB, DB, Redis, RAG) | Monitoring / frontend indicator (Sprint 3) |

### Actions (ai-suggest.ts)

| Action | Purpose | Input | Output |
|--------|---------|-------|--------|
| `suggest-activities` | Propose relevant activities | description, technology, activities | activityCodes[], reasoning |
| `generate-title` | Create concise title | description | title |
| `normalize-requirement` | Standardize description | description | normalizedDescription, validationIssues |

---

## AI Model

| Property | Value |
|----------|-------|
| Model | `gpt-4o-mini` |
| Temperature | `0.0` (production) / `0.7` (test mode) |
| Response Format | Structured Outputs with JSON Schema |
| Max Tokens | 500 |

### Structured Outputs

OpenAI's structured outputs feature guarantees the response matches a JSON schema:

```typescript
{
  type: "json_schema",
  json_schema: {
    name: "activity_suggestion_response",
    strict: true,  // OpenAI enforces schema
    schema: {
      properties: {
        isValidRequirement: { type: "boolean" },
        activityCodes: {
          type: "array",
          items: {
            type: "string",
            enum: ["ACT_001", "ACT_002", ...]  // Only valid codes allowed
          }
        },
        reasoning: { type: "string" }
      },
      required: ["isValidRequirement", "activityCodes", "reasoning"],
      additionalProperties: false
    }
  }
}
```

**Key Constraint**: The `enum` field contains only valid activity codes from the database. GPT cannot invent codes.

---

## Data Flow

```
1. User enters requirement description
      │
      ▼
2. Client sanitizes input
   └─► sanitizePromptInput() removes <>{} and control chars
      │
      ▼
3. Client calls POST /.netlify/functions/ai-suggest
      │
      ▼
4. Server validation
   ├─► Re-sanitizes input (defense in depth)
   ├─► Validates auth token (if required)
   ├─► Checks origin allowlist
   └─► Validates required fields
      │
      ▼
5. Deterministic pre-validation
   └─► validateRequirementDescription()
       - Rejects test inputs ("test", "qwerty")
       - Rejects too-short descriptions
       - Rejects gibberish
      │
      ▼
6. Filter activities by technology
   └─► Uses `technology_id` FK (canonical) with `tech_category` string fallback
   └─► `filterActivitiesByTechnology()` helper in `src/lib/technology-helpers.ts`
      │
      ▼
7. Check cache (24h TTL)
   └─► Cache key = hash(description + technologyId + activityCodes)
      │
      ├─► [HIT] Return cached response
      │
      └─► [MISS] Continue to OpenAI
      │
      ▼
8. Build prompt
   ├─► System prompt with validation rules
   └─► Descriptive activity list (code, name, description, hours)
      │
      ▼
9. Call OpenAI
   └─► gpt-4o-mini with structured outputs
      │
      ▼
10. Post-validation
    ├─► Parse JSON response
    ├─► Validate with Zod schema
    └─► Cross-reference activityCodes against allowed list
      │
      ▼
11. Cache result and return
```

---

## Validation Pipeline (4 Levels)

### Level 1: Client-side Sanitization

**File**: [src/types/ai-validation.ts](../src/types/ai-validation.ts)

```typescript
function sanitizePromptInput(text: string): string {
  return text
    .replace(/[<>]/g, '')           // Remove HTML tags
    .replace(/[{}]/g, '')           // Remove JSON delimiters
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .slice(0, 5000)                 // Limit length
    .trim();
}
```

### Level 2: Server-side Sanitization

Same function applied again in `ai-suggest.ts`. Defense in depth.

### Level 3: AI-side Validation

GPT evaluates `isValidRequirement`:
- `true`: Requirement has action verb + technical target
- `false`: Test input, gibberish, no clear scope

### Level 4: Post-validation

- Zod schema validation
- Cross-reference: only codes present in the enum are kept

---

## Calling AI from Frontend

**File**: [src/lib/openai.ts](../src/lib/openai.ts)

```typescript
import { suggestActivities } from '@/lib/openai';

const result = await suggestActivities({
  description: "Add login with email and password",
  preset: currentTechnology,
  activities: availableActivities,
});

if (result.isValidRequirement) {
  // User reviews result.activityCodes
} else {
  // Show result.reasoning to user
}
```

### Fallback Behavior

If AI fails (network error, timeout, invalid response):

```typescript
return {
  isValidRequirement: false,
  activityCodes: [],
  reasoning: 'AI service error – no activities suggested',
};
```

---

## AI Interview System

The interview system enables more accurate activity selection by gathering technical context through targeted questions.

### Single-Requirement Interview

A two-step flow for estimating individual requirements with higher precision.

**Step 1: Generate Questions**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-requirement-interview` |
| Input | `description`, `technologyId`, `techCategory`, `projectContext?` |
| Output | `questions[]`, `reasoning`, `estimatedComplexity` |

Questions are technology-specific (e.g., Dataverse entities, Power Automate flows) and use structured response types:
- `single-choice`: Binary or limited options (2-5)
- `multiple-choice`: Multi-select for components/patterns (3+)
- `range`: Numeric values with min/max/step

**Step 2: Generate Estimation**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-estimate-from-interview` |
| Input | `description`, `techCategory`, `answers`, `activities[]`, `projectContext?` |
| Output | `activities[]`, `totalBaseDays`, `confidenceScore`, `suggestedDrivers[]`, `suggestedRisks[]` |

Activity selection follows deterministic rules based on answers:
- Answer indicates "simple", "few", "1-2" → `_SM` variant
- Answer indicates "complex", "many", "5+" → `_LG` variant
- Neutral/absent answer → base variant (no suffix)

**What AI determines vs. what is deterministic:**

| AI Determines | Deterministic (Engine) |
|---------------|------------------------|
| Which activities are relevant | `base_hours` per activity |
| Activity variant (`_SM`/`_LG`) based on answers | `baseDays = Σ(hours) / 8` |
| Confidence score (0.6-0.9) | `driverMultiplier`, `riskScore`, `contingency%` |
| Suggested drivers/risks | `totalDays` calculation |

### Bulk Interview

Optimized flow for estimating multiple requirements (up to 50) with aggregated questions.

**Step 1: Generate Aggregated Questions**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-bulk-interview` |
| Input | `requirements[]`, `techCategory`, `projectContext?` |
| Output | `questions[]` (6-10), `analysis[]` |
| Limit | Max 50 requirements per session |

Questions have scope levels:
- `global`: Applies to all requirements
- `multi-requirement`: Affects a subset (IDs listed)
- `specific`: Targets ambiguous requirements only

**Step 2: Generate Bulk Estimations**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-bulk-estimate-with-answers` |
| Input | `requirements[]`, `techCategory`, `answers`, `activities[]` |
| Output | `estimations[]` (one per requirement with `activities[]`, `totalBaseDays`, `confidenceScore`) |

**Differences from single-requirement flow:**

| Aspect | Single | Bulk |
|--------|--------|------|
| Questions generated | 4-6 per requirement | 6-10 total (aggregated) |
| Answer scope | All answers apply to one requirement | Answers have explicit scope |
| Use case | Detailed estimation | Rapid batch estimation |

### Technology Wizard (Two-Stage) - Integrated in TechnologyDialog

AI-assisted creation of custom technologies, integrated into the TechnologyDialog via AiAssistPanel.

**Stage 1: Generate Questions**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-generate-questions` |
| Input | `description` (technology stack description) |
| Output | `questions[]`, `suggestedTechCategory`, `reasoning` |

Questions gather context about:
- Project lifecycle (greenfield/brownfield)
- Framework preferences
- Integration patterns
- Testing requirements

**Stage 2: Generate Technology**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-generate-preset` |
| Input | `description`, `answers`, `suggestedTechCategory?` |
| Output | `technology` object with `name`, `description`, `code`, `activities[]` |

**Difference from requirement interview:**

| Aspect | Requirement Interview | Technology Wizard |
|--------|----------------------|-------------------|
| Purpose | Estimate a specific requirement | Create reusable technology config |
| Output | Activity selection + estimation | Technology configuration |
| Scope | Per-requirement | Per-technology-stack |

---

## Senior Consultant Analysis

The Senior Consultant feature acts as an AI-powered architectural reviewer that analyzes completed estimations.

### Purpose

- Provide architectural advice and implementation tips
- Detect discrepancies between activities, drivers, and requirement context
- Perform risk analysis with mitigation strategies

### Trigger

User clicks **"Senior Consultant"** button (with ShieldCheck icon) in the **Overview tab**, next to the latest estimation summary.

The handler reads activities and drivers from the **saved (assigned) estimation** in the database — it does **not** depend on the Estimation tab's in-memory selection state. If no saved estimation exists, the user sees an error prompting them to save one first.

### Data Flow

```
┌────────────────────┐
│ RequirementDetail  │
│ (page component)   │
└────────┬───────────┘
         │ handleRequestConsultant()
         │ reads assignedEstimation.estimation_activities
         │       assignedEstimation.estimation_drivers
         ▼
┌────────────────────┐
│ getConsultantAnalysis()│
│ (consultant-api.ts)│
└────────┬───────────┘
         │ POST /ai-consultant
         ▼
┌────────────────────┐
│ ai-consultant.ts   │
│ (Netlify Function) │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ analyzeEstimation()│
│ (consultant-analysis.ts)│
└────────┬───────────┘
         │ GPT-4o (temp=0.0)
         ▼
┌────────────────────┐
│ SeniorConsultantAnalysis│
│ (structured output)│
└────────────────────┘
```

### Output Structure

- **implementation_tips**: Markdown-formatted architectural advice
- **discrepancies[]**: Issues with activity_code, issue, suggestion, severity
- **risk_analysis[]**: Risks with impact and mitigation strategies
- **overall_assessment**: "good" | "needs_attention" | "critical"
- **confidence**: 0.0 - 1.0

### Model Configuration

- **Model**: `gpt-4o`
- **Temperature**: `0.0` (maximum determinism)
- **Validation**: Zod schema for structured output

### Persistence & History

Each consultant analysis run is now saved to the **`consultant_analyses`** table with full context snapshots:

- **`analysis`**: The full `SeniorConsultantAnalysis` result (tips, discrepancies, risks, assessment, confidence)
- **`requirement_snapshot`**: The requirement's state at analysis time (title, description, priority, state, technology)
- **`estimation_snapshot`**: The estimation's state (total_days, base_hours, activities chosen, drivers selected, risk score, contingency)

This enables:
1. **Full traceability**: See exactly what the requirement/estimation looked like when each analysis was performed
2. **History comparison**: Track how the consultant's assessment evolved as the estimation was refined
3. **Audit trail**: Know who requested each analysis and when

The history is displayed in the **Overview tab** as a timeline with collapsible entries. Each entry shows the assessment badge, estimation metrics at analysis time, and can be expanded to reveal the full analysis and the exact context snapshot.

**Hook**: `useConsultantHistory(requirementId)` — loads history and provides `saveAnalysis()` mutation.
**Component**: `ConsultantHistoryPanel` — renders the timeline UI with snapshot viewer.
**Migration**: [20260301_consultant_analysis_history.sql](../supabase/migrations/20260301_consultant_analysis_history.sql)

Legacy: Analysis is also still saved to `estimations.senior_consultant_analysis` (JSONB) when the estimation is saved, and displayed in HistoryTab for individual historical estimations.

---

## Performance

| Metric | Value |
|--------|-------|
| Cache Hit | <100ms |
| Cache Miss | ~1.5s |
| Timeout | 30s (suggest), 28s (bulk), 50s (preset) |
| Cache TTL | 24 hours |

### Token Usage

| Component | Tokens |
|-----------|--------|
| System Prompt | ~800 |
| User Prompt | ~200 (max 1000 chars) |
| Completion | ~150 |
| **Total** | ~1150 |

---

## Security

### API Key

- `OPENAI_API_KEY` is server-side only
- Never exposed to browser
- Set in Netlify environment variables

### Origin Allowlist

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-production-domain.com'
];
```

### Rate Limiting

**Implementation**: Redis-backed with in-memory fallback.

| Component | Description |
|-----------|-------------|
| Backend | Redis with Lua scripts for atomic operations |
| Fallback | In-memory `Map` if Redis unavailable |
| Scope | Per-user (authenticated) or per-IP (anonymous) |

**Environment Variables**:

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `AI_RATE_LIMIT_MAX` | Max requests per window | `50` |
| `AI_RATE_LIMIT_WINDOW_MS` | Window duration (ms) | `600000` (10 min) |

**File**: [netlify/functions/lib/security/rate-limiter.ts](../netlify/functions/lib/security/rate-limiter.ts)

*Note: Rate limiting is disabled in development.*

### AI Response Caching

Deterministic AI actions (`suggest-activities`, `generate-title`, `normalize-requirement`) cache their responses in Redis to reduce API costs for repeated identical inputs.

| Action | Cache Prefix | TTL | Skip When |
|--------|-------------|-----|----------|
| `normalize-requirement` | `ai:norm` | 24h | `testMode=true` |
| `generate-title` | `ai:title` | 24h | *(never)* |
| `suggest-activities` | `ai:suggest` | 12h | `testMode=true` |
| `ai-consultant` | — | No cache | Session-specific |
| `ai-estimate-from-interview` | — | No cache | Unique per interview |

**Cache key**: `{prefix}:{SHA-256(input parts)}` — e.g. for suggestions, the key hashes `description + preset.id + sorted activity codes`.

**Graceful degradation**: If Redis is unavailable, cache calls return `null` silently and the AI call proceeds normally.

**Environment Variables**:

| Variable | Purpose | Default |
|----------|---------|---------||
| `AI_CACHE_ENABLED` | Enable/disable the cache | `true` |

**File**: [netlify/functions/lib/ai/ai-cache.ts](../netlify/functions/lib/ai/ai-cache.ts)

---

## Testing AI

### Variance Testing

AI responses are not 100% deterministic. Temperature=0.0 maximizes consistency but does not guarantee it.

Run variance tests:
```bash
npx tsx scripts/test-ai-variance.ts
```

### Expected Behavior

For the same input, 9/10 calls should return the same activityCodes (90%+ consistency).

---

## Files

### Serverless Functions

| File | Purpose |
|------|---------|
| `netlify/functions/ai-suggest.ts` | Entry point for suggest/title/normalize actions |
| `netlify/functions/ai-requirement-interview.ts` | Single-requirement question generation |
| `netlify/functions/ai-estimate-from-interview.ts` | Activity selection from interview answers |
| `netlify/functions/ai-bulk-interview.ts` | Bulk interview question aggregation |
| `netlify/functions/ai-bulk-estimate-with-answers.ts` | Bulk estimation from answers |
| `netlify/functions/ai-generate-questions.ts` | Preset wizard Stage 1 |
| `netlify/functions/ai-generate-preset.ts` | Preset wizard Stage 2 |

### Shared Libraries (Serverless)

| File | Purpose |
|------|---------|
| `netlify/functions/lib/ai/actions/suggest-activities.ts` | Activity suggestion logic |
| `netlify/functions/lib/ai/actions/generate-title.ts` | Title generation logic |
| `netlify/functions/lib/ai/actions/generate-questions.ts` | Question generation logic |
| `netlify/functions/lib/ai/ai-cache.ts` | **Redis-backed AI response cache** |
| `netlify/functions/lib/ai/prompt-builder.ts` | Prompt construction |
| `netlify/functions/lib/ai/prompt-templates.ts` | **Unified Italian prompt templates** |
| `netlify/functions/lib/ai/deterministic-rules.ts` | **Shared deterministic rules for activity selection** |
| `netlify/functions/lib/security/cors.ts` | Origin validation |
| `netlify/functions/lib/security/redis-client.ts` | **Shared Redis client singleton** |
| `netlify/functions/lib/security/rate-limiter.ts` | Redis-backed rate limiting |
| `netlify/functions/lib/auth/auth-validator.ts` | Auth token validation |

### Frontend - Client APIs

| File | Purpose |
|------|---------|
| `src/lib/openai.ts` | Client wrapper for ai-suggest actions |
| `src/lib/ai-interview-api.ts` | Client API for single-requirement interview |
| `src/lib/bulk-interview-api.ts` | Client API for bulk interview flow |
| `src/lib/estimation-utils.ts` | **Unified estimation finalization wrapper** |

### Frontend - Types

| File | Purpose |
|------|---------|
| `src/types/ai-validation.ts` | Input sanitization, validation utilities |
| `src/types/ai-interview.ts` | Interview question/answer types |
| `src/types/bulk-interview.ts` | Bulk interview types and phases |
### Shared Validation Schemas (`src/shared/validation/`)

| File | Purpose |
|------|---------||
| `pipeline-activity.schema.ts` | Canonical Zod schema for `PipelineActivity` — single source of truth |
| `preset-output.schema.ts` | Canonical Zod schema for `PresetOutput` — converted to JSON Schema for AJV via `zod-to-json-schema` |
| `index.ts` | Barrel export for easy imports |

These schemas eliminate drift between the TypeScript types used in `src/` and the JSON Schema used by AJV in `netlify/functions/lib/ai/validation/preset-schema.ts`.
### Frontend - Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useBulkInterview.ts` | State management for bulk interview flow |

### Frontend - Components

| Directory | Purpose |
|-----------|---------|
| `src/components/estimation/interview/` | Single-requirement interview UI |
| `src/components/requirements/BulkInterviewDialog.tsx` | Bulk interview dialog |
| `src/components/configuration/presets/TechnologyDialog.tsx` | Technology creation dialog with integrated AI |
| `src/components/configuration/presets/AiAssistPanel.tsx` | AI assist panel for preset generation |

> **Note**: The `ai-wizard/` folder has been removed (Sprint 0 cleanup, March 2026). AI preset generation is integrated directly into `TechnologyDialog` via `AiAssistPanel`.

---

## Unified Architecture

All AI endpoints share a consistent approach for prompt construction and estimation calculation.

### Shared Prompt Templates

**File**: `netlify/functions/lib/ai/prompt-templates.ts`

All AI prompts are:
- Written in **Italian** for consistency with user interface
- Shared across endpoints to avoid drift
- Technology-aware with specific guidance per `tech_category`

| Export | Used By |
|--------|---------|
| `createActivitySuggestionPrompt()` | Quick Estimate, ai-suggest |
| `NORMALIZATION_PROMPT` | ai-suggest (normalize action) |
| `createInterviewQuestionsPrompt()` | ai-requirement-interview |
| `ESTIMATE_FROM_INTERVIEW_PROMPT` | ai-estimate-from-interview |
| `createBulkInterviewPrompt()` | ai-bulk-interview |
| `createBulkEstimatePrompt()` | ai-bulk-estimate-with-answers |

### Shared Deterministic Rules

**File**: `netlify/functions/lib/ai/deterministic-rules.ts`

Activity selection follows consistent rules:

| Keyword Pattern | Size Variant |
|-----------------|--------------|
| "simple", "few", "1-2", "basic" | `_SM` |
| "complex", "many", "5+", "advanced" | `_LG` |
| neutral/absent | base (no suffix) |

Functions:
- `matchesActivityCategory(text)`: Returns relevant activity category
- `determineSizeVariant(text)`: Returns `_SM`, `_LG`, or empty
- `calculateConfidenceScore(factors)`: Computes confidence 0.6-0.9

### Unified Estimation Finalization

**File**: `src/lib/estimation-utils.ts`

All estimation flows converge to `finalizeEstimation()`:

```typescript
import { finalizeEstimation } from '@/lib/estimation-utils';

const result = finalizeEstimation(
  aiResponse,           // { activities, totalBaseDays, suggestedDrivers?, suggestedRisks? }
  preset,               // Preset with default drivers/risks
  availableActivities   // Activity catalog
);
// Returns: { activities[], baseResult, finalResult, drivers[], risks[], confidenceScore }
```

**Why this matters:**
- **Quick Estimate** now applies preset default drivers/risks (previously used empty arrays)
- **Interview** and **Bulk** flows use the same calculation path
- All methods produce consistent `FinalizedEstimation` output

### Calculation Consistency

| Flow | Pre-Change | Post-Change |
|------|------------|-------------|
| Quick Estimate | Empty drivers/risks → baseDays only | Preset defaults applied |
| Interview | Full drivers/risks from AI | Unchanged (already correct) |
| Bulk | Full drivers/risks from AI | Unchanged (already correct) |

---

## Vector Search & RAG (Phase 2-4)

As of migration `20260221_pgvector_embeddings.sql`, Syntero uses pgvector for semantic search.

### Architecture

```
┌───────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User Input       │────▶│  Generate        │────▶│  Vector Search   │
│  (requirement)    │     │  Embedding       │     │  (pgvector)      │
└───────────────────┘     │  OpenAI ada-002  │     │  Top-K Similar   │
                          └──────────────────┘     └────────┬─────────┘
                                                           │
                          ┌──────────────────┐             │
                          │  Reduced Prompt  │◀────────────┘
                          │  (~30 activities │
                          │   vs ~100 full)  │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  OpenAI GPT-4o   │
                          │  Activity Select │
                          └──────────────────┘
```

### Feature Toggle

| Variable | Effect |
|----------|--------|
| `USE_VECTOR_SEARCH=true` | Vector search active (default) |
| `USE_VECTOR_SEARCH=false` | Falls back to category-based filtering |

When disabled, the system operates exactly as before vector search was implemented.

### Phase 2: Hybrid Search

**All estimation endpoints now use vector search:**

| Endpoint | Vector Limit | RAG | Fallback |
|----------|--------------|-----|----------|
| `ai-suggest` | Top-30 activities | ✅ | Category filter |
| `ai-generate-preset` | Top-30 activities | ❌ | Category filter |
| `ai-estimate-from-interview` | Top-20 activities | ✅ | Frontend-provided activities |
| `ai-bulk-estimate-with-answers` | Top-25 activities | ❌ | Frontend-provided activities |

> **Note**: Question generation endpoints (ai-requirement-interview, ai-generate-questions, ai-bulk-interview) do NOT use vector search, as they generate questions rather than retrieve activities.

**Fallback behavior:**
- If vector search returns 0 results → standard category filtering
- If embedding generation fails → continues without RAG
- If pgvector unavailable → graceful degradation to legacy flow

**Activity scope — vector search vs presets:**

Vector search retrieves activities broadly across the entire technology scope (+ MULTI). It is intentionally **not** restricted to the preset's defaults. This allows the AI to suggest the most appropriate activity for the requirement — e.g. suggesting `PP_FLOW_SIMPLE` even when the user selected the "Complex (HR)" preset, because the requirement only needs a simple flow.

The frontend maps AI-suggested codes against **all activities compatible with the technology** using the canonical `technology_id` FK (with `tech_category` string fallback). The `applyAiSuggestions` hook validates via `isActivityCompatible()` from `src/lib/technology-helpers.ts`. This ensures AI freedom while still scoping suggestions to the correct technology.

### Phase 3: Semantic Deduplication

When creating new custom activities:

1. `ai-check-duplicates` endpoint called with activity name/description
2. System searches for activities with >80% similarity
3. If match found, user sees suggestion to reuse existing activity
4. Prevents "catalog bloat" from near-duplicate activities

### Phase 4: RAG Historical Learning

For activity suggestions:

1. System searches `requirements` table for similar past requirements
2. Fetches their estimation data (activities, total_days, base_days, **actual_hours**)
3. Includes top-3 historical examples in prompt as few-shot learning
4. AI uses these examples to calibrate its suggestions
5. **Sprint 4 (S4-1)**: Examples with actuals are prioritized and include deviation data

**RAG prompt addition:**
```
--- HISTORICAL EXAMPLES (for reference, similar past requirements) ---

Example 1 (78% similar):
Title: User registration form
Total Estimate: 5 days (base: 4 days)
✅ ACTUAL: 5.5 days (44h) — deviation: 10.0%
Activities selected:
  - BE_DEV_AUTH: Authentication (24h)
  - FE_DEV_FORM: Form development (16h)
  ...

--- END EXAMPLES ---
```

**RAG system prompt** now includes:
> When ACTUAL data is provided, compare estimated vs actual days. Weight examples with actual data more heavily — they represent ground truth.

### Performance Impact

| Metric | Legacy | With Vector Search |
|--------|--------|-------------------|
| Prompt size (activities) | ~14KB (99 activities) | ~2-3KB (30 activities) |
| OpenAI latency | 12-15s | 5-8s expected |
| Token cost | Higher | ~50% reduction |
| Relevance | Category-based | Semantic similarity |

### Monitoring

Health check endpoint: `GET /.netlify/functions/ai-vector-health`

Returns:
- Embedding coverage percentage
- pgvector extension status
- Configuration warnings
- Recommended actions
- **RAG metrics** (Sprint 2): in-memory telemetry for retrieval calls

#### RAG Metrics (Sprint 2 — S2-4)

The health endpoint now includes a `rag` field with in-memory metrics collected by `rag-metrics.ts`:

| Field | Type | Description |
|-------|------|-------------|
| `totalCalls` | number | Total `retrieveRAGContext()` invocations since cold start |
| `hits` | number | Calls that returned ≥1 historical example |
| `misses` | number | Calls with 0 examples |
| `hitRate` | string | Percentage, e.g. `"72.5%"` |
| `avgSimilarity` | number | Mean similarity score across hits |
| `avgExamplesPerHit` | number | Mean examples returned per successful call |
| `avgLatencyMs` | number | Mean retrieval time |
| `p95LatencyMs` | number | 95th percentile retrieval time |
| `lastResetAt` | string | ISO timestamp of last cold start / manual reset |

**Note**: Metrics are in-memory and reset on each Netlify Functions cold start. The `rag` field is `null` if no RAG calls have been made since the last cold start.

**Files**: `netlify/functions/lib/ai/rag-metrics.ts` (store + helpers), integrated in `rag.ts` via `recordRAGCall()`.

---

## Prompt Versioning & A/B Testing (Sprint 4 — S4-3)

The prompt registry (`prompt-registry.ts`) supports **multiple variants per prompt key** for A/B testing.

### Schema Changes

**Migration**: `supabase/migrations/20260310_prompt_versioning.sql`

- Dropped `UNIQUE(prompt_key)` constraint
- Added columns: `variant`, `traffic_pct`, `usage_count`, `avg_confidence`, `promoted_at`
- New unique index: `(prompt_key, variant) WHERE is_active = TRUE`
- RPCs: `record_prompt_confidence()`, `increment_prompt_usage()`
- View: `prompt_ab_comparison`

### API

**`getPromptWithMeta(key)`** — returns `{ promptId, systemPrompt, variant, version }`
- Fetches ALL active variants for a key
- Selects variant via weighted random based on `traffic_pct`
- Result includes `promptId` for feedback tracking

**`getPrompt(key)`** — backward-compatible wrapper (⚠️ deprecated)

**`recordPromptFeedback(promptId, confidence)`** — updates rolling `avg_confidence`

### Admin Endpoint

`GET/POST/PATCH /.netlify/functions/manage-prompts` — protected by admin/owner role
- `GET`: list all prompts with stats
- `POST`: create new variant
- `PATCH`: update content, traffic_pct, toggle active
- `POST /promote`: promote variant to default

### Admin UI

Route: `/admin/prompts` → `PromptManagement.tsx`
- Variant cards with confidence/usage stats
- A/B comparison bar chart
- Recommendation engine (promotes best performer)
- Edit/toggle/promote actions

---

## Bulk Progress Tracking (Sprint 4 — S4-4)

Bulk estimation now reports **per-requirement progress** during execution.

### Backend

`JobRecord.progress` — new field:
```typescript
{ total, completed, failed, currentItem?, partialResults? }
```

`updateJobProgress()` in `job-manager.ts` updates progress without overwriting the job result.

`ai-job-status.ts` now returns `progress` in its response.

### Frontend

- `BulkProgressTracker` component: progress bar, current item, partial results list
- `generateBulkEstimatesFromInterview()` accepts optional `onProgress` callback
- `useBulkInterview` hook exposes `bulkProgress` state

Structured logs are also emitted as JSON on each call:
```json
{"module":"rag","action":"retrieveContext","examples":2,"latencyMs":340,"avgSimilarity":0.78}
```

---

## Phase 3: Agentic Evolution

### Overview

Phase 3 transforms the estimation pipeline from a linear "Prompt → JSON" flow into an agentic system with self-reflection and active tool use.

**Feature flag**: `AI_AGENTIC=true` (env variable)

**Source**: `netlify/functions/lib/ai/agent/`

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Agent Orchestrator                          │
│                                                              │
│  INIT → DRAFT → REFLECT → (REFINE|APPROVE) → VALIDATE → OK  │
│         ▲  │                    ▲                             │
│         │  │ function calling   │ correction prompt           │
│         │  ▼                    │                             │
│     ┌────────────────┐  ┌──────────────────┐                 │
│     │  Agent Tools    │  │ Reflection Engine │                │
│     │ - search_catalog│  │ (Senior Consultant│                │
│     │ - query_history │  │  critique loop)   │                │
│     │ - validate_est. │  └──────────────────┘                 │
│     │ - get_details   │                                      │
│     └────────────────┘                                       │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │ EstimationEngine SDK  │  ← DETERMINISTIC      │
│              │ (invariant preserved) │                        │
│              └───────────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

### State Machine

| State | Description |
|-------|-------------|
| `INIT` | Pre-fetch RAG context, build prompts |
| `DRAFT` | LLM generates estimation with tool-use (function calling) |
| `REFLECT` | Lightweight consultant analysis of draft |
| `REFINE` | Re-generate with correction instructions (if needed) |
| `VALIDATE` | Deterministic engine check (formula invariant) |
| `COMPLETE` | Final result with full execution trace |

### Tool Use (Function Calling)

The AI model can actively request tools during estimation:

| Tool | Purpose | When Used |
|------|---------|----------|
| `search_catalog` | Semantic search via pgvector | Discover relevant activities |
| `query_history` | RAG historical estimations | Calibrate against past data |
| `validate_estimation` | Deterministic formula check | Verify totals before final |
| `get_activity_details` | Full activity metadata | Deep-dive on specific codes |

### Reflection Loop

1. Draft estimation is analyzed by a Senior Consultant prompt (gpt-4o-mini, temp=0.0)
2. Issues are classified: `missing_activity`, `unnecessary_activity`, `wrong_hours`, `missing_coverage`, `over_engineering`
3. If high-severity or 2+ medium issues → auto-refinement with correction prompt
4. Capped at `AI_MAX_REFLECTIONS` iterations (default: 2)
5. **Time-budget guard**: before starting a REFINE pass the orchestrator checks remaining time. If fewer than 18 s remain in the 55 s budget (`REFINE_TIME_BUDGET_MS`), refinement is skipped and the draft proceeds directly to VALIDATE. This prevents lambda-local / Netlify timeouts.

### Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `AI_AGENTIC` | `false` | Enable agentic pipeline |
| `AI_REFLECTION` | `true` | Enable reflection loop |
| `AI_TOOL_USE` | `true` | Enable function calling |
| `AI_MAX_REFLECTIONS` | `2` | Max reflection iterations |
| `AI_REFLECTION_THRESHOLD` | `75` | Confidence threshold to skip reflection |

### Timeout Budget

| Constant | Value | Purpose |
|----------|-------|---------|
| `ORCHESTRATION_TIMEOUT_MS` | 55 000 ms | Hard ceiling for the entire agent pipeline |
| `REFINE_TIME_BUDGET_MS` | 18 000 ms | Minimum remaining time required before starting REFINE |

Local dev uses `netlify dev --timeout 120` (set in `package.json` → `dev:netlify` script) so lambda-local does not kill the function before the orchestrator timeout fires.

### Deterministic Core Invariant

Every estimation produced by the agentic pipeline passes through `validateWithEngine()` which replicates `EstimationEngine.calculateEstimation()`. This guarantees:

- `Total Days = (Base/8) × DriversMultiplier × (1+Contingency)`
- AI-reported `totalBaseDays` is corrected if it diverges from calculated value
- The formula is explainable, verifiable, and protected from hallucinations

---

## What AI Cannot Do

1. **Invent activity codes**: Enum constraint restricts output to valid codes from catalog.
2. **Calculate estimates**: Engine applies formula deterministically (`baseDays × driverMultiplier × contingency`).
3. **Access user data**: No database access from AI layer; activities are passed as input.
4. **Make final decisions**: User always confirms AI suggestions before saving.
5. **Set driver/risk values**: AI can suggest, but user/engine determines final values.
6. **Override calculation logic**: `base_hours` values come from database, not AI.
7. **Skip engine validation**: Even agentic pipeline must pass through deterministic check (Phase 3).

---

**Update this document when**:
- Changing the AI model
- Adding new AI actions
- Modifying validation rules
- Changing caching behavior
- Updating vector search configuration
- Adding RAG features
- Modifying agentic pipeline tools or reflection logic
- Changing resilience settings (circuit breaker, retry, degradation)

---

## Resilience (Sprint 3)

### Circuit Breaker

All OpenAI calls pass through an in-memory circuit breaker (`lib/ai/circuit-breaker.ts`) with three states:

| State | Behavior |
|-------|----------|
| **CLOSED** | Requests pass through normally |
| **OPEN** | Requests rejected immediately (`CircuitOpenError` → HTTP 503) |
| **HALF_OPEN** | One probe request allowed; success → CLOSED, failure → OPEN |

**Configuration** (singleton in `openai-client.ts`):

| Setting | Value | Rationale |
|---------|-------|-----------|
| `failureThreshold` | 3 | Open after 3 consecutive failures |
| `resetTimeoutMs` | 30 000 ms | Allow a probe after 30 s |

The CB is in-memory per Netlify Function instance. Warm instances keep state for 5–10 min; cold starts reset to CLOSED (acceptable trade-off vs Redis latency).

### Retry with Exponential Backoff

`lib/ai/retry.ts` provides `withRetry()` that wraps each OpenAI call **inside** the circuit breaker:

```
Request → CB.execute() → withRetry() → OpenAI SDK call
                              ↓ fail (retryable)
                         wait ~1 s → retry 1
                              ↓ fail
                         wait ~2 s → retry 2
                              ↓ fail
                         throw → CB.onFailure()
```

- **Max retries**: 2 (3 total attempts)
- **Initial delay**: 1 000 ms, multiplier × 2, cap 10 000 ms
- **Jitter**: ±25 % to prevent thundering herd
- **Retryable errors**: HTTP 429, 5xx, `ETIMEDOUT`, `ECONNABORTED`, `ECONNRESET`, empty model output
- Timeout-aware: skips retry if remaining wall-clock time < 3 s

Only errors that exhaust all retries count towards the CB failure threshold.

### Graceful Degradation

| Layer | Behavior |
|-------|----------|
| **Backend** (`create-ai-handler.ts`) | `CircuitOpenError` → 503 + `Retry-After`; HTTP 429 passthrough |
| **Frontend** (`openai.ts`) | `parseAIError()` structures error; `suggestActivities()` returns degraded result with `_serviceError` |
| **UI** (`AiUnavailableBanner.tsx`) | Amber banner with countdown, "Retry" and "Continue manually" buttons |
| **Agentic pipeline** | If agentic fails (non-CB), falls back to legacy linear pipeline transparently |

Error codes returned by the backend:

| Code | HTTP | Meaning |
|------|------|---------|
| `AI_UNAVAILABLE` | 503 | Circuit breaker open |
| `AI_RATE_LIMITED` | 429 | OpenAI rate limit exhausted after retries |
| `TIMEOUT` | 504 | Network / function timeout |
| `INTERNAL_ERROR` | 500 | Unexpected error |

### Health Endpoint

`GET /.netlify/functions/ai-health` returns a consolidated health status covering OpenAI CB, database, Redis, pgvector, embeddings, and RAG metrics. See [ai-endpoints.md](api/ai-endpoints.md) for full schema.

The frontend hook `useAiHealth` (in `src/hooks/useAiHealth.ts`) polls this endpoint every 60 s and exposes `aiStatus`, `isAiAvailable`, and `circuitBreakerOpen`.
