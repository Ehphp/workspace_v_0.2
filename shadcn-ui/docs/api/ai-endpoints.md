# AI Endpoints Reference

This document provides a complete reference for all AI-related Netlify Functions in Syntero.

---

## AI Philosophy

Before diving into endpoints, understand these principles:

1. **AI never calculates effort** — The deterministic estimation engine computes all numbers.
2. **AI output is always validated** — Responses are parsed, validated with Zod schemas, and cross-referenced against allowed activity codes.
3. **Final numbers are deterministic** — Same inputs to the estimation engine always produce the same outputs.
4. **User confirmation required** — AI proposes; user confirms. No automatic data modifications.

---

## Security

All endpoints enforce:

| Security Layer | Implementation |
|----------------|----------------|
| **CORS Origin Allowlist** | `lib/security/cors.ts` — Only allowed origins can call endpoints |
| **Auth Token Validation** | `lib/auth/auth-validator.ts` — Validates Supabase JWT tokens |
| **Rate Limiting** | `lib/security/rate-limiter.ts` — Redis-backed throttling (in-memory fallback when Redis unavailable) |
| **AI Response Cache** | `lib/ai/ai-cache.ts` — Redis-backed cache for deterministic AI actions (graceful degradation) |
| **Async Job Store** | `lib/ai/job-manager.ts` — Redis-backed job queue with automatic in-memory fallback for local dev |
| **Server-Side API Key** | `OPENAI_API_KEY` environment variable, never exposed to client |
| **Input Sanitization** | `sanitizePromptInput()` applied at both client and server |

---

## Handler Middleware Factory

All AI endpoints use a centralized handler factory (`lib/handler/create-ai-handler.ts`) that provides standardized middleware:

### Usage

```typescript
export const handler = createAIHandler<RequestBody>({
    name: 'endpoint-name',
    requireAuth: true,            // Require valid auth token (default: false)
    rateLimit: true,              // Enable rate limiting (default: false)
    requireOpenAI: true,          // Check API key configured (default: true)
    
    validateBody: (body) => {
        // Return error message string or null if valid
        if (!body.requiredField) return 'Missing required field';
        return null;
    },
    
    handler: async (body, ctx) => {
        // Business logic
        const sanitized = ctx.sanitize(body.input);
        const openai = getOpenAIClient({ timeout: 30000 });
        // ... AI call ...
        return { success: true, data: result };
    }
});
```

### Handler Context

The `ctx` object provides:

| Property | Type | Description |
|----------|------|-------------|
| `userId` | `string \| undefined` | Authenticated user ID (if auth passed) |
| `event` | `HandlerEvent` | Original Netlify event |
| `netlifyContext` | `HandlerContext` | Netlify context |
| `headers` | `Record<string, string>` | CORS headers for response |
| `sanitize` | `(input: string) => string` | Input sanitization function |

### Middleware Chain

1. **OPTIONS preflight** — Returns 200 with CORS headers
2. **POST validation** — Rejects non-POST requests
3. **Origin allowlist** — Blocks unauthorized origins
4. **Auth validation** — Validates JWT token (if `requireAuth: true`)
5. **Rate limiting** — Throttles by user/IP (if `rateLimit: true`)
6. **OpenAI check** — Verifies API key configured
7. **Body parsing** — Parses JSON request body
8. **Custom validation** — Runs `validateBody` function
9. **Business logic** — Executes `handler` function
10. **Error handling** — Catches and formats errors

### Benefits

- Eliminates ~50 lines of boilerplate per endpoint
- Consistent error response format across all endpoints
- Centralized logging with endpoint name prefix
- Type-safe body validation
- Automatic timeout error detection

---

## OpenAI Client Configuration

The centralized OpenAI client (`lib/ai/openai-client.ts`) supports configurable timeouts:

```typescript
const openai = getOpenAIClient({
    timeout: 55000,    // Timeout in ms (default: 55000)
    maxRetries: 1,     // Retry count (default: 1)
});
```

### Preset Configurations

| Preset | Timeout | Retries | Use Case |
|--------|---------|---------|----------|
| `quick` | 20s | 1 | Simple prompts (generate-questions) |
| `standard` | 30s | 1 | General AI calls (suggest) |
| `bulk` | 28s | 0 | Batch operations (bulk-interview, bulk-estimate) |
| `complex` | 50s | 1 | Complex generation (generate-preset) |
| `extended` | 55s | 1 | Activity selection (estimate-from-interview) |

---

## Endpoint Groups

### Interview Generation

Endpoints that produce technical questions for gathering estimation context.

---

#### `POST /.netlify/functions/ai-requirement-interview`

**Purpose**: Information-gain interview planner — analyzes a requirement, produces a pre-estimate,
decides whether questions are needed (ASK/SKIP), and if so returns only high-impact questions.

**When Used**: Single-requirement interview flow — user clicks "Start Interview" on a requirement.
With the planner, simple requirements may skip the interview entirely (SKIP path → 1 LLM call total).

**Input**:
```typescript
{
  description: string;          // Requirement description
  techPresetId: string;         // Selected technology preset ID
  techCategory: string;         // e.g., "POWER_PLATFORM", "BACKEND"
  projectContext?: {            // Optional project metadata
    name: string;
    description: string;
    owner?: string;
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  // — Information-gain planner fields —
  decision: "ASK" | "SKIP";     // ASK = show questions, SKIP = go to estimate
  preEstimate: {
    minHours: number;            // Optimistic range bound
    maxHours: number;            // Pessimistic range bound
    confidence: number;          // 0–1
  };
  // — Questions (empty array if SKIP) —
  questions: Array<{
    id: string;
    type: "single-choice" | "multiple-choice" | "range";
    category: "INTEGRATION" | "DATA" | "SECURITY" | "PERFORMANCE" | "UI_UX" | "ARCHITECTURE" | "TESTING" | "DEPLOYMENT";
    question: string;
    technicalContext: string;
    impactOnEstimate: string;
    options: Array<{ id: string; label: string; description?: string }>;
    required: boolean;
    min?: number; max?: number; step?: number; unit?: string;
    impact: {                    // Information-gain metadata
      expectedRangeReductionPct: number;
      importance: "high" | "medium" | "low";
    };
  }>;
  // — Backward-compatible fields —
  reasoning: string;
  estimatedComplexity: "LOW" | "MEDIUM" | "HIGH";
  suggestedActivities: string[];
  // — Metrics —
  metrics?: {
    totalMs: number;
    llmMs: number;
    activitiesFetchMs: number;
    activitiesCatalogSize: number;
    activitiesRanked: number;
    activitiesSource: string;
    questionCountRaw: number;
    questionCountFiltered: number;
    decisionOverridden: boolean;
  };
}
```

**Validation/Fallback**:
- Description must be non-empty after sanitization
- Technology category must be valid
- SKIP decision only allowed when confidence >= 0.90 AND range <= 16h (server-enforced)
- Questions filtered server-side: only those with expectedRangeReductionPct >= 15% are kept
- Maximum 3 questions returned (highest impact first)
- Fetches activity catalog server-side for pre-estimate anchoring
- Questions avoid open "text" type — uses single-choice, multiple-choice, or range only

---

#### `POST /.netlify/functions/ai-bulk-interview`

**Purpose**: Generate aggregated questions for multiple requirements at once.

**When Used**: Bulk estimation flow — user selects multiple requirements and starts batch interview.

**Input**:
```typescript
{
  requirements: Array<{
    id: string;                 // Internal UUID
    reqId: string;              // User-visible ID (e.g., "REQ-001")
    title: string;
    description: string;
    techPresetId: string | null;
  }>;
  techCategory: string;
  techPresetId?: string;
  projectContext?: {
    name: string;
    description: string;
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  questions: Array<{
    id: string;
    scope: "global" | "multi-requirement" | "specific";
    affectedRequirementIds: string[];     // Which requirements this question affects
    type: "single-choice" | "multiple-choice" | "range";
    category: string;
    question: string;
    options: Array<{ id: string; label: string }>;
  }>;
  analysis: Array<{
    reqCode: string;                      // e.g., "REQ-001"
    complexity: "LOW" | "MEDIUM" | "HIGH";
  }>;
}
```

**Validation/Fallback**:
- Requires 1-50 requirements
- Technology category required
- Returns 6-10 aggregated questions (fewer than N × 4-6 individual questions)
- Questions can be scoped globally, to multiple requirements, or to specific ones

---

### Estimation

Endpoints that select activities based on gathered information.

---

#### `POST /.netlify/functions/ai-estimate-from-interview`

**Purpose**: Select activities based on interview answers for a single requirement.

**When Used**: After user completes interview questions for one requirement.

**Input**:
```typescript
{
  description: string;
  techPresetId: string;
  techCategory: string;          // Required — used for server-side activity filtering
  answers: Record<string, {
    questionId: string;
    category: string;
    value: string | string[] | number;
    timestamp: string;
  }>;
  activities?: Array<{           // Optional fallback — server fetches from Supabase by default
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
    technology_id?: string;
  }>;
  projectContext?: {
    name: string;
    description: string;
    owner?: string;
  };
}
```

> **v2 Change**: `activities` is now **optional**. The server fetches activities from Supabase
> using `techCategory`, ranks them by keyword relevance to the requirement description,
> and sends only the top-20 to the LLM prompt. Client-provided activities are used only as
> a fallback if the server-side fetch fails.

**Output**:
```typescript
{
  success: boolean;
  generatedTitle: string;
  activities: Array<{
    code: string;
    name: string;
    baseHours: number;
    reason: string;
    fromAnswer?: string;
    fromQuestionId?: string;
  }>;
  totalBaseDays: number;
  reasoning: string;
  confidenceScore: number;
  suggestedDrivers: Array<{
    code: string;
    suggestedValue: string;
    reason: string;
    fromQuestionId?: string;
  }>;
  suggestedRisks: string[];
  metrics?: {                    // Pipeline performance instrumentation (v2)
    totalMs: number;
    activitiesFetchMs?: number;
    vectorSearchMs?: number;
    ragRetrievalMs?: number;
    draftDurationMs?: number;
    reflectionDurationMs?: number;
    refineDurationMs?: number;
    pipeline: 'legacy' | 'agentic';
    fallbackUsed?: boolean;
    activitiesRanked?: number;
    activitiesSent?: number;
  };
}
```

**Validation/Fallback**:
- Activity codes in response are constrained to server-fetched catalog (filtered by `techCategory`, ranked top-20)
- Falls back to client-provided `activities` array if server-side Supabase fetch fails
- Deterministic rules for activity variant selection (_SM vs _LG based on answer patterns)
- Confidence score calculated from answer coverage

**Phase 3 — Agentic Mode** (`AI_AGENTIC=true`):

When the agentic pipeline is enabled, this endpoint uses the Agent Orchestrator instead of the linear flow. The response includes additional `agentMetadata`:

```typescript
{
  // ... same fields as above ...
  agentMetadata?: {
    executionId: string;        // Unique trace ID
    totalDurationMs: number;    // Pipeline duration
    iterations: number;         // Reflection loop count
    toolCallCount: number;      // Tools invoked by the model
    model: string;              // LLM model used
    reflectionAssessment?: 'approved' | 'needs_review' | 'concerns';
    reflectionConfidence?: number;  // 0-100
    engineValidation?: {        // Deterministic check result
      baseDays: number;
      driverMultiplier: number;
      subtotal: number;
      riskScore: number;
      contingencyPercent: number;
      contingencyDays: number;
      totalDays: number;
    };
  };
}
```

The agentic pipeline adds:
1. **Tool Use**: Model can call `search_catalog`, `query_history`, `validate_estimation`, `get_activity_details`
2. **Reflection Loop**: Draft estimation is critiqued by a Senior Consultant prompt; auto-corrected if issues found
3. **Engine Validation**: Final result verified through deterministic formula

---

#### `POST /.netlify/functions/ai-bulk-estimate-with-answers`

**Purpose**: Generate estimations for multiple requirements from bulk interview answers.

**When Used**: After user completes bulk interview questions.

**Input**:
```typescript
{
  requirements: Array<{
    id: string;
    reqId: string;
    title: string;
    description: string;
    techPresetId: string | null;
  }>;
  techCategory: string;
  answers: Record<string, {
    questionId: string;
    scope: "global" | "multi-requirement" | "specific";
    affectedRequirementIds: string[];
    category: string;
    value: string | string[] | number;
  }>;
  activities: Array<{
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
    technology_id?: string;     // Canonical FK (preferred over tech_category)
  }>;
}
```

**Output**:
```typescript
{
  success: boolean;
  estimations: Array<{
    requirementIndex: number;   // Index in input requirements array
    generatedTitle: string;
    activities: Array<{
      code: string;
      baseHours: number;
      reason: string;
    }>;
    totalBaseDays: number;
    complexity: "LOW" | "MEDIUM" | "HIGH";
    confidenceScore: number;
  }>;
  reasoning: string;
}
```

**Validation/Fallback**:
- Requires at least one requirement and one answer
- Applies scoped answers (global, multi-requirement, specific) to appropriate requirements

---

#### `POST /.netlify/functions/ai-suggest`

**Purpose**: Multi-action endpoint for activity suggestions, title generation, and requirement normalization.

**When Used**: Quick estimation flow — user enters description and clicks "AI Suggest".

**Input (suggest-activities action)**:
```typescript
{
  action: "suggest-activities";
  description: string;
  preset: {
    id: string;
    name: string;
    description: string;
    tech_category: string;
    technology_id?: string;      // Canonical FK (preferred)
    default_activity_codes: string[];
    default_driver_values: Record<string, string>;
    default_risks: string[];
  };
  activities: Array<{
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
    technology_id?: string;     // Canonical FK (preferred over tech_category)
  }>;
  projectContext?: {            // Optional project metadata for better context
    name: string;
    description: string;
    owner?: string;
  };
  testMode?: boolean;           // Disable cache, higher temperature
}
```

**Output (suggest-activities)**:
```typescript
{
  isValidRequirement: boolean;  // false if description is gibberish/test input
  activityCodes: string[];      // Selected activity codes
  reasoning: string;            // Why these activities were selected
}
```

**Other Actions**:

| Action | Input | Output |
|--------|-------|--------|
| `generate-title` | `{ action: "generate-title", description }` | `{ title: string }` |
| `normalize-requirement` | `{ action: "normalize-requirement", description }` | `{ normalizedDescription, validationIssues }` |

**Model Configuration**:
- Model: configurable via `AI_ESTIMATION_MODEL` env variable, defaults to `gpt-4o`
- Same env variable shared with `ai-estimate-from-interview` for consistency
- gpt-5/o-series models use the **Responses API** (`client.responses.create`) with native `json_schema` strict mode
- gpt-4o/gpt-4o-mini models use the legacy **Chat Completions API** (`chat.completions.create`)
- Temperature: `0.0` (deterministic) or `0.7` in test mode (ignored for gpt-5/o-series)
- Automatic 1-retry on empty model output for gpt-5/o-series
- `max_output_tokens` set to 1000 (Responses API)

**Validation/Fallback**:
- Filters activities by `technology_id` FK (canonical), with `tech_category` string fallback
- Activity codes constrained to provided enum
- 24h response cache (keyed by description + presetId + activity codes)
- Pre-validation rejects test inputs ("test", "qwerty"), gibberish, too-short descriptions

---

### Preset Generation

Endpoints for AI-assisted custom preset creation (two-stage flow).

---

#### `POST /.netlify/functions/ai-generate-questions`

**Purpose**: Stage 1 — Generate interview questions to gather information for custom preset creation.

**When Used**: User starts "Create Custom Preset" wizard.

**Input**:
```typescript
{
  description: string;          // User's description of their technology/project
  userId: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  questions: Array<{
    id: string;
    question: string;
    type: "single-choice" | "multiple-choice" | "text";
    options?: Array<{ id: string; label: string; description?: string }>;
    required: boolean;
  }>;
  suggestedTechCategory: "FRONTEND" | "BACKEND" | "MULTI";
}
```

**Validation/Fallback**:
- Description must be 20-1000 characters after sanitization
- Returns questions about architecture, integrations, data patterns, testing approach

---

#### `POST /.netlify/functions/ai-generate-preset`

**Purpose**: Stage 2 — Generate a complete preset from description and interview answers using **HYBRID activity selection** with **multi-pass quality pipeline**.

**When Used**: After user completes preset wizard questions.

**Pipeline (Phase 2.5)**:

The endpoint runs a multi-pass pipeline (up to 3 LLM calls, with time budgets):

| Step | Type | Description | Budget |
|------|------|-------------|--------|
| 1. Context Gather | Parallel DB | Fetch activity catalog (vector/category) **+** existing technologies (RAG history lookup) | Parallel |
| 2. Generate | LLM (gpt-4o) | First-pass preset generation with **technically detailed** activity descriptions | 50s |
| 3. Genericness Check | Deterministic | `activity-genericness-validator` scores each activity | <1ms |
| 4. Validation Pass | LLM (gpt-4o) | Lightweight review: invalid groups, duplicates, vague descriptions, invented codes | 15s |
| 5. Retry w/ Feedback | LLM (gpt-4o) | Corrective re-generation if quality below threshold (≥3 issues OR avg score <70 OR >30% failed) | 25s |
| 6. Finalize | Code | Pick best result, attach metadata | <1ms |

**Technical Depth**: The system prompt mandates implementation-level detail — every activity must name specific frameworks, tools, design patterns, or artifacts. Vague titles like "Backend development" are explicitly rejected.

**History Lookup (RAG)**: Before generation, the endpoint fetches up to 5 similar existing technologies from Supabase (same category first, then MULTI) with their linked activity names, providing reference context for consistent style.

**Retry logic**: Only fires if there is time budget remaining (<40s elapsed). The retry result is adopted **only if** its genericness score exceeds the original; otherwise the original is kept.

**Hybrid Approach**: The AI receives a filtered activity catalog and can:
1. **Select existing activities** from the catalog (by code)
2. **Create new activities** when nothing in the catalog fits

This maximizes reuse of validated activities while allowing AI to fill gaps.

**Input**:
```typescript
{
  description: string;
  answers: Record<string, any>;     // Interview answers
  suggestedTechCategory?: "FRONTEND" | "BACKEND" | "MULTI" | "POWER_PLATFORM";
}
```

**Internal Flow**:
1. Create async job via `job-manager` (Redis or in-memory fallback)
2. Return `{ jobId, status: 'PENDING' }` immediately
3. Background: Fetch activities from DB filtered by `suggestedTechCategory` + `MULTI`
4. Format catalog in compact notation for prompt (saves tokens)
5. AI returns mixed activities: some with `existingCode`, some with `isNew: true`
6. Update job to `COMPLETED` with result (poll via `ai-job-status`)

> **Note**: The job store uses Redis when available; in local development without Redis it falls back to an in-memory Map automatically (no configuration needed).

**Output**:
```typescript
{
  success: boolean;
  preset: {
    name: string;
    description: string;
    detailedDescription: string;
    techCategory: "FRONTEND" | "BACKEND" | "MULTI" | "POWER_PLATFORM";
    activities: Array<{
      // For catalog activities
      existingCode?: string;           // e.g., "PP_DV_FORM_SM"
      // For new activities
      isNew?: boolean;                 // true if AI-generated
      title: string;                   // 5-12 words, technically precise
      description: string;             // 20-60 words, must name frameworks/tools/patterns
      group: "ANALYSIS" | "DEV" | "TEST" | "OPS" | "GOVERNANCE";
      estimatedHours: number;
      priority: "core" | "recommended" | "optional";
      confidence: number;              // 0.0 - 1.0
      reasoning?: string;              // Why selected/created
    }>;
    driverValues: Record<string, string>;
    riskCodes: string[];
    reasoning: string;
    confidence: number;
    validationScore: number;           // 0-100in genericness score
    genericityCheck: {
      passed: number;
      failed: number;
      warnings: number;
    };
  };
  metadata: {
    cached: boolean;
    attempts: number;                  // 1-3 (generate + validate + retry)
    modelPasses: string[];             // e.g. ["gpt-4o:generate", "gpt-4o:validate", "gpt-4o:retry"]
    generationTimeMs: number;          // Total pipeline time
    firstPassMs: number;               // Time for initial generation
    historyTechnologies: number;       // How many existing techs matched for RAG
    validationIssues: number;          // Issues found by validation pass
    retried: boolean;                  // Whether a corrective retry was executed
  };
}
```

**Token Optimization**:
- Catalog filtered by tech category (reduces ~75% of activities)
- Compact notation: `CODE|hours|name: description_truncated`
- History lookup capped at 5 technologies, 10 activity names each
- Estimated additional cost: ~$0.008-0.015/request (1 pass) to ~$0.025/request (3 passes with retry)

**Validation/Fallback**:
- Requires description and answers object
- New activities marked with `isNew: true` are created in DB when preset is saved
- Existing activities are linked via `existingCode`

---

## Common Response Patterns

### Success Response

```typescript
{
  success: true,
  // ... endpoint-specific data
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    code: string,         // Error code (see table below)
    message: string,      // Human-readable message (Italian)
    details?: any         // Additional data (dev mode only)
  }
}
```

### Error Codes (Sprint 3)

| Code | HTTP | Description | Retry-After |
|------|------|-------------|-------------|
| `AI_UNAVAILABLE` | 503 | Circuit breaker open — OpenAI unreachable | Yes (seconds until probe) |
| `AI_RATE_LIMITED` | 429 | OpenAI rate limit exceeded after retries | Yes (from OpenAI header) |
| `TIMEOUT` | 504 | Request timed out | No |
| `RATE_LIMITED` | 429 | App-level rate limit (Redis) | Yes |
| `UNAUTHORIZED` | 401 | Missing/invalid auth token | No |
| `VALIDATION_ERROR` | 400 | Input validation failed | No |
| `LLM_NOT_CONFIGURED` | 500 | API key missing | No |
| `INTERNAL_ERROR` | 500 | Unexpected server error | No |

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (invalid/missing auth token) |
| 403 | Forbidden (origin not allowed) |
| 405 | Method not allowed (only POST accepted) |
| 429 | Rate limit exceeded (app or OpenAI) |
| 500 | Server error (API key missing, OpenAI error) |
| 503 | AI unavailable (circuit breaker open) |
| 504 | Gateway timeout |

---

## Timeouts

| Endpoint | Timeout | Rationale |
|----------|---------|-----------|
| `ai-suggest` | 55s | Netlify function limit 60s |
| `ai-requirement-interview` | 55s | Complex prompt generation |
| `ai-estimate-from-interview` | 55s | Activity selection with reasoning |
| `ai-bulk-interview` | 28s | Must finish before 30s lambda hard limit |
| `ai-bulk-estimate-with-answers` | 28s | Batch processing |
| `ai-generate-questions` | 20s | Simpler prompt |
| `ai-generate-preset` | 50s | Complex preset generation |

---

## Caching

- **ai-suggest**: 24h TTL cache keyed by `hash(description + presetId + activityCodes)`
- **Other endpoints**: No caching (interview/estimation responses depend on user-specific context)

Cache implementation: `lib/ai/ai-cache.ts`

---

## Related Documentation

- [../ai-integration.md](../ai-integration.md) — Complete AI system documentation
- [../ai/ai-input-validation.md](../ai/ai-input-validation.md) — 4-level validation pipeline
- [../ai/KEY_POLICY.md](../ai/KEY_POLICY.md) — API key security policy
- [../architecture.md](../architecture.md) — System architecture overview

---

## Vector Search Endpoints (Phase 2-4)

These endpoints support the pgvector-based semantic search infrastructure.

---

### `POST /.netlify/functions/ai-generate-embeddings`

**Purpose**: Generate embeddings for activities and requirements catalog.

**When Used**: Initial setup after pgvector migration, or periodically to embed new items.

**Input** (Query Parameters):
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `activities` | `activities`, `requirements`, or `all` |
| `force` | boolean | `false` | If `true`, regenerates all embeddings |

**Output**:
```typescript
{
  success: boolean;
  results: Array<{
    type: string;
    processed: number;
    updated: number;
    skipped: number;
    errors: string[];
  }>;
  summary: {
    totalUpdated: number;
    totalErrors: number;
  };
}
```

**Requirements**:
- Auth token required
- `OPENAI_API_KEY` environment variable
- `SUPABASE_SERVICE_ROLE_KEY` for admin operations (optional, falls back to anon key)

---

### `POST /.netlify/functions/ai-check-duplicates`

**Purpose**: Check for semantically similar existing activities when creating new ones.

**When Used**: AI Technology Wizard - before saving a new custom activity.

**Input**:
```typescript
{
  name: string;          // Activity name
  description?: string;  // Optional description
}
```

**Output**:
```typescript
{
  hasDuplicates: boolean;
  duplicates: Array<{
    code: string;
    name: string;
    description: string | null;
    similarity: number;  // 0-1 score
  }>;
  suggestion?: string;   // User-facing recommendation message
  vectorSearchEnabled: boolean;
}
```

**Behavior**:
- Returns `hasDuplicates: true` if similarity > 80% found
- `suggestion` contains localized message for user
- If `vectorSearchEnabled: false`, returns empty duplicates (feature disabled)

---

### `GET /.netlify/functions/ai-vector-health` *(deprecated)*

> **Deprecated**: Use `GET /.netlify/functions/ai-health` instead. This endpoint returns an `X-Deprecated` header.

**Purpose**: Legacy health check for vector search infrastructure.

**When Used**: Monitoring, debugging, admin dashboards.

**Output**:
```typescript
{
  vectorSearchEnabled: boolean;
  envVariables: {
    OPENAI_API_KEY: boolean;
    SUPABASE_URL: boolean;
    USE_VECTOR_SEARCH: string | undefined;
  };
  database: {
    connected: boolean;
    pgvectorExtension: boolean | null;
  };
  embeddings: {
    activitiesTotal: number;
    activitiesWithEmbedding: number;
    activitiesCoverage: string;  // e.g., "85.5%"
    requirementsTotal: number;
    requirementsWithEmbedding: number;
    requirementsCoverage: string;
  } | null;
  recommendations: string[];
}
```

**No authentication required** — read-only status endpoint.

---

### `GET /.netlify/functions/ai-health`

**Purpose**: Consolidated health check covering OpenAI circuit breaker, database, Redis, pgvector, embeddings, and RAG metrics.

**When Used**: Monitoring dashboards, frontend health indicator (`useAiHealth` hook), ops alerts.

**Output**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;               // ISO-8601
  openai: {
    configured: boolean;
    circuitBreaker: {
      state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      failures: number;
      successes: number;
      lastFailureAt: string | null;
      lastSuccessAt: string | null;
      openedAt: string | null;
    };
  };
  database: {
    connected: boolean;
    pgvectorExtension: boolean | null;
    latencyMs: number;
  };
  redis: {
    connected: boolean;
    latencyMs: number | null;
  };
  vectorSearch: {
    enabled: boolean;
  };
  embeddings: { ... } | null;      // Same structure as ai-vector-health
  rag: RAGMetrics | null;
  recommendations: string[];        // Actionable items
}
```

**Status derivation**:

| Condition | Status |
|-----------|--------|
| CB OPEN or DB unreachable | `unhealthy` |
| CB HALF_OPEN or Redis down | `degraded` |
| Everything ok | `healthy` |

**No authentication required** — read-only status endpoint.

---

## Environment Variables

### Vector Search Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_VECTOR_SEARCH` | `true` | Feature toggle; set to `false` to disable |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Required for embedding generation (optional for search) |

### Behavior When Disabled

When `USE_VECTOR_SEARCH=false`:
- `ai-suggest` falls back to category-based activity filtering
- `ai-generate-preset` uses standard catalog fetch (history lookup + validation pass skipped)
- `ai-estimate-from-interview` uses server-fetched activities filtered by techCategory (no semantic retrieval)
- `ai-bulk-estimate-with-answers` uses frontend-provided activities (no semantic retrieval)
- `ai-check-duplicates` returns `hasDuplicates: false`
- RAG (historical learning) is skipped in all endpoints

---

## Endpoints Using Vector Search

The following estimation endpoints automatically use vector search when enabled:

| Endpoint | Vector Search | RAG | Fallback |
|----------|---------------|-----|----------|
| `ai-suggest` | ✅ Top-30 similar activities | ✅ Historical requirements | Category filter |
| `ai-generate-preset` | ✅ Top-40 similar activities | ✅ Existing technologies (history lookup) | Category filter |
| `ai-estimate-from-interview` | ✅ Top-20 similar activities | ✅ Historical requirements | Server-side Supabase fetch → client-provided fallback |
| `ai-bulk-estimate-with-answers` | ✅ Top-25 similar activities | ❌ | Frontend-provided activities |

**Question generation endpoints** (ai-generate-questions, ai-bulk-interview) do not use vector search as they don't involve activity retrieval.

> **Note**: `ai-requirement-interview` now fetches activities server-side (Supabase) for pre-estimate anchoring, but does _not_ use vector search.

---

## Analysis Endpoints

### POST `/.netlify/functions/ai-consultant`

**Purpose**: Senior Consultant analysis that reviews requirement estimation and provides architectural advice, detects discrepancies, and performs risk analysis.

**When Used**: User clicks "Senior Consultant" button in EstimationTab after estimation is complete.

**Input**:
```typescript
{
  requirement: {
    title: string;
    description: string;
  };
  projectContext: {
    listName: string;
    listDescription: string;
  };
  estimation: {
    activities: Array<{
      code: string;
      title: string;
      description?: string;
      baseHours: number;
      totalHours: number;
      driver: string | null;
      driverValue: string | null;
    }>;
    totalHours: number;
    drivers: Record<string, string>;  // driverCode -> selected value
  };
}
```

**Output**:
```typescript
{
  success: boolean;
  analysis: {
    implementation_tips: string;        // Markdown-formatted architectural advice
    discrepancies: Array<{
      activity_code: string;            // Activity with issue
      issue: string;                    // Description of the problem
      suggestion: string;               // Recommended fix
      severity: "low" | "medium" | "high";
    }>;
    risk_analysis: Array<{
      risk: string;                     // Risk description
      impact: string;                   // Potential impact
      mitigation: string;               // Mitigation strategy
    }>;
    overall_assessment: "good" | "needs_attention" | "critical";
    confidence: number;                 // 0.0 - 1.0
    ai_reasoning: string;               // Explanation of analysis approach
  };
  metadata: {
    cached: boolean;
    generationTimeMs: number;
  };
}
```

**Model Configuration**:
- Model: `gpt-4o`
- Temperature: `0.0` (maximum determinism for consistency)
- Structured output via Zod schema validation

**Validation/Fallback**:
- Requires valid requirement title and description (sanitized)
- Activities array must not be empty
- Input sanitized via `sanitizePromptInput()` to prevent injection
- On AI failure, returns standard error response with actionable message

---

**Last Updated**: 2026-02-28  
**Derived from**: Existing Netlify Functions source code in `netlify/functions/`

