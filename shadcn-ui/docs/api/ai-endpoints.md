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
| **Rate Limiting** | `lib/security/rate-limiter.ts` — Redis-backed throttling (disabled in dev) |
| **Server-Side API Key** | `OPENAI_API_KEY` environment variable, never exposed to client |
| **Input Sanitization** | `sanitizePromptInput()` applied at both client and server |

---

## Endpoint Groups

### Interview Generation

Endpoints that produce technical questions for gathering estimation context.

---

#### `POST /.netlify/functions/ai-requirement-interview`

**Purpose**: Generate technical interview questions for a single requirement.

**When Used**: Single-requirement interview flow — user clicks "Start Interview" on a requirement.

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
  questions: Array<{
    id: string;                           // e.g., "q1_integration"
    type: "single-choice" | "multiple-choice" | "range";
    category: "INTEGRATION" | "DATA" | "SECURITY" | "PERFORMANCE" | "UI_UX" | "ARCHITECTURE" | "TESTING" | "DEPLOYMENT";
    question: string;
    technicalContext: string;             // Why this matters technically
    impactOnEstimate: string;             // How answer affects estimate
    options: Array<{ id: string; label: string; description?: string }>;
    required: boolean;
    min?: number; max?: number; step?: number; unit?: string;  // For range type
  }>;
  reasoning: string;
  estimatedComplexity: "LOW" | "MEDIUM" | "HIGH";
}
```

**Validation/Fallback**:
- Description must be non-empty after sanitization
- Technology category must be valid
- Returns 4-6 technology-specific questions
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
  techCategory: string;
  answers: Record<string, {
    questionId: string;
    category: string;
    value: string | string[] | number;
    timestamp: string;
  }>;
  activities: Array<{           // Available activities for this tech category
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
  }>;
}
```

**Output**:
```typescript
{
  success: boolean;
  generatedTitle: string;       // Short title for the requirement (max 60 chars)
  activities: Array<{
    code: string;
    name: string;
    baseHours: number;
    reason: string;             // Why this activity was selected
    fromAnswer?: string;        // Answer value that triggered selection
    fromQuestionId?: string;    // Question that triggered selection
  }>;
  totalBaseDays: number;
  reasoning: string;
  confidenceScore: number;      // 0.60-0.90 based on answer completeness
  suggestedDrivers: Array<{
    code: string;
    suggestedValue: string;
    reason: string;
    fromQuestionId?: string;
  }>;
  suggestedRisks: string[];     // Risk codes to pre-select
}
```

**Validation/Fallback**:
- Activity codes in response are constrained to provided `activities` array (enum in JSON schema)
- Deterministic rules for activity variant selection (_SM vs _LG based on answer patterns)
- Confidence score calculated from answer coverage

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
  }>;
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

**Validation/Fallback**:
- Filters activities by `tech_category` matching preset
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

**Purpose**: Stage 2 — Generate a complete preset from description and interview answers using **HYBRID activity selection**.

**When Used**: After user completes preset wizard questions.

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
1. Fetch activities from DB filtered by `suggestedTechCategory` + `MULTI`
2. Format catalog in compact notation for prompt (saves tokens)
3. AI returns mixed activities: some with `existingCode`, some with `isNew: true`

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
      title: string;
      description: string;
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
  };
  metadata: {
    cached: boolean;
    generationTimeMs: number;
  };
}
```

**Token Optimization**:
- Catalog filtered by tech category (reduces ~75% of activities)
- Compact notation: `CODE|hours|name: description_truncated`
- Estimated additional cost: ~$0.004/request

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
  error: string,          // Error code/type
  message?: string        // Human-readable message (Italian)
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (invalid/missing auth token) |
| 403 | Forbidden (origin not allowed) |
| 405 | Method not allowed (only POST accepted) |
| 429 | Rate limit exceeded |
| 500 | Server error (API key missing, OpenAI error) |

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

**Last Updated**: 2026-02-08  
**Derived from**: Existing Netlify Functions source code in `netlify/functions/`
