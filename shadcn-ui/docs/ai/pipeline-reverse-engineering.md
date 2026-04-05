# AI Pipeline Reverse Engineering — Document → Project Map

> **Date:** 2026-04-05  
> **Scope:** Complete reverse engineering of the AI pipeline that transforms unstructured user documentation into structured project artifacts (Requirement Understanding → Impact Map → Blueprint → Candidate Set → Estimation).  
> **Method:** All findings are derived from code inspection. No speculation.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Entry Point Analysis](#2-entry-point-analysis)
3. [Document → Understanding](#3-document--understanding)
4. [Understanding → Impact Map](#4-understanding--impact-map)
5. [Impact Map → Blueprint](#5-impact-map--blueprint)
6. [Blueprint + ImpactMap + Understanding → Candidate Set](#6-candidate-set-generation)
7. [Candidate Set → Estimation (Interview / SKIP)](#7-candidate-set--estimation)
8. [Artifact Flow Diagram](#8-artifact-flow-diagram)
9. [Model Usage Matrix](#9-model-usage-matrix)
10. [Prompt Engineering Analysis](#10-prompt-engineering-analysis)
11. [Coupling & Weak Points](#11-coupling--weak-points)
12. [Wizard vs Quick Estimate — Source of Truth Analysis](#12-wizard-vs-quick-estimate)
13. [Architectural Criticalities](#13-architectural-criticalities)

---

## 1. Pipeline Overview

The system implements a **progressive enrichment pipeline** where each AI artifact feeds into the next, narrowing ambiguity at each stage.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       USER INPUT (raw text)                              │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Validation Gate    │  gpt-4o-mini, temp=0, max=200
                    │  (Quality filter)   │  → isValid, confidence, category
                    └─────────┬──────────┘
                              │ pass (conf < 0.7 || isValid)
                    ┌─────────▼──────────┐
                    │  Requirement        │  gpt-4o-mini, temp=0.2, max=2000
                    │  Understanding      │  → businessObjective, perimeter,
                    │  (Business Analyst) │     actors, stateTransition, complexity
                    └─────────┬──────────┘
                              │ + user confirmation
                    ┌─────────▼──────────┐
                    │  Impact Map         │  gpt-4o-mini, temp=0.2, max=2000
                    │  (Solution Arch.)   │  → layers[], actions[], components[]
                    └─────────┬──────────┘
                              │ + user confirmation
                    ┌─────────▼──────────┐
                    │  Estimation         │  gpt-4o-mini, temp=0.2, max=3000
                    │  Blueprint          │  → components[], integrations[],
                    │  (Technical Lead)   │     dataEntities[], testingScope[]
                    └─────────┬──────────┘
                              │ + user confirmation
                    ┌─────────▼──────────┐
                    │  Interview Planner  │  gpt-4o, temp=0, max=4500
                    │  (Information Gain) │  → decision (ASK|SKIP), preEstimate,
                    │  + CandidateBuilder │     questions[], suggestedActivities[]
                    └────┬────────┬───────┘
                    ASK  │        │ SKIP
             ┌───────────▼─┐  ┌──▼──────────────┐
             │  User       │  │  Direct estimate │
             │  Interview  │  │  (empty answers) │
             └──────┬──────┘  └────────┬─────────┘
                    │                  │
                    └──────┬───────────┘
                    ┌──────▼──────────┐
                    │  Estimation      │  gpt-4o, temp=0, max=4096
                    │  from Interview  │  → activities[], drivers[], risks[],
                    │  + CandidateSet  │     totalBaseDays, confidenceScore
                    └──────┬──────────┘
                           │
                    ┌──────▼──────────┐
                    │  Deterministic   │  (no AI)
                    │  Engine          │  → base_hours → drivers → risks →
                    │                  │     contingency → totalDays
                    └──────┬──────────┘
                           │
                    ┌──────▼──────────┐
                    │  Persistence     │  Supabase: domain chain +
                    │  (Orchestrator)  │  AI artifact tables + RPC
                    └─────────────────┘
```

---

## 2. Entry Point Analysis

### 2.1 Entry Points Table

| Entry Point | Endpoint | Role | Model | Input Format |
|---|---|---|---|---|
| **Validation Gate** | `ai-requirement-understanding` (internal) | Quality filter | gpt-4o-mini | raw text |
| **Understanding Generator** | `/.netlify/functions/ai-requirement-understanding` | Business analysis | gpt-4o-mini | raw text + techCategory + projectContext |
| **Impact Map Generator** | `/.netlify/functions/ai-impact-map` | Architecture mapping | gpt-4o-mini | raw text + understanding (optional) + projectTechnicalBlueprint (optional) |
| **Blueprint Generator** | `/.netlify/functions/ai-estimation-blueprint` | Technical decomposition | gpt-4o-mini | raw text + understanding (optional) + impactMap (optional) |
| **Interview Planner** | `/.netlify/functions/ai-requirement-interview` | Information-gain decision | gpt-4o | raw text + ALL artifacts + activity catalog |
| **Estimation Engine** | `/.netlify/functions/ai-estimate-from-interview` | Activity selection | gpt-4o (configurable) | raw text + ALL artifacts + answers + catalog |
| **Title Generator** | `/.netlify/functions/ai-suggest` (action: generate-title) | Utility | gpt-4o-mini | raw text |
| **Consultant Analysis** | action: consultant-analysis | Post-estimation review | gpt-4o | estimation + activities + blueprint |

### 2.2 Wizard Flow vs Quick Estimate V2

| Dimension | Wizard (7-step) | Quick Estimate V2 |
|---|---|---|
| **Steps** | Step1(desc) → Understanding → ImpactMap → Blueprint → Interview → Drivers/Risks → Results | validation → understanding → impact-map → blueprint → interview-planner → estimation → finalize |
| **User confirmation** | Each artifact confirmed manually (`*Confirmed: true`) | Auto-confirmed (no user review) |
| **Interview** | ASK → user answers questions, SKIP → direct estimate | Always SKIP (empty answers) |
| **Persistence** | Full: AI artifact tables + domain chain + estimation RPC + snapshot | Returns result; caller persists |
| **Escalation** | N/A (already full wizard) | `shouldEscalate: true` if confidence < 0.60 or planner says ASK + confidence < 0.80 |

### 2.3 Other Entry Points

- **`generate-project-from-documentation`**: Two-pass extraction from project-level documentation → project metadata (Pass 1) + component/integration graph (Pass 2). NOT part of requirement pipeline. Produces `ProjectTechnicalBlueprint` which is consumed downstream as context.
- **`generate-preset`**: Generates reusable activity templates from project description. Independent of requirement pipeline.
- **`generate-questions`** (standalone): Legacy question generation for interview. Superseded by `ai-requirement-interview` planner.

---

## 3. Document → Understanding

### 3.1 Responsible Function

**Action:** `netlify/functions/lib/ai/actions/generate-understanding.ts`  
**Prompt:** `netlify/functions/lib/ai/prompts/understanding-generation.ts`  
**Client API:** `src/lib/requirement-understanding-api.ts` → `generateRequirementUnderstanding()`

### 3.2 Input

```typescript
{
  description: string,           // raw text, sanitized 15-2000 chars
  techCategory?: string,         // e.g. "POWER_PLATFORM", "BACKEND"
  techPresetId?: string,
  projectContext?: ProjectContext, // name, description, owner, projectType, domain, ...
  normalizationResult?: { normalizedDescription?: string }  // legacy, rarely present
}
```

### 3.3 Model Configuration

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Temperature | 0.2 |
| Max Tokens | 2000 |
| Response Format | Strict JSON schema |
| Cache | 12h TTL, key = `ai:understand:{hash(description[:300] + techCategory)}` |

### 3.4 System Prompt (Role: Business Analyst)

**Language:** Italian  
**Core instruction:** "Produce structured understanding from requirement description. Never invent facts — use `assumptions` for ambiguity."

**Key prompt directives:**
- Extract businessObjective and expectedOutput
- Identify functionalPerimeter (explicit scope boundaries)
- List exclusions (explicitly out-of-scope)
- Map actors with their interaction mode
- Define stateTransition (before/after)
- List preconditions and assumptions
- Assess complexity (LOW/MEDIUM/HIGH) with rationale

### 3.5 Output Schema (Strict JSON)

```typescript
interface RequirementUnderstanding {
  businessObjective: string;          // what the requirement aims to achieve
  expectedOutput: string;             // concrete deliverable
  functionalPerimeter: string[];      // scope items (e.g. "dashboard utente", "form approvazione")
  exclusions: string[];               // explicitly out-of-scope
  actors: Array<{
    role: string;                     // e.g. "Amministratore", "Utente finale"
    interaction: string;              // e.g. "CRUD", "read-only", "approval"
  }>;
  stateTransition: {
    initialState: string;             // before implementation
    finalState: string;               // after implementation
  };
  preconditions: string[];            // must exist before
  assumptions: string[];              // AI's explicit assumptions when info is missing
  complexityAssessment: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    rationale: string;
  };
  confidence: number;                 // 0.0–1.0
}
```

### 3.6 Information Extraction Analysis

| Field | Source | Reliability |
|---|---|---|
| `businessObjective` | Inferred from description | Medium — depends on description quality |
| `functionalPerimeter` | Keyword extraction + semantic inference | **Critical downstream** — feeds Understanding Signal Extractor |
| `actors` | Named entity recognition in description | Low-Medium — often under-specified in input |
| `stateTransition` | Semantic inference | Low — often fabricated when description is vague |
| `complexityAssessment` | Holistic AI judgment | Medium — feeds variant routing (_SM/_LG) |
| `assumptions` | Gap-filling | **Key value** — makes implicit decisions explicit |

### 3.7 What Is NOT Extracted

- No technical architecture information (delegated to Impact Map)
- No effort/time estimates (delegated to Blueprint + Engine)
- No test strategy (delegated to Blueprint)
- **No traceability to source text fragments** (unlike `generate-project-from-documentation` which includes `evidence[]`)

---

## 4. Understanding → Impact Map

### 4.1 Responsible Function

**Action:** `netlify/functions/lib/ai/actions/generate-impact-map.ts`  
**Prompt:** `netlify/functions/lib/ai/prompts/impact-map-generation.ts`  
**Client API:** `src/lib/impact-map-api.ts` → `generateImpactMap()`

### 4.2 Input Enrichment

The Impact Map receives Understanding as **upstream context injection** (formatted as plaintext block in the user prompt):

```
COMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall'utente — usala per ridurre ambiguità, NON ignorare descrizione originale):
- Obiettivo: {businessObjective}
- Output atteso: {expectedOutput}  
- Perimetro: {functionalPerimeter.join('; ')}
- Esclusioni: {exclusions.join('; ')}
- Attori: {actors.map(a => `${a.role} (${a.interaction})`).join(', ')}
- Transizione: da "{initialState}" a "{finalState}"
- Precondizioni: {preconditions.join('; ')}
- Assunzioni: {assumptions.join('; ')}
- Complessità stimata: {level} — {rationale}
- Confidenza comprensione: {confidence * 100}%
```

Also receives **Project Technical Blueprint** (if available, truncated to 2000 chars):
```
BASELINE ARCHITETTURA PROGETTO (dal blueprint tecnico del progetto — usala per contestualizzare il requisito rispetto ai componenti esistenti):
```

### 4.3 Model Configuration

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Temperature | 0.2 |
| Max Tokens | 2000 |
| Response Format | Strict JSON schema |
| Cache | 12h TTL |

### 4.4 System Prompt (Role: Solution Architect)

**Key directives:**
- Map architectural layers impacted by the requirement
- **7 allowed layers:** `frontend`, `logic`, `data`, `integration`, `automation`, `configuration`, `ai_pipeline`
- **4 action types:** `read`, `modify`, `create`, `configure`
- **CRITICAL:** Component names must be architecture-oriented, NOT task names
- Technology-agnostic output; technology context serves only for interpretation

### 4.5 Output Schema

```typescript
interface ImpactMap {
  summary: string;
  impacts: Array<{
    layer: 'frontend' | 'logic' | 'data' | 'integration' | 'automation' | 'configuration' | 'ai_pipeline';
    action: 'read' | 'modify' | 'create' | 'configure';
    components: string[];       // architectural component names
    reason: string;             // why this layer is impacted
    confidence: number;         // 0.0–1.0
  }>;
  overallConfidence: number;    // 0.0–1.0
}
```

### 4.6 Transformation Analysis

**What Understanding brings to Impact Map:**
- `functionalPerimeter` → helps identify which layers are involved
- `actors + interaction` → helps determine action types (read/modify/create)
- `complexityAssessment` → influences component density
- `exclusions` → should constrain layers (but this is weakly enforced—see §11)

**What is lost/transformed:**
- Understanding's `stateTransition` is serialized as text but has **no structured influence** on impact mapping
- Actor interaction modes are flattened to string — no programmatic action mapping
- The prompt says "don't ignore the original description" — meaning Understanding is **advisory, not authoritative**

---

## 5. Impact Map → Blueprint

### 5.1 Responsible Function

**Action:** `netlify/functions/lib/ai/actions/generate-estimation-blueprint.ts`  
**Prompt:** `netlify/functions/lib/ai/prompts/blueprint-generation.ts`  
**Client API:** `src/lib/estimation-blueprint-api.ts` → `generateEstimationBlueprint()`

### 5.2 Input Enrichment

Blueprint receives both Understanding and Impact Map as upstream context (same `formatUnderstandingBlock` + `formatImpactMapBlock` functions). However, in the **wizard flow**, each is only injected if **confirmed by the user**:

```typescript
requirementUnderstanding:
  data.requirementUnderstanding && data.requirementUnderstandingConfirmed
    ? data.requirementUnderstanding
    : undefined,
impactMap:
  data.impactMap && data.impactMapConfirmed
    ? data.impactMap
    : undefined,
```

### 5.3 Model Configuration

| Parameter | Value |
|---|---|
| Model | gpt-4o-mini |
| Temperature | 0.2 |
| Max Tokens | 3000 |
| Response Format | Strict JSON schema |
| Cache | 12h TTL |

### 5.4 System Prompt (Role: Technical Lead)

**Key directives:**
- Decompose requirement into structured technical work model
- **NO hours/days/effort** — this is a structural model, not a schedule
- **NO activity selection** — that's the CandidateBuilder's job
- **NO driver/risk suggestions** — that's the estimation endpoint's job
- Intervention types: `new_development`, `modification`, `configuration`, `integration`, `migration`

### 5.5 Output Schema

```typescript
interface EstimationBlueprint {
  summary: string;
  components: Array<{
    name: string;
    layer: string;                    // matches ImpactMap layers
    interventionType: string;         // new_development | modification | configuration | integration | migration
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    notes: string;
  }>;
  integrations: Array<{
    target: string;
    type: string;
    direction: string;
    notes: string;
  }>;
  dataEntities: Array<{
    entity: string;
    operation: 'read' | 'write' | 'create' | 'modify' | 'delete';
    notes: string;
  }>;
  testingScope: Array<{
    area: string;
    testType: string;
    criticality: string;
  }>;
  assumptions: string[];
  exclusions: string[];
  uncertainties: string[];
  overallConfidence: number;
  reasoning: string;
}
```

### 5.6 Structural Role

The Blueprint is the **most structurally important artifact** for downstream processing because:

1. `blueprintResult = mapBlueprintToActivities(blueprint, catalog, techCategory)` in CandidateBuilder
2. Blueprint components' `layer` + `interventionType` + `complexity` are the primary signals for deterministic activity mapping
3. Blueprint has the **highest weight** in CandidateBuilder scoring: `WEIGHTS.blueprint = 3.0`

**Critical coupling:** Blueprint's `layer` field must produce values that align with `LAYER_TECH_PATTERNS` keys. The prompt says "frontend, logic, data, integration, automation, configuration" which matches — but the AI could produce `ai_pipeline` which is in `UNSUPPORTED_LAYERS` and gets silently dropped.

---

## 6. Candidate Set Generation

### 6.1 The CandidateBuilder — 3-Layer Architecture

**File:** `netlify/functions/lib/candidate-builder.ts`

This is the **most critical component** — it bridges AI artifacts to the deterministic estimation engine.

### 6.2 Layer 1: Signal Extraction (4 parallel channels)

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│  Blueprint   │  │  ImpactMap   │  │ Understanding │  │   Keyword    │
│  Mapper      │  │  Extractor   │  │  Extractor    │  │   Ranker     │
│  (det.)      │  │  (det.)      │  │  (det.)       │  │  (heuristic) │
└──────┬───────┘  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘
       │                 │                  │                  │
       │ Map<code,score> │ Map<code,score>  │ Map<code,score>  │ Map<code,score>
       └────────┬────────┴──────────┬───────┴──────────┬───────┘
                │                   │                  │
         ┌──────▼───────────────────▼──────────────────▼──────┐
         │              MERGE (weighted sum)                    │
         │  bp*3.0 + im*2.0 + un*1.5 + kw*1.0 + ctx*0.5      │
         └─────────────────────┬───────────────────────────────┘
                               │
                        ┌──────▼──────┐
                        │  SELECT     │ sort by totalScore DESC
                        │  top-N (20) │ → ScoredCandidate[]
                        └─────────────┘
```

### 6.3 Signal Extractors Detail

#### Blueprint Activity Mapper (`blueprint-activity-mapper.ts`)

- **Input:** Blueprint `components[]` with `layer` + `interventionType` + `complexity`
- **Mechanism:** `LAYER_TECH_PATTERNS[techCategory][layer]` → pattern prefixes → `findBestMatch(catalog, prefix, complexity)`
- **Variant routing:** complexity LOW → `_SM` suffix, HIGH → `_LG` suffix, MEDIUM → base
- **Deterministic:** No AI involved — pure lookup table
- **Weight:** 3.0 (dominant)

#### Impact Map Signal Extractor (`impact-map-signal-extractor.ts`)

- **Input:** ImpactMap `impacts[]` with `layer` + `action` + `components[]` + `confidence`
- **Mechanism:** Same `LAYER_TECH_PATTERNS` lookup, but adds action weighting (create=1.0, modify=0.8, configure=0.5, read=0.2) and component density bonus
- **Deterministic:** No AI — pure lookup
- **Weight:** 2.0

#### Understanding Signal Extractor (`understanding-signal-extractor.ts`)

- **Input:** Understanding `functionalPerimeter[]` + `complexityAssessment`
- **Mechanism:** `PERIMETER_LAYER_MAP` → keyword matching on perimeter terms → layer mapping → same `LAYER_TECH_PATTERNS` lookup
- **Deterministic:** No AI — structured keyword match + lookup
- **Weight:** 1.5
- **65 explicit patterns** in `PERIMETER_LAYER_MAP` (UI, data, logic, integration, automation, config, security groups)

#### Keyword Ranker (`selectTopActivities`)

- **Input:** Description text + interview answers (if any)
- **Mechanism:** Text matching against activity names/descriptions
- **Heuristic:** Linear score decay from 1.0 (best match) to ~0.1
- **Weight:** 1.0 (lowest)
- **Always runs** as baseline even when structured sources are available

### 6.4 Merge Logic

For each activity code appearing in ANY signal source:

```
totalScore = (blueprintScore * 3.0) + (impactMapScore * 2.0) + (understandingScore * 1.5) + (keywordScore * 1.0) + (contextBias * 0.5)
```

- **Confidence:** `max(bp.confidence, im.confidence, un.confidence, kw.score)`
- **Primary source:** Whichever contributes the highest weighted score
- **Provenance:** Full trace chain (e.g. `blueprint:logic → pattern:PP_FLOW_COMPLEX → resolved:PP_FLOW_CMP_01`)

### 6.5 Strategy Detection

The builder reports its strategy based on available sources:
- `blueprint+impactmap+understanding` (best: 3 structural signals)
- `blueprint+impactmap`, `blueprint+understanding`, etc.
- `keyword-only` (worst: no structured input)

---

## 7. Candidate Set → Estimation

### 7.1 Interview Planner (Round 0)

**File:** `netlify/functions/ai-requirement-interview.ts`

**Role:** Pre-estimates the requirement and decides whether to ask clarifying questions.

| Parameter | Value |
|---|---|
| Model | gpt-4o |
| Temperature | 0 |
| Max Tokens | 4500 |
| SKIP Threshold | confidence ≥ 0.90 AND range ≤ 16h |
| RAG Auto-SKIP | similarity ≥ 0.85 |
| Max Questions | 3 |
| Min Impact | 15% range reduction |

**Server-side decision enforcement:**
- Model says SKIP → verify confidence ≥ 0.90 AND range ≤ 16h (or RAG boost)
- Model says ASK → keep ASK unless all questions filtered out by impact threshold
- Questions filtered: `expectedRangeReductionPct >= 15%`
- Questions capped at 3

**Prompt receives:** ALL upstream artifacts formatted as text blocks + activity catalog + RAG examples.

### 7.2 Estimation from Interview (Round 1)

**File:** `netlify/functions/ai-estimate-from-interview.ts`

| Parameter | Value |
|---|---|
| Model | gpt-4o (default, configurable via `AI_ESTIMATION_MODEL`) |
| Temperature | 0 |
| Max Tokens | 4096 |
| Pipeline | Legacy (linear) or Agentic (if `AI_AGENTIC=true`) |

**Two paths:**

1. **Agentic** (`AI_AGENTIC=true`): Reflection loop + tool-use → retry if confidence < threshold
2. **Legacy Linear** (default): Single LLM call with dynamic response schema

**Critical feature:** The response schema includes `code: { enum: validActivityCodes }` — the AI can ONLY select activities from the catalog. This eliminates hallucinated activity codes entirely.

**Deterministic rules in prompt:**
- MANDATORY activities by keyword pattern (email→FLOW, form→FORM, test→TEST, deploy→DEPLOY)
- Variant selection (_SM/_LG) based on answer keywords ("semplice"→_SM, "complesso"→_LG)
- Confidence score is deterministic: 0.90/0.80/0.70/0.60 based on answer coverage percentage

**Pre-estimate anchor:** The `preEstimate` from Round 0 is injected as a calibration reference.

---

## 8. Artifact Flow Diagram

### 8.1 Data Flow (Wizard)

```
USER TEXT (description)
    │
    ├──► [validate-requirement] ──► RequirementValidationResult {isValid, confidence, category}
    │                                    │
    │    (if valid or dismissed)         │
    │                                    ▼ (stored in wizard state only, not persisted)
    │
    ├──► [generate-understanding] ──► RequirementUnderstanding (JSON)
    │         ▲ receives:                    │
    │         │ description                  │ stored in wizard state
    │         │ techCategory                 │ user reviews + edits
    │         │ projectContext               │ user confirms → requirementUnderstandingConfirmed=true
    │                                        ▼
    │
    ├──► [generate-impact-map] ──► ImpactMap (JSON)
    │         ▲ receives:                │
    │         │ description              │ stored in wizard state
    │         │ techCategory             │ user reviews + edits
    │         │ understanding (if confirmed) │ user confirms → impactMapConfirmed=true
    │         │ projectTechnicalBlueprint    ▼
    │
    ├──► [generate-estimation-blueprint] ──► EstimationBlueprint (JSON)
    │         ▲ receives:                        │
    │         │ description                      │ stored in wizard state
    │         │ techCategory                     │ user reviews + edits
    │         │ understanding (if confirmed)     │ user confirms → estimationBlueprintConfirmed=true
    │         │ impactMap (if confirmed)          ▼
    │
    ├──► [ai-requirement-interview] ──► InterviewPlan {decision, preEstimate, questions[]}
    │         ▲ receives:                    │
    │         │ description                  ├── ASK → user answers questions
    │         │ ALL 4 artifacts              │
    │         │ activity catalog             ├── SKIP → empty answers
    │         │ projectContext               ▼
    │
    ├──► [ai-estimate-from-interview] ──► EstimationResult {activities[], drivers[], risks[]}
    │         ▲ receives:                        │
    │         │ description                      │ + candidateProvenance[]
    │         │ ALL 4 artifacts                  │ + confidenceScore
    │         │ answers                          │ + reasoning
    │         │ preEstimate (anchor)             ▼
    │         │ activity catalog
    │
    └──► [DETERMINISTIC ENGINE] ──► totalDays, baseDays, driverMultiplier, etc.
              ▲ receives:
              │ selected activity codes
              │ driver values
              │ risk codes
```

### 8.2 Data Format at Each Boundary

| Boundary | Format | Notes |
|---|---|---|
| User → Step1 | `string` (raw text) | 15-2000 chars after sanitization |
| Step1 → Understanding | `{description, techCategory, projectContext}` | JSON POST to Netlify function |
| Understanding output | Typed JSON (Zod-validated) | Stored in wizard state as `RequirementUnderstanding` |
| Understanding → ImpactMap | Formatted as plaintext block in user prompt | **Lossy:** structured object → flattened text |
| ImpactMap output | Typed JSON (Zod-validated) | Stored in wizard state as `ImpactMap` |
| ImpactMap → Blueprint | Formatted as plaintext block in user prompt | **Lossy:** structured object → flattened text |
| Blueprint output | Typed JSON (Zod-validated) | Stored in wizard state as `EstimationBlueprint` |
| All artifacts → Interview | 4 × plaintext blocks + JSON activity catalog | **All structured data flattened to text** for LLM |
| All artifacts → CandidateBuilder | Typed objects (direct property access) | **Lossless:** structural extractors use typed fields |
| CandidateBuilder → LLM | `activitiesCatalog` (text list) + `provenanceHint` | **Lossy:** candidate scores reduced to text hint |
| LLM → Response | Strict JSON schema (Zod-validated) | Enum constraint on activity codes |
| Result → Domain Save | Typed input to `orchestrateDomainSave()` | Full provenance chain preserved |

### 8.3 What Is Lost Between Steps

| Transition | Information Lost |
|---|---|
| Understanding → ImpactMap (LLM) | Structured fields flattened to text. LLM must re-parse semantics. |
| ImpactMap → Blueprint (LLM) | Same: structural JSON → text. Component names not guaranteed to align. |
| Blueprint → CandidateBuilder | **Nothing lost** — structural fields accessed directly |
| CandidateBuilder → LLM Estimation | Scored candidates reduced to catalog list + text hint. Per-candidate scores not reflected in prompt. |
| Estimation Result → Domain Save | `candidateProvenance` preserved. But LLM's `reasoning` is stored as opaque text, not structured. |

---

## 9. Model Usage Matrix

| Step | Model | Temperature | Max Tokens | Structured Output | Cache | Fallback |
|---|---|---|---|---|---|---|
| Validation | gpt-4o-mini | 0 | 200 | Strict JSON | 24h | fail-open (proceed) |
| Understanding | gpt-4o-mini | 0.2 | 2000 | Strict JSON | 12h | error → skip step |
| Impact Map | gpt-4o-mini | 0.2 | 2000 | Strict JSON | 12h | error → skip step |
| Blueprint | gpt-4o-mini | 0.2 | 3000 | Strict JSON | 12h | error → skip step |
| Interview Planner | **gpt-4o** | 0 | 4500 | Strict JSON | no | error → fallback questions |
| Estimation | **gpt-4o** | 0 | 4096 | Dynamic strict JSON (enum) | no | agentic → legacy fallback |
| Title | gpt-4o-mini | 0.3 | 30 | raw text | 6h | — |
| Consultant Review | gpt-4o | 0 | 4000 | Strict JSON | no | — |
| Questions (legacy) | gpt-4o-mini | 0.5 | 1000 | JSON | no | 3 generic fallback questions |

**Cost observation:** Artifact generation (Understanding, ImpactMap, Blueprint) uses the cheaper gpt-4o-mini. Only the decision-critical steps (Interview Planner, Estimation) use gpt-4o.

---

## 10. Prompt Engineering Analysis

### 10.1 Understanding Prompt

**Strengths:**
- Italian language matching user input
- Clear "never invent facts" constraint
- Structured output forces completeness
- `assumptions` field makes AI's gap-filling explicit

**Gaps:**
- No instruction to anchor perimeter terms to known vocabulary (the Understanding Signal Extractor's `PERIMETER_LAYER_MAP` depends on specific Italian terms like "dashboard", "workflow", "integrazione" — but the prompt doesn't constrain the AI to use these terms)
- No size limit on `functionalPerimeter[]` — could produce 1 item or 20
- No instruction to distinguish "in-scope modifications" from "new developments"

**Implicit bias:**
- The prompt says "Business Analyst" role — biases toward business language, not technical decomposition
- `stateTransition` forces a before/after framing that may not fit all requirements (e.g., "add monitoring dashboard" has no clear "initial state")

### 10.2 Impact Map Prompt

**Strengths:**
- Fixed layer taxonomy prevents drift
- "Component names must be architecture-oriented, NOT task names" is explicit
- Per-impact confidence allows downstream filtering

**Gaps:**
- No instruction to align component names with Blueprint component names (these are generated independently)
- `ai_pipeline` is an allowed layer in the prompt but in `UNSUPPORTED_LAYERS` — signals from this layer are silently dropped by extractors
- No constraint on number of impacts — could produce 1 or 15

**Implicit bias:**
- "Technology-agnostic" output, but technology context is injected — the AI must decide how much tech-awareness to apply, which is ambiguous

### 10.3 Blueprint Prompt

**Strengths:**
- Explicit "NO hours/days/effort" — prevents confounding structural model with estimates
- Clear intervention type taxonomy
- Testing scope forces test strategy consideration

**Gaps:**
- No instruction to use the SAME component names as Impact Map
- `layer` field is free-text (not constrained like Impact Map's enum) — could produce non-standard values
- No constraint linking `dataEntities` to Impact Map's `data` layer impacts

### 10.4 Interview Planner Prompt

**Strengths:**
- Information-gain framework (% reduction per question) is sophisticated
- Server-side enforcement overrides model if SKIP criteria not met
- Tech-specific question templates per technology category
- `expectedRangeReductionPct` metric makes question value quantifiable

**Gaps:**
- Min 15% impact filter may be too aggressive — useful clarifications below 15% are silently dropped
- RAG auto-SKIP at 85% similarity could lead to incorrect SKIP for superficially similar but structurally different requirements
- Pre-estimate anchoring creates **anchoring bias** — the estimation is biased toward the pre-estimate range

### 10.5 Estimation Prompt

**Strengths:**
- Deterministic keyword → activity rules reduce variance
- Enum constraint on activity codes eliminates hallucination
- Confidence score formula is deterministic (not AI-judged)
- `fromAnswer` + `fromQuestionId` create audit trail

**Gaps:**
- "MANDATORY activities by keywords" is a blunt instrument — "email" in description ALWAYS triggers FLOW, even if email is tangential
- _SM/_LG routing depends on specific Italian words ("semplice", "complesso") — doesn't handle nuanced answers
- The prompt says "da TECNICO A TECNICO" but actual interview answers come from potentially non-technical users

---

## 11. Coupling & Weak Points

### 11.1 Implicit Dependencies

| Dependency | Nature | Risk |
|---|---|---|
| Understanding `functionalPerimeter[]` → PERIMETER_LAYER_MAP keywords | AI output must use terms that match 65 hardcoded Italian patterns | **HIGH** — if AI uses "interfaccia di gestione" instead of "interfaccia" or "schermata", the pattern match fails |
| ImpactMap `layer` → LAYER_TECH_PATTERNS keys | 7 valid layers, AI knows them via prompt constraint | LOW — schema enum enforces |
| Blueprint `layer` → LAYER_TECH_PATTERNS keys | **No enum constraint in schema** — free-text field | **MEDIUM** — AI could produce "backend" instead of "logic" |
| Blueprint `interventionType` → ACTION_TO_INTERVENTIONS values | Prompt specifies valid values; extractor maps them | LOW |
| Blueprint `complexity` → variant routing (_SM/_LG) | Prompt specifies LOW/MEDIUM/HIGH | LOW |
| `ai_pipeline` layer in Impact Map/Blueprint | Produced by AI but in `UNSUPPORTED_LAYERS` — silently dropped | LOW — data loss but not failure |
| Activity catalog freshness | Extractors use catalog codes that must exist in DB | LOW — catalog changes are rare |

### 11.2 Information Loss Points

1. **Structured → Text → Structured round-trips:** Understanding (JSON) is serialized to plaintext for Impact Map prompt, then Impact Map (JSON) is serialized to plaintext for Blueprint prompt. Each time, the AI must reconstruct structured semantics from text. This is lossy and introduces drift.

2. **CandidateBuilder scores → LLM:** The CandidateBuilder produces precise per-activity scores and provenance, but these are only passed to the LLM as a `provenanceHint` text block. The LLM's activity selection is **not constrained by CandidateBuilder scores** — it makes its own selection from the full catalog.

3. **User edits to Understanding are NOT propagated downstream automatically.** If the user edits `functionalPerimeter` in Step 2, the Impact Map (generated in Step 3) does NOT auto-regenerate. The edited understanding is passed to the Impact Map generator on the next generation, but if the Impact Map was already generated, stale data persists.

### 11.3 Incoherences Between Artifacts

| Incoherence | Example | Impact |
|---|---|---|
| Understanding perimeter ≠ Impact Map layers | Understanding says "dashboard, report, workflow" → ImpactMap might not map "report" to `data` layer | CandidateBuilder misses data-layer activities |
| Impact Map components ≠ Blueprint components | ImpactMap says "User Management Module" → Blueprint says "Auth Component" | No structural harm (different extractors) but confusing in UI |
| Blueprint `layer` values ≠ LAYER_TECH_PATTERNS keys | Blueprint says "api" → extractor expects "logic" or "integration" | Silent signal loss in blueprint-activity-mapper |
| Understanding complexity ≠ Blueprint component complexity | Understanding says HIGH overall → Blueprint has mixed LOW/MEDIUM/HIGH per component | Variant routing uses Blueprint per-component values (correct), not Understanding global |

### 11.4 Logical Duplications

1. **Activity selection done twice:** CandidateBuilder runs deterministic multi-signal extraction → produces ranked candidates. Then LLM runs again with the full catalog → makes its own selection. These may disagree. The `provenanceHint` is an attempt to align them but is not a constraint.

2. **Complexity assessment done three times:** Understanding (global), Blueprint (per-component), LLM estimation (ad hoc). Only Blueprint per-component is used for variant routing.

3. **Layer mapping done twice:** ImpactMap AI generates layer assignments. Then the signal extractors re-derive layer→activity mappings. If the AI's layer assignments were directly used as candidate signals (with confidence), the extractors would be simpler.

### 11.5 Points Where AI "Guesses" Instead of Derives

| Point | What the AI does | What would be derivable |
|---|---|---|
| Understanding's `stateTransition` | Often fabricated for vague inputs | Could be omitted with a confidence-gated rule |
| Impact Map `components[]` | Free-text component names — invented | Could be constrained to a component taxonomy per tech |
| Blueprint `summary` | Narrative synthesis | Derivable deterministically from component/integration counts |
| Interview planner `expectedRangeReductionPct` | AI estimates impact per question | Could be backtested from historical data (RAG) |
| Estimation `reason` per activity | Free-text justification | CandidateBuilder already has structural provenance |

---

## 12. Wizard vs Quick Estimate — Source of Truth Analysis

### 12.1 Why the Wizard Is More Reliable

| Factor | Wizard | Quick Estimate V2 |
|---|---|---|
| **Artifact confirmation** | User reviews + optionally edits each artifact before it feeds the next step | Auto-confirms all artifacts without review |
| **Information gain** | Planner decides ASK/SKIP; if ASK, user provides answers that reduce uncertainty | Always SKIP — no interview, always empty answers |
| **Confidence** | Higher due to human validation + interview answers | Lower — escalation recommended at confidence < 0.80 |
| **Edit tracking** | `editCount` tracked per artifact; user edits are signal of understanding quality | No edits — AI output is final |
| **Backward compatibility** | Each artifact step is skippable (user can bypass Understanding, ImpactMap, Blueprint) | All steps always run; no skip mechanism |

### 12.2 What Makes the Wizard "Canonical"

1. **User confirmation flags** (`requirementUnderstandingConfirmed`, `impactMapConfirmed`, `estimationBlueprintConfirmed`) create a **human-validated chain**. Quick Estimate V2 auto-confirms without human review.

2. **Conditional artifact injection:** In the wizard, downstream steps only receive confirmed artifacts:
   ```typescript
   requirementUnderstanding:
     data.requirementUnderstanding && data.requirementUnderstandingConfirmed
       ? data.requirementUnderstanding
       : undefined
   ```
   Quick Estimate V2 always passes artifacts regardless of confirmation.

3. **Interview answers** provide real disambiguating data. Quick Estimate V2 always passes `answers: {}`.

4. **Full persistence chain:** Wizard saves ALL artifacts independently (requirement_understanding, impact_map, estimation_blueprint tables) + domain chain (requirement_analyses, impact_maps, candidate_sets, estimation_decisions). Quick Estimate V2 returns results for caller to persist.

### 12.3 Parts of the Pipeline That Are "Canonical"

| Component | Canonical? | Reason |
|---|---|---|
| CandidateBuilder 3-layer architecture | ✅ Yes | Used by BOTH wizard and quick estimate |
| LAYER_TECH_PATTERNS | ✅ Yes | Single source of truth for layer → activity mapping |
| Signal extractors (blueprint, impact-map, understanding) | ✅ Yes | Deterministic, shared across all entry points |
| AI artifact generation (understanding, impact-map, blueprint) | ✅ Yes | Same actions used by both paths |
| Interview planner decision logic | ⚠️ Partially | Wizard honors ASK/SKIP; quick estimate always passes SKIP |
| `orchestrateDomainSave` | ✅ Yes | Shared persistence path |
| `save_estimation_atomic` RPC | ✅ Yes | Single RPC for final estimation persist |

---

## 13. Architectural Criticalities

### 13.1 Critical Issues (High Priority)

1. **JSON → Text → JSON round-trip (information loss)**  
   Each artifact is structured JSON, but when passed to the next AI step, it's flattened to text. The receiving AI must re-interpret the text, which introduces drift. The CandidateBuilder correctly uses typed objects — but the LLM prompts do not.  
   **Recommendation:** Consider passing structured artifact data as separate schema-validated blocks in the API rather than flattening to text.

2. **Dual activity selection (LLM + CandidateBuilder)**  
   CandidateBuilder produces scored, provenance-tracked candidates. Then the LLM makes its own selection from the full catalog, guided only by a text hint. These can disagree.  
   **Recommendation:** CandidateBuilder output should constrain the LLM's selection (e.g., via an enum of top-N candidates in the schema).

3. **Understanding perimeter vocabulary mismatch**  
   `PERIMETER_LAYER_MAP` depends on 65 specific Italian keywords. The Understanding prompt does not constrain `functionalPerimeter[]` to use matching vocabulary.  
   **Recommendation:** Either normalize perimeter terms post-generation, or constrain the prompt to use terms from a known vocabulary.

### 13.2 Medium Issues

4. **Blueprint `layer` field is free-text (not enum-constrained)**  
   Unlike ImpactMap which has a schema enum for layers, Blueprint's JSON schema does not constrain `layer` values. This can cause silent signal loss in `blueprint-activity-mapper.ts`.

5. **`ai_pipeline` layer is allowed in prompt but unsupported by extractors**  
   The Impact Map and Blueprint prompts list `ai_pipeline` as a valid layer, but `UNSUPPORTED_LAYERS` silently skips it. Requirements involving AI/ML pipelines lose signal.

6. **No automatic re-generation on upstream edits**  
   If the user edits Understanding in Step 2 and then advances to Step 3 (Impact Map), the Impact Map is generated from the EDITED understanding. But if the user goes back to Step 2, edits again, and then re-enters Step 3, the Impact Map does not auto-regenerate. Stale artifacts persist in wizard state.

7. **Pre-estimate anchoring bias in estimation**  
   The `preEstimate` from Round 0 is injected as "anchor" in Round 1. This creates systematic anchoring bias — the LLM's final estimate tends to converge toward the pre-estimate range.

### 13.3 Low Issues

8. **Cache keys use description[:300] + techCategory**  
   Two different requirements with the same first 300 characters and same tech category would get cache hits from each other. Unlikely but possible.

9. **Consultant analysis runs post-estimation but doesn't feed back**  
   The consultant analysis produces `discrepancies[]` and `riskAnalysis[]` but these are purely informational. They don't trigger re-estimation or wizard step modifications.

10. **Project Technical Blueprint truncation (2000 chars)**  
    Large project blueprints are truncated, potentially losing important architectural context for complex projects.

---

## Appendix A: File Index

| Role | File |
|---|---|
| Wizard orchestrator | `src/components/requirements/RequirementWizard.tsx` |
| Wizard state | `src/hooks/useWizardState.ts` |
| Quick Estimate V2 | `src/hooks/useQuickEstimationV2.ts` |
| Understanding step UI | `src/components/requirements/wizard/WizardStepUnderstanding.tsx` |
| Impact Map step UI | `src/components/requirements/wizard/WizardStepImpactMap.tsx` |
| Blueprint step UI | `src/components/requirements/wizard/WizardStepBlueprint.tsx` |
| Interview step UI | `src/components/requirements/wizard/WizardStepInterview.tsx` |
| Validation gate UI | `src/components/requirements/wizard/WizardStep1.tsx` |
| Understanding API (client) | `src/lib/requirement-understanding-api.ts` |
| Impact Map API (client) | `src/lib/impact-map-api.ts` |
| Blueprint API (client) | `src/lib/estimation-blueprint-api.ts` |
| Interview API (client) | `src/lib/requirement-interview-api.ts` |
| Persistence (Supabase) | `src/lib/api.ts` (save/get functions) |
| AI handler factory | `netlify/functions/lib/handler/create-ai-handler.ts` |
| Interview planner endpoint | `netlify/functions/ai-requirement-interview.ts` |
| Estimation endpoint | `netlify/functions/ai-estimate-from-interview.ts` |
| Understanding action | `netlify/functions/lib/ai/actions/generate-understanding.ts` |
| Impact Map action | `netlify/functions/lib/ai/actions/generate-impact-map.ts` |
| Blueprint action | `netlify/functions/lib/ai/actions/generate-estimation-blueprint.ts` |
| Validation action | `netlify/functions/lib/ai/actions/validate-requirement.ts` |
| Consultant analysis action | `netlify/functions/lib/ai/actions/consultant-analysis.ts` |
| Understanding prompt | `netlify/functions/lib/ai/prompts/understanding-generation.ts` |
| Impact Map prompt | `netlify/functions/lib/ai/prompts/impact-map-generation.ts` |
| Blueprint prompt | `netlify/functions/lib/ai/prompts/blueprint-generation.ts` |
| CandidateBuilder | `netlify/functions/lib/candidate-builder.ts` |
| Blueprint Activity Mapper | `netlify/functions/lib/blueprint-activity-mapper.ts` |
| Impact Map Signal Extractor | `netlify/functions/lib/impact-map-signal-extractor.ts` |
| Understanding Signal Extractor | `netlify/functions/lib/understanding-signal-extractor.ts` |
| Domain Save Orchestrator | `netlify/functions/lib/domain/estimation/save-orchestrator.ts` |

## Appendix B: Persistence Tables

| Table | Content | Writer |
|---|---|---|
| `requirement_understanding` | AI understanding JSON + metadata, versioned | `saveRequirementUnderstanding()` |
| `impact_map` | AI impact map JSON + metadata, versioned | `saveImpactMap()` |
| `estimation_blueprint` | AI blueprint JSON + metadata, versioned | `saveEstimationBlueprint()` |
| `requirement_analyses` | Domain analysis record (links to understanding) | `save-orchestrator.ts` |
| `impact_maps` (domain) | Domain impact map record (links to analysis) | `save-orchestrator.ts` |
| `candidate_sets` | Scored candidates with provenance JSON | `save-orchestrator.ts` |
| `estimation_decisions` | Selected activities/drivers/risks | `save-orchestrator.ts` |
| `estimation_snapshots` | Point-in-time snapshot of all inputs | `save-orchestrator.ts` |
| `estimations` | Final estimation totals | `save_estimation_atomic` RPC |

## Appendix C: Weight Configuration

```
Signal Source          Weight    Nature
─────────────────────  ──────   ──────────────
Blueprint              3.0      Deterministic structural mapping
Impact Map             2.0      Deterministic layer→activity
Understanding          1.5      Deterministic perimeter→layer→activity
Keyword                1.0      Heuristic text matching
Project Context        0.5      Configured bias rules
```
