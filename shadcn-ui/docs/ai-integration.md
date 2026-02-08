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

### Actions (ai-suggest.ts)

| Action | Purpose | Input | Output |
|--------|---------|-------|--------|
| `suggest-activities` | Propose relevant activities | description, preset, activities | activityCodes[], reasoning |
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
6. Filter activities by tech_category
   └─► Only activities matching preset.tech_category or 'MULTI'
      │
      ▼
7. Check cache (24h TTL)
   └─► Cache key = hash(description + presetId + activityCodes)
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
  preset: currentPreset,
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
  activityCodes: preset.default_activity_codes,
  reasoning: 'Using preset defaults due to AI service error',
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
| Input | `description`, `techPresetId`, `techCategory`, `projectContext?` |
| Output | `questions[]`, `reasoning`, `estimatedComplexity` |

Questions are technology-specific (e.g., Dataverse entities, Power Automate flows) and use structured response types:
- `single-choice`: Binary or limited options (2-5)
- `multiple-choice`: Multi-select for components/patterns (3+)
- `range`: Numeric values with min/max/step

**Step 2: Generate Estimation**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-estimate-from-interview` |
| Input | `description`, `techCategory`, `answers`, `activities[]` |
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

### Preset Wizard (Two-Stage)

AI-assisted creation of custom technology presets.

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

**Stage 2: Generate Preset**

| Property | Value |
|----------|-------|
| Endpoint | `POST /.netlify/functions/ai-generate-preset` |
| Input | `description`, `answers`, `suggestedTechCategory?` |
| Output | `preset` object with `name`, `description`, `tech_category`, `default_activity_codes[]` |

**Difference from requirement interview:**

| Aspect | Requirement Interview | Preset Wizard |
|--------|----------------------|---------------|
| Purpose | Estimate a specific requirement | Create reusable preset template |
| Output | Activity selection + estimation | Preset configuration |
| Scope | Per-requirement | Per-technology-stack |

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
| `netlify/functions/lib/ai/prompt-builder.ts` | Prompt construction |
| `netlify/functions/lib/ai/prompt-templates.ts` | **Unified Italian prompt templates** |
| `netlify/functions/lib/ai/deterministic-rules.ts` | **Shared deterministic rules for activity selection** |
| `netlify/functions/lib/ai/ai-cache.ts` | Response caching (24h TTL) |
| `netlify/functions/lib/security/cors.ts` | Origin validation |
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

### Frontend - Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useBulkInterview.ts` | State management for bulk interview flow |

### Frontend - Components

| Directory | Purpose |
|-----------|---------|
| `src/components/estimation/interview/` | Single-requirement interview UI |
| `src/components/requirements/BulkInterviewDialog.tsx` | Bulk interview dialog |
| `src/components/configuration/presets/ai-wizard/` | Preset wizard UI |

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

## What AI Cannot Do

1. **Invent activity codes**: Enum constraint restricts output to valid codes from catalog.
2. **Calculate estimates**: Engine applies formula deterministically (`baseDays × driverMultiplier × contingency`).
3. **Access user data**: No database access from AI layer; activities are passed as input.
4. **Make final decisions**: User always confirms AI suggestions before saving.
5. **Set driver/risk values**: AI can suggest, but user/engine determines final values.
6. **Override calculation logic**: `base_hours` values come from database, not AI.

---

**Update this document when**:
- Changing the AI model
- Adding new AI actions
- Modifying validation rules
- Changing caching behavior
