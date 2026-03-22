# Milestone 2: Impact Map — Architectural Analysis & Implementation Plan

**Date:** 2026-03-07  
**Revision:** R1 — 2026-03-07 (planning refinement pass)  
**Status:** PLANNING (no code changes)  
**Baseline:** Milestone 1 (Requirement Understanding) fully implemented

---

## Revision Summary (R1)

This revision strengthens the original Milestone 2 plan without changing its core architecture. The pipeline position, layer-based taxonomy, phased approach, and optional downstream threading are all preserved. The following areas are corrected or deepened:

| # | Area | What Changed |
|---|------|-------------|
| 1 | **Architectural contract** | New §2.6 — formal constraints ensuring Impact Map stays pre-task, never collapses into a WBS |
| 2 | **Layer boundary definitions** | New §3.4 — operational definitions per layer with inclusion/exclusion rules and cross-platform examples |
| 3 | **components[] discipline** | New §3.5 — strict rules on what components can/cannot contain, with good/bad examples |
| 4 | **Confidence semantics** | New §2.7 — operational role of confidence in Interview, Estimation, and UI; explicit anti-misuse rules |
| 5 | **Impact Map vs Activity Catalog** | New §7.7 — dedicated section on what Impact Map contributes vs. what the catalog does |
| 6 | **Prompt discipline** | New §7.8 — context-injection rules to prevent prompt bloat and Understanding duplication |
| 7 | **UI simplification** | §8 revised — minimal first iteration with future roadmap |
| 8 | **Anti-drift rules** | New §2.8 — generation guardrails preventing scope creep, tech invention, and Understanding repetition |
| 9 | **Risks** | §10 expanded with new entries for WBS drift, component granularity, and prompt discipline |

Preserved unchanged: §1 (Architecture Analysis), §4 (Backend Plan), §5 (Database Strategy), §6 (Wizard Integration), §9 (Implementation Roadmap phases), §11 (Recommendation — updated).

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Impact Map Role in the Pipeline](#2-impact-map-role-in-the-pipeline)
3. [Data Model Design](#3-data-model-design)
4. [Backend Implementation Plan](#4-backend-implementation-plan)
5. [Database Strategy](#5-database-strategy)
6. [Wizard Integration Plan](#6-wizard-integration-plan)
7. [Downstream Integration](#7-downstream-integration)
8. [UI Design Concept](#8-ui-design-concept)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Risks and Tradeoffs](#10-risks-and-tradeoffs)
11. [Final Recommendation](#11-final-recommendation)

---

## 1. Current Architecture Analysis

### 1.1 How Requirement Understanding Is Generated

**Trigger:** Automatic on entering wizard step 2 (index 2).

**Chain:**

```
WizardStepUnderstanding.tsx (mount effect)
  → generateRequirementUnderstanding() [src/lib/requirement-understanding-api.ts]
    → POST /.netlify/functions/ai-requirement-understanding
      → createAIHandler validates → calls generateRequirementUnderstanding() action
        → [netlify/functions/lib/ai/actions/generate-understanding.ts]
          → 12h cache lookup (ai:understand prefix)
          → UNDERSTANDING_SYSTEM_PROMPT + createUnderstandingResponseSchema()
            [netlify/functions/lib/ai/prompts/understanding-generation.ts]
          → OpenAI gpt-4o-mini (temp 0.2, max 2000 tokens, strict JSON)
          → Zod validation
          → Cache store
          → Return RequirementUnderstanding artifact
```

**Key patterns observed:**
- `createAIHandler` factory eliminates boilerplate (~50 lines per endpoint)
- Action file encapsulates: cache → LLM → validate cycle
- Prompt file exports: system prompt constant + JSON schema factory
- Type file provides both TypeScript interfaces and Zod schemas
- Client API wrapper handles: sanitization, auth, error mapping

### 1.2 How Wizard Steps Are Organized

**Current step array** (RequirementWizard.tsx):

| Index | Title | Component | Purpose |
|-------|-------|-----------|---------|
| 0 | Requirement | WizardStep1 | Description + metadata + normalization |
| 1 | Technology | WizardStep2 | Tech preset selection |
| 2 | Understanding | WizardStepUnderstanding | AI-generated requirement analysis |
| 3 | Technical Interview | WizardStepInterview | Round 0 planner + Round 1 estimation |
| 4 | Drivers & Risks | WizardStep4 | Multiplier/contingency selection |
| 5 | Results | WizardStep5 | Summary + title generation + save |

**Step contract:**
```typescript
interface StepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}
```

### 1.3 How AI Endpoints Are Structured

All endpoints follow the same 3-layer pattern:

```
[endpoint .ts]  →  uses createAIHandler()
  ↓
[action .ts]    →  cache → LLM → validate
  ↓
[prompt .ts]    →  system prompt + JSON schema
```

**Existing endpoints (7 total):**

| Endpoint | Action | Prompt File |
|----------|--------|-------------|
| ai-requirement-understanding | generate-understanding.ts | understanding-generation.ts |
| ai-requirement-interview | (inline) | question-generation.ts |
| ai-estimate-from-interview | (inline + agentic) | (inline) |
| ai-suggest | suggest-activities.ts | — |
| ai-normalize | normalize-requirement.ts | — |
| ai-generate-title | generate-title.ts | — |
| ai-generate-preset | generate-preset.ts | preset-generation.ts |

### 1.4 How Artifacts Flow Into Estimation

```
Description
  ↓
[Normalization] (optional, Step 0)
  ↓
RequirementUnderstanding (Step 2, optional but prompted)
  ↓
Round 0 — ai-requirement-interview (planner)
  receives: description + techCategory + requirementUnderstanding?
  returns: ASK/SKIP decision + preEstimate + questions
  ↓
Round 1 — ai-estimate-from-interview
  receives: description + answers + techCategory + preEstimate + requirementUnderstanding?
  returns: activities + drivers + risks + reasoning
  ↓
EstimationEngine (deterministic)
  receives: activities + drivers + risks
  returns: baseDays + driverMultiplier + contingency + totalDays
```

**Key:** `requirementUnderstanding` is injected into prompts via `formatUnderstandingBlock()` — a local helper in both endpoint files that formats the understanding as structured Italian markdown.

### 1.5 How Persistence Works

**Pattern:** JSONB artifact + input snapshot + version counter.

```sql
requirement_understanding (
  id UUID PK,
  requirement_id UUID FK → requirements(id) ON DELETE CASCADE,
  understanding JSONB NOT NULL,       -- the artifact
  input_description TEXT NOT NULL,     -- snapshot
  input_tech_category TEXT,
  user_id UUID NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ
)
```

**Save timing:** Non-blocking, at wizard save (Step 5), after requirement creation. Error logged but doesn't fail the save.

**Retrieval:** `getLatestRequirementUnderstanding(requirementId)` → ORDER BY created_at DESC LIMIT 1.

### 1.6 How Prompts Are Composed

Prompts follow a structured injection pattern:

```
SYSTEM PROMPT (static, from prompt file)
+ USER PROMPT (dynamic, composed in endpoint/action):
    - Raw description
    - [Optional] Normalized description
    - [Optional] Tech category context
    - [Optional] Project context
    - [Optional] Requirement Understanding block ← formatUnderstandingBlock()
    - [Optional] Activity catalog summary
    - [Optional] Historical RAG examples
```

### 1.7 How Wizard State Is Handled

**Hook:** `useWizardState()` — localStorage-persisted (`estimation_wizard_data` key).

**WizardData interface** stores all cross-step data:
- Basic fields: description, title, priority, state, techPresetId, techCategory
- Normalization: normalizationResult?
- Understanding: requirementUnderstanding?, requirementUnderstandingConfirmed?
- Interview: interviewQuestions, interviewAnswers, plannerDecision, preEstimate
- AI results: aiSuggestedActivityCodes, activityBreakdown, suggestedDrivers
- Selection: selectedActivityCodes, selectedDriverValues, selectedRiskCodes

**Key:** Fields are added incrementally via `onUpdate(partial)`. New artifacts simply need new optional fields.

### 1.8 Where Impact Map Should Logically Fit

**Insertion point:** Between Understanding (step 2) and Interview (step 3).

**Rationale:**
- Understanding establishes WHAT the requirement is
- Impact Map establishes WHERE in the architecture it touches
- Interview uses both to ask targeted technical questions
- Estimation uses all three to select activities and reason about effort

**Reusable parts:**
- `createAIHandler` factory — endpoint boilerplate
- Action pattern (cache → LLM → validate) — generate-understanding.ts template
- Prompt pattern (system + schema) — understanding-generation.ts template
- Persistence pattern — requirement_understanding migration template
- Wizard step pattern — WizardStepUnderstanding.tsx template
- Client API pattern — requirement-understanding-api.ts template
- State pattern — optional field on WizardData
- Downstream injection pattern — `formatUnderstandingBlock()` → `formatImpactMapBlock()`

**Parts requiring extension:**
- New type file for Impact Map
- New wizard step component
- New display card component
- New prompt (distinct role: Solution Architect, not Business Analyst)
- New persistence functions
- Updated downstream format blocks
- Updated WizardData interface

---

## 2. Impact Map Role in the Pipeline

### 2.1 Artifact Responsibilities

| Stage | Responsibility | Perspective | Output |
|-------|---------------|-------------|--------|
| **Requirement Understanding** | WHAT is the requirement? | Business Analyst | Business objective, functional perimeter, actors, state transitions |
| **Impact Map** | WHERE does it touch the system? | Solution Architect | Architectural layers impacted, action types, affected components |
| **Interview** | WHAT is ambiguous or risky? | Technical Architect | Targeted questions to reduce estimation uncertainty |
| **Estimation** | HOW MUCH effort is needed? | Technical Estimator | Activities, hours, drivers, risks |

### 2.2 How Impact Map Differs from Requirement Understanding

| Dimension | Requirement Understanding | Impact Map |
|-----------|--------------------------|------------|
| Question answered | What does this requirement do? | Which system areas are affected? |
| Abstraction level | Business/functional | Architectural/structural |
| Taxonomy | Actors, perimeter, transitions | Layers, actions, components |
| Technology awareness | Minimal (category hint) | Architecture-aware but tech-agnostic |
| Consumer | Human review + downstream AI | Downstream AI (interview + estimation) |
| Confidence semantics | How clear is the requirement? | How confident is the architectural assessment? |

### 2.3 How Impact Map Differs from Interview

Interview asks questions to **reduce uncertainty**. Impact Map **maps structural impact** without asking anything. The interview can use the Impact Map to focus questions on high-impact, low-confidence layers.

### 2.4 How Impact Map Differs from Estimation

Estimation selects **specific activities** with **specific hours**. Impact Map identifies **architectural layers** and **action types** — it does not estimate effort. The estimation can use the Impact Map to validate that selected activities cover all impacted layers.

### 2.5 Reasoning Boundaries

```
Understanding:  functional scope (business domain)
                ↓ feeds into
Impact Map:     architectural scope (system layers)
                ↓ feeds into
Interview:      uncertainty reduction (targeted questions)
                ↓ feeds into
Estimation:     effort quantification (activities + hours)
```

**Boundary rule:** Each artifact must NOT duplicate the responsibilities of adjacent artifacts.

- Impact Map must NOT restate functional perimeter (that's Understanding)
- Impact Map must NOT ask questions (that's Interview)
- Impact Map must NOT estimate hours (that's Estimation)
- Impact Map must NOT name specific technologies (that's Tech Preset)

### 2.6 Formal Architectural Constraints — Impact Map Is Pre-Task, Not WBS

This is the most critical constraint on the Impact Map artifact. It must be enforced in every layer: prompt design, schema validation, human review, and downstream consumption.

**Core rule:** The Impact Map is an *architectural assessment artifact*. It describes **where the system is affected**, **how it is affected** (action type), and **why it is affected** (traced to the requirement). It does NOT describe tasks, deliverables, implementation steps, or effort.

#### 2.6.1 What Impact Map Describes

| Allowed content | Example |
|----------------|---------|
| Which architectural layer is affected | `data` layer |
| What type of structural action is required | `modify` |
| Which logical component is involved | `order entity` |
| Why the layer is impacted (traced to requirement) | "Requirement adds approval status, which modifies the order entity schema" |
| Confidence in the assessment | 0.85 |

#### 2.6.2 What Impact Map Must NOT Describe

| Forbidden content | Why it's forbidden | Example of violation |
|-------------------|--------------------|---------------------|
| Tasks or work items | That's a WBS / estimation concern | "Create the approval API" |
| Deliverables | That's project management scope | "Deliver new form component" |
| Activities or activity codes | That's the estimation engine's job | "PP_DV_FORM_SM" |
| Implementation steps | That's planning, not architecture | "Step 1: design schema, Step 2: build migration" |
| Effort or time | That's estimation, not impact mapping | "This will take ~2 days" |
| Test tasks | That's QA planning | "Write integration tests" |
| Deployment tasks | That's DevOps scope | "Deploy to staging environment" |

#### 2.6.3 The Fundamental Test

> If an Impact Map entry could be a line on a project plan or a Sprint backlog, it has drifted into WBS territory and is invalid.

A valid Impact Map entry answers: *"which part of the system is structurally affected, and why?"*

An invalid entry answers: *"what should someone build or do?"*

#### 2.6.4 Valid vs Invalid Examples

**Valid entries:**

| layer | action | components | reason |
|-------|--------|-----------|--------|
| `data` | `modify` | `["order entity"]` | "Requirement adds an approval status to the purchasing process, which requires schema extension" |
| `logic` | `create` | `["approval service", "threshold validator"]` | "Approval rules and configurable spending thresholds are new business logic" |
| `frontend` | `create` | `["approval dashboard"]` | "Managers need a review surface for pending requests" |
| `automation` | `create` | `["notification workflow"]` | "Automatic notification on approval decision implies an event-driven flow" |

**Invalid entries (pseudo-WBS — must be rejected):**

| layer | action | components | reason | Why it's invalid |
|-------|--------|-----------|--------|-----------------|
| `logic` | `create` | `["implement approval endpoint"]` | "Build the REST API for approvals" | Component is a task, reason is an implementation instruction |
| `data` | `modify` | `["add status column to orders table"]` | "Migrate the database" | Component is a DDL operation, reason is a deployment step |
| `frontend` | `create` | `["design and implement manager dashboard"]` | "Deliver UI for reviewing approvals" | Component contains implementation verbs, reason is a deliverable |
| `automation` | `create` | `["Power Automate approval flow"]` | "Set up the flow in Power Automate" | Component names a specific technology, reason is a task |

#### 2.6.5 Enforcement Points

| Layer | How this constraint is enforced |
|-------|-------------------------------|
| **Prompt** | System prompt includes explicit anti-WBS rules + valid/invalid examples |
| **Schema** | Zod schema constrains field lengths and count, but cannot enforce semantics (prompt is the guard) |
| **UI review** | User reviews the Impact Map before proceeding — can regenerate if it reads like a task list |
| **Downstream** | Impact Map is injected as read-only context; downstream prompts are separately instructed NOT to treat it as a task list |

#### 2.6.6 Relationship to Estimation

Impact Map is an **input** to estimation reasoning, not an estimation artifact itself.

```
Impact Map (pre-task)    →    assists    →    Estimation (task-level)
  "data layer affected"        ≠               "DB_DESIGN activity, 4h"
  "logic requires creation"    ≠               "BE_SERVICE_LG activity, 8h"
```

The estimation engine and AI estimation stages are responsible for translating architectural impact into specific activities and hours. Impact Map must not pre-empt that translation.

### 2.7 Confidence Semantics — Operational Definitions

Confidence values in the Impact Map serve as **uncertainty signals**, not as effort modifiers or quality scores. This section defines exactly how each downstream consumer should interpret them.

#### 2.7.1 What Confidence Represents

| Field | Meaning |
|-------|---------|
| `impact.confidence` (per-impact) | How certain is the AI that this specific layer is actually affected by the requirement? |
| `overallConfidence` | Aggregate certainty across all identified impacts — how complete and reliable is the full architectural picture? |

**Scale interpretation:**

| Range | Meaning | Typical cause |
|-------|---------|---------------|
| ≥ 0.9 | Near-certain | Requirement explicitly describes this impact |
| 0.7 – 0.89 | Probable | Standard architectural patterns imply this impact |
| 0.5 – 0.69 | Possible | Some ambiguity — the requirement is vague about this area |
| < 0.5 | Speculative | Impact is inferred from convention, not stated in the requirement |

#### 2.7.2 How Interview Should Use Confidence

The interview planner (Round 0) receives the Impact Map as context. It should:

- **Target questions at low-confidence impacts first.** If `automation` has confidence 0.5, the planner should generate a question about workflow requirements to reduce that ambiguity.
- **Avoid redundant questions on high-confidence impacts.** If `data [modify]` has confidence 0.95, asking "does this requirement change the schema?" wastes an interview slot.
- **Use confidence to prioritize.** When selecting 3–5 questions from many possible, prefer questions that resolve the most uncertainty in the Impact Map.

**Interview does NOT:** adjust question difficulty based on confidence. Confidence is about *whether* a layer is impacted, not *how hard* the work is.

#### 2.7.3 How Estimation Should Use Confidence

The estimation AI (Round 1) receives the Impact Map as context. It should:

- **Ensure activity coverage.** Every impacted layer (especially high-confidence ones) should have at least one corresponding activity in the estimate.
- **Use low-confidence impacts as exploration signals.** If a layer has confidence < 0.7, the estimation reasoning should explain whether it included activities for that layer and why/why not.
- **NOT use confidence as a multiplier.** Confidence 0.5 on `data` does NOT mean "estimate 50% of the data effort." It means "we're unsure if data is even impacted."

**Estimation does NOT:**
- Multiply hours by confidence values
- Skip activities for low-confidence layers without explanation
- Treat confidence as a complexity proxy (that's a different dimension)

#### 2.7.4 How UI Should Present Confidence

| Element | Presentation |
|---------|-------------|
| Per-impact confidence | Colored percentage: emerald (≥0.8), amber (0.5–0.79), red (<0.5) |
| Overall confidence | Summary line with percentage, no progress bar in V1 |
| Low-confidence items | No special treatment in V1 — color coding is sufficient |

**UI does NOT:**
- Show confidence as a "quality score" for the whole estimation
- Use confidence to enable/disable wizard navigation
- Display confidence-based recommendations to the user ("you should regenerate because confidence is low")

#### 2.7.5 What Confidence Is NOT

| Misuse | Why it's wrong |
|--------|---------------|
| Effort multiplier | Confidence measures *structural certainty*, not *effort magnitude* |
| Quality score | Low confidence ≠ bad analysis; it means the requirement is ambiguous about that area |
| Priority ranking | High confidence ≠ more important; a speculative `ai_pipeline` impact may matter more than a certain `configuration` impact |
| Replacement for human judgment | Confidence is a transparency aid, not an authority signal |

### 2.8 Anti-Drift Rules for AI Generation

Because the Impact Map is AI-generated, it is susceptible to common LLM drift patterns. The following rules must be encoded in the system prompt and enforced at the schema/validation level where possible.

#### 2.8.1 Content Boundaries

| Rule | Rationale |
|------|-----------|
| **Do not repeat the Requirement Understanding** | The Understanding describes business scope. Impact Map references it but must not restate objectives, actors, or perimeter. |
| **Do not infer new business scope** | If the requirement says "approval workflow," the Impact Map should not invent "reporting dashboard" or "audit trail" unless explicitly mentioned. |
| **Do not create speculative architecture** | Impact Map assesses what the requirement *implies*, not what a hypothetical ideal system *could* include. |
| **Do not introduce technologies not in context** | If the tech context is "Power Platform," the Impact Map must not reference "Kubernetes" or "GraphQL." Even in components[], terms should remain tech-agnostic. |
| **Do not include transitive impacts** | If the requirement changes Schema A, and Schema A is consumed by Service B, the Impact Map should include Schema A but NOT Service B unless the requirement explicitly or strongly implies changes to Service B. |
| **Do not inflate the impact count** | More impacts ≠ better analysis. A simple configuration change should produce 1–2 impacts, not 5–7. |

#### 2.8.2 Scope Anchoring

The Impact Map generation MUST be bounded by the union of:
- The raw requirement description
- The Requirement Understanding (if confirmed)
- The selected tech category/preset (if provided)

The AI MUST NOT extrapolate beyond what these three inputs justify. If the requirement is vague about a layer, the AI should either omit it or include it with low confidence and an explicit reason noting the ambiguity.

#### 2.8.3 Prompt Enforcement

These rules translate into system prompt instructions:

```
ANTI-DRIFT RULES (strict):
1. Do not restate the Requirement Understanding — reference it, do not duplicate
2. Do not invent scope not present in the requirement
3. Do not speculate on architecture beyond what the requirement implies
4. Do not name specific technologies in components[] — use architectural terms
5. Do not include transitive/indirect impacts unless explicitly justified
6. Do not inflate: fewer high-confidence impacts > many speculative ones
7. Stay within the input context: description + understanding + tech category
```

---

## 3. Data Model Design

### 3.1 TypeScript Interfaces

```typescript
// ──────── Enums ────────

export type ImpactLayer =
  | 'frontend'
  | 'logic'
  | 'data'
  | 'integration'
  | 'automation'
  | 'configuration'
  | 'ai_pipeline';

export type ImpactAction =
  | 'read'
  | 'modify'
  | 'create'
  | 'configure';

// ──────── Core Artifact ────────

export interface ImpactItem {
  /** Architectural layer affected */
  layer: ImpactLayer;
  /** Type of action required */
  action: ImpactAction;
  /** Affected components within the layer (free-text, arch-oriented) */
  components: string[];
  /** Why this layer is impacted — must reference the requirement */
  reason: string;
  /** 0.0 – 1.0 confidence in this individual impact */
  confidence: number;
}

export interface ImpactMap {
  /** One-paragraph architectural summary */
  summary: string;
  /** Individual layer impacts */
  impacts: ImpactItem[];
  /** Aggregate confidence across all impacts (0.0 – 1.0) */
  overallConfidence: number;
}

// ──────── Metadata ────────

export interface ImpactMapMetadata {
  generatedAt: string;
  model: string;
  techCategory?: string;
  inputDescriptionLength: number;
  hasRequirementUnderstanding: boolean;
}

// ──────── Request / Response ────────

export interface ImpactMapRequest {
  description: string;
  techCategory?: string;
  techPresetId?: string;
  projectContext?: { name: string; description: string; owner?: string };
  requirementUnderstanding?: RequirementUnderstanding;
}

export interface ImpactMapResponse {
  success: boolean;
  impactMap?: ImpactMap;
  metadata?: ImpactMapMetadata;
  metrics?: { totalMs: number; llmMs: number; model: string };
  error?: string;
}
```

### 3.2 Zod Schemas

```typescript
import { z } from 'zod';

export const ImpactLayerSchema = z.enum([
  'frontend', 'logic', 'data', 'integration',
  'automation', 'configuration', 'ai_pipeline'
]);

export const ImpactActionSchema = z.enum([
  'read', 'modify', 'create', 'configure'
]);

export const ImpactItemSchema = z.object({
  layer: ImpactLayerSchema,
  action: ImpactActionSchema,
  components: z.array(z.string().min(1).max(200)).min(1).max(10),
  reason: z.string().min(10).max(500),
  confidence: z.number().min(0).max(1),
});

export const ImpactMapSchema = z.object({
  summary: z.string().min(20).max(1000),
  impacts: z.array(ImpactItemSchema).min(1).max(15),
  overallConfidence: z.number().min(0).max(1),
});
```

### 3.3 Design Decisions

**Layer taxonomy (7 layers)**

| Layer | Covers | Cross-platform examples |
|-------|--------|------------------------|
| `frontend` | UI, forms, pages, dashboards | React pages / Power Apps / ServiceNow Portal |
| `logic` | Business rules, services, plugins | Service layer / Plugin / Business Rule / Script Include |
| `data` | Schema, tables, entities, stored procs | PostgreSQL / Dataverse / CMDB tables |
| `integration` | APIs, connectors, external calls | REST API / Custom Connector / Integration Hub |
| `automation` | Workflows, flows, scheduled processes | Power Automate / Flow Designer / cron jobs |
| `configuration` | Config, feature flags, environment | App settings / Solution config / System Properties |
| `ai_pipeline` | LLM prompts, RAG, embeddings | OpenAI prompts / Copilot Studio / ML models |

**Why 7 layers:** Covers 95%+ of real-world requirement impacts across SaaS, Power Platform, ServiceNow, and custom development. The list is intentionally flat (no hierarchy) to avoid over-engineering.

**Action taxonomy (4 actions)**

| Action | Meaning |
|--------|---------|
| `read` | Existing component is consumed/queried but not modified |
| `modify` | Existing component requires changes |
| `create` | New component must be built from scratch |
| `configure` | Existing component needs configuration/parameterization |

**Why 4 actions:** Maps directly to effort gradients (read < configure < modify < create). Compact enough for LLM reliability.

**Confidence fields:**
- Per-impact `confidence` allows downstream AI to weight individual impacts differently
- `overallConfidence` provides a quick summary metric for UI display

**Component granularity:**
- Free-text strings (not an enum) — components are requirement-specific
- Architecture-oriented naming: "approval service", "opportunity table", not technology-specific
- Array (1–10 per impact): multiple components in the same layer

### 3.4 Layer Boundary Definitions (Operational)

Each layer must have a clear operational boundary so that the AI can assign impacts consistently, humans can review them meaningfully, and tests can verify correctness. Ambiguity between adjacent layers is the primary source of inconsistent Impact Maps.

#### 3.4.1 Frontend

| Attribute | Definition |
|-----------|-----------|
| **Contains** | User-facing surfaces: screens, pages, forms, dashboards, portals, navigation, client-side validation, visual layout, accessibility |
| **Does NOT contain** | Server-side rendering logic, API routing, business rule evaluation, data persistence |
| **Boundary with logic** | If the component renders UI or captures user input → `frontend`. If it evaluates business rules or orchestrates domain operations → `logic`. Client-side form validation (required fields, format checks) is `frontend`; server-side validation (business constraints) is `logic`. |
| **Traditional SaaS example** | React page, Angular dashboard, mobile screen |
| **Power Platform example** | Model-driven app form, Canvas app screen, Power Pages portal |
| **ServiceNow example** | Service Portal widget, UI Page, Workspace view |

#### 3.4.2 Logic

| Attribute | Definition |
|-----------|-----------|
| **Contains** | Business rules, domain services, plugins, scripts, server-side validation, calculations, workflow decision logic (the rule, not the orchestration), authorization logic |
| **Does NOT contain** | UI rendering, data schema definition, API contract definition, workflow orchestration, scheduled execution |
| **Boundary with automation** | If it defines a business rule or decision → `logic`. If it orchestrates a sequence of steps, reacts to events, or runs on a schedule → `automation`. Example: "orders above €10k require approval" is `logic`; "when an order is submitted, route it to the approval queue" is `automation`. |
| **Boundary with data** | If it defines how data is structured or stored → `data`. If it defines what operations are performed on data → `logic`. A stored procedure that enforces referential integrity is `data`; a stored procedure that calculates a discount is `logic`. |
| **Traditional SaaS example** | Service class, domain module, validation middleware |
| **Power Platform example** | Business Rule, Plugin, Custom API logic |
| **ServiceNow example** | Business Rule, Script Include, Access Control |

#### 3.4.3 Data

| Attribute | Definition |
|-----------|-----------|
| **Contains** | Schema, entities, tables, views, indexes, stored procedures (structural), data migrations, seed data, data integrity constraints |
| **Does NOT contain** | Business rules operating on data, API endpoints that serve data, UI forms that display data |
| **Boundary with logic** | If it defines structure or integrity → `data`. If it defines behavior or computation → `logic`. Adding a column → `data`. Adding a trigger that sends notifications → `logic` (or `automation` if event-driven). |
| **Traditional SaaS example** | PostgreSQL table, migration file, database view |
| **Power Platform example** | Dataverse table, choice column, relationship |
| **ServiceNow example** | CMDB table, dictionary entry, ACL table rule |

#### 3.4.4 Integration

| Attribute | Definition |
|-----------|-----------|
| **Contains** | API contracts (REST/SOAP/GraphQL), external system connectors, webhooks, message queues, data exchange formats, authentication with external systems |
| **Does NOT contain** | Internal service calls within the same system, scheduled execution of integrations, UI consumption of APIs |
| **Boundary with automation** | If it defines a connection point or data exchange → `integration`. If it orchestrates when/how integrations fire → `automation`. A REST API endpoint definition is `integration`; a scheduled job that calls that endpoint is `automation`. |
| **Boundary with configuration** | If it's about establishing a connection or contract → `integration`. If it's about setting parameters on an already-established connection → `configuration`. |
| **Traditional SaaS example** | REST API endpoint, webhook handler, message queue consumer |
| **Power Platform example** | Custom Connector, Dataverse Web API, Power Automate HTTP action (the connector, not the flow) |
| **ServiceNow example** | REST Message, Import Set, MID Server integration |

#### 3.4.5 Automation

| Attribute | Definition |
|-----------|-----------|
| **Contains** | Workflows, process orchestration, event-driven flows, scheduled processes, state machine transitions, notification delivery orchestration |
| **Does NOT contain** | Business rule definitions (the rule itself), API endpoint contracts, UI event handlers, data schema |
| **Boundary with logic** | Logic answers "what should happen." Automation answers "when and in what order." A discount calculation is `logic`; running the discount calculation nightly for all pending orders is `automation`. |
| **Boundary with integration** | Integration defines the pipe. Automation decides when to use it. The connector to the email service is `integration`; the flow that sends an email on approval is `automation`. |
| **Traditional SaaS example** | Background job, event handler pipeline, cron task |
| **Power Platform example** | Power Automate cloud flow, desktop flow |
| **ServiceNow example** | Flow Designer flow, Scheduled Job, Event rule |

#### 3.4.6 Configuration

| Attribute | Definition |
|-----------|-----------|
| **Contains** | Feature flags, environment parameters, system settings, application properties, locale settings, theme settings, role/permission assignments |
| **Does NOT contain** | Business rule logic, schema changes, API contracts, workflow definitions |
| **Boundary with integration** | If it's a connection string or endpoint URL → `configuration`. If it's a full API contract or connector definition → `integration`. |
| **Boundary with logic** | If it's a toggle or parameter value → `configuration`. If it's a rule or condition → `logic`. "approval_threshold = 10000" is `configuration`; "if amount > threshold then require_approval" is `logic`. |
| **Traditional SaaS example** | Environment variable, feature flag, application.yml entry |
| **Power Platform example** | Environment variable, Solution config, Security role assignment |
| **ServiceNow example** | System Property, Application Property, System Dictionary override |

#### 3.4.7 AI Pipeline

| Attribute | Definition |
|-----------|-----------|
| **Contains** | LLM prompts, prompt templates, RAG pipelines, embedding generation, model selection, AI-specific validation, AI output parsing, vector storage |
| **Does NOT contain** | General business logic that happens to use AI results, UI that displays AI output, data storage of AI artifacts (that's `data`) |
| **Boundary with logic** | If a component is specifically about LLM/ML operations → `ai_pipeline`. If it's a business rule that consumes AI output as one of many inputs → `logic`. The prompt template is `ai_pipeline`; the service that decides what to do with the AI response is `logic`. |
| **Traditional SaaS example** | OpenAI prompt file, RAG retrieval service, embedding pipeline |
| **Power Platform example** | Copilot Studio topic, AI Builder model, Prompt action |
| **ServiceNow example** | Now Assist skill, Predictive Intelligence model |

### 3.5 Components[] Rules

The `components[]` array within each `ImpactItem` identifies the specific architectural elements affected within a layer. Because this field is free-text, it requires clear rules to prevent drift toward code-level detail, task language, or technology coupling.

#### 3.5.1 What components[] Must Be

- **Architecture-oriented**: Named as logical system parts, not code artifacts
- **Noun-based**: Component names should be nouns or noun phrases, not verb phrases
- **Requirement-traceable**: Each component should be traceable to something mentioned or implied by the requirement
- **Layer-scoped**: Components must belong to the layer they're listed under

#### 3.5.2 What components[] Must NOT Contain

| Forbidden pattern | Examples | Why |
|-------------------|----------|-----|
| File names | `OrderService.java`, `migration_001.sql` | Code-level; the Impact Map is pre-implementation |
| Code symbols | `handleApproval()`, `ApprovalController`, `IApprovalService` | Same — code-level detail |
| Tasks / implementation verbs | `create approval API`, `implement flow`, `build dashboard`, `write tests` | WBS drift — these are tasks, not components |
| Technology-specific labels | `Power Automate flow`, `Dataverse table`, `PostgreSQL trigger` | Technology coupling — use architectural terms instead |
| Effort or time references | `simple form (~2h)`, `complex migration` | Estimation concern, not architectural |
| Product names | `ServiceNow CMDB`, `Salesforce Opportunity` | Technology-specific — use generic terms |

#### 3.5.3 Good vs Bad Examples

| ❌ Bad component | Why bad | ✅ Better component |
|-----------------|---------|-------------------|
| `OrderService.java` | File name | `order service` |
| `create approval API` | Task with verb | `approval API` |
| `implement notification flow` | Task with verb | `notification workflow` |
| `Power Automate approval flow` | Technology-specific | `approval workflow` |
| `add Dataverse table` | Task + technology | `order entity` |
| `PostgreSQL trigger for audit` | Technology-specific | `audit trigger` |
| `design manager dashboard` | Task with verb | `approval dashboard` |
| `the whole backend` | Too broad | `approval service`, `threshold validator` |
| `button color` | Too granular | `approval form` |

#### 3.5.4 Granularity Guidelines

| Level | Example | Verdict |
|-------|---------|---------|
| Too broad | `"backend"`, `"database"`, `"UI"` | ❌ These are layers, not components |
| Right level | `"approval service"`, `"order entity"`, `"notification channel"` | ✅ Identifiable architectural unit |
| Too narrow | `"approval button"`, `"status column"`, `"email template subject line"` | ❌ Implementation detail |
| Task-shaped | `"refactor approval logic"`, `"test notification flow"` | ❌ This is a work item, not a component |

**Heuristic:** A good component can appear in an architecture diagram box. If it would only appear in a Jira ticket title, it's too task-shaped. If it would only appear in a code file tree, it's too code-level.

---

## 4. Backend Implementation Plan

### 4.1 New Files

| File | Purpose |
|------|---------|
| `src/types/impact-map.ts` | Interfaces + Zod schemas + type exports |
| `src/lib/impact-map-api.ts` | Client-side API wrapper (sanitize → POST → parse) |
| `netlify/functions/ai-impact-map.ts` | Serverless endpoint (createAIHandler) |
| `netlify/functions/lib/ai/actions/generate-impact-map.ts` | AI action (cache → LLM → validate) |
| `netlify/functions/lib/ai/prompts/impact-map-generation.ts` | System prompt + JSON schema |

### 4.2 Endpoint Design

**Route:** `POST /.netlify/functions/ai-impact-map`

```typescript
// netlify/functions/ai-impact-map.ts

interface RequestBody {
  description: string;
  techCategory?: string;
  techPresetId?: string;
  projectContext?: { name: string; description: string; owner?: string };
  requirementUnderstanding?: Record<string, unknown>;
  testMode?: boolean;
}

export const handler = createAIHandler<RequestBody>({
  name: 'ai-impact-map',
  requireAuth: true,
  requireLLM: true,

  validateBody: (body) => {
    if (!body.description || body.description.length < 15) return 'Description too short';
    if (body.description.length > 2000) return 'Description too long';
    return null;
  },

  handler: async (body, ctx) => {
    // 1. Sanitize description
    // 2. Use normalized description if available
    // 3. Call generateImpactMap(request)
    // 4. Return { success, impactMap, metadata, metrics }
  }
});
```

### 4.3 Action Design

**File:** `netlify/functions/lib/ai/actions/generate-impact-map.ts`

**Pattern:** Mirrors `generate-understanding.ts` exactly.

```
function generateImpactMap(request):
  1. Cache check (ai:impactmap prefix, 12h TTL)
  2. Build system prompt from IMPACT_MAP_SYSTEM_PROMPT
  3. Build user prompt:
     - Description (normalized if available)
     - [Optional] Tech category hint
     - [Optional] Project context
     - [Optional] Requirement Understanding block (formatUnderstandingBlock)
  4. LLM call (gpt-4o-mini, temp 0.2, max 2000 tokens, strict JSON)
  5. Validate with ImpactMapSchema (Zod)
  6. Cache store
  7. Return ImpactMap + metrics
```

### 4.4 Prompt Design

**File:** `netlify/functions/lib/ai/prompts/impact-map-generation.ts`

**Exports:**
- `IMPACT_MAP_SYSTEM_PROMPT` — system prompt constant
- `createImpactMapResponseSchema()` — OpenAI strict JSON schema

**Prompt persona:** Solution Architect (NOT Business Analyst, NOT Estimator)

**Prompt structure:**

```
ROLE: You are an experienced Solution Architect.

TASK: Given a software requirement, produce a structured Impact Map that
identifies which architectural layers of the target system are affected,
what type of action each layer requires, and which components are involved.

CRITICAL RULES:
1. ALWAYS respond with valid JSON matching the schema
2. Use the SAME LANGUAGE as the input description
3. DO NOT estimate effort, hours, or complexity — that is not your job
4. DO NOT select activities — the estimation engine does that
5. DO NOT repeat the Requirement Understanding — reference it, don't duplicate
6. Layers are TECHNOLOGY-AGNOSTIC — use architectural terms
7. Components are architecture-oriented ("approval service", "order entity"),
   NOT technology-specific ("Power Automate flow", "PostgreSQL table")
8. Each impact must have a reason that references the requirement
9. Confidence reflects certainty of the architectural assessment
10. Be concise, practical, not academic

LAYER TAXONOMY:
- frontend:      UI, forms, pages, portals, dashboards
- logic:         business rules, services, plugins, scripts, validations
- data:          schema, entities, tables, views, stored procedures
- integration:   APIs, connectors, external system calls, webhooks
- automation:    workflows, scheduled processes, event-driven flows
- configuration: settings, feature flags, environment parameters
- ai_pipeline:   LLM prompts, embeddings, RAG pipelines, ML models

ACTION TAXONOMY:
- read:      consume existing component without changes
- modify:    change an existing component
- create:    build a new component from scratch
- configure: parameterize or enable an existing component

CONFIDENCE GUIDELINES:
- >= 0.9: requirement clearly implies this impact
- 0.7-0.9: probable impact based on typical patterns
- 0.5-0.7: possible impact, some ambiguity
- < 0.5: speculative — flag in reason

[IF tech_category provided]
TECH CONTEXT: The system uses {tech_category}. Adjust layer interpretation
accordingly but keep output technology-agnostic.

[IF requirementUnderstanding provided]
REQUIREMENT UNDERSTANDING (validated):
{formatted understanding block}
Use this to ground your analysis — do not contradict it.
```

### 4.5 Input Composition

The Impact Map generation uses richer context than Understanding because it sits later in the pipeline:

| Input | Source | Required? |
|-------|--------|-----------|
| description | WizardData.description | YES |
| techCategory | WizardData.techCategory | NO (but strongly recommended) |
| techPresetId | WizardData.techPresetId | NO |
| projectContext | WizardData (if set) | NO |
| requirementUnderstanding | WizardData.requirementUnderstanding | NO (but strongly recommended) |

**Composition order in user prompt:**
1. Description (normalized if available)
2. Requirement Understanding block (if confirmed)
3. Tech category hint (if selected)
4. Project context (if provided)

---

## 5. Database Strategy

### 5.1 Option Comparison

| Criterion | Option A: Separate Table (`impact_map`) | Option B: Extend `requirement_understanding` |
|-----------|------------------------------------------|----------------------------------------------|
| Schema clarity | Clean — each artifact has its own table | Muddled — one table stores two different artifacts |
| Independent versioning | YES — Impact Map can be regenerated without touching Understanding | NO — version counter becomes ambiguous |
| Query simplicity | Simple: `SELECT FROM impact_map WHERE requirement_id = ?` | Complex: must filter by artifact type |
| Migration risk | Zero (new table, no ALTER) | Low but nonzero (ALTER on existing table) |
| RLS reuse | Copy pattern from requirement_understanding | Already covered |
| Future extensibility | Easy to add future artifacts as new tables | Becomes a generic artifact dump |
| Consistency with Milestone 1 | Matches the pattern exactly | Breaks the pattern |

### 5.2 Recommendation: Option A — Separate Table

**Rationale:** Consistent with the established pattern, zero migration risk on existing data, clean independent versioning, and clear separation of concerns.

### 5.3 Migration Design

**File:** `supabase/migrations/20260308_impact_map.sql`

```sql
-- Milestone 2: Impact Map persistence
CREATE TABLE IF NOT EXISTS impact_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to requirement (nullable: can generate before saving)
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,

    -- The artifact (matches ImpactMap interface)
    impact_map JSONB NOT NULL,

    -- Input snapshot (for auditing and regeneration)
    input_description TEXT NOT NULL,
    input_tech_category TEXT,
    has_requirement_understanding BOOLEAN DEFAULT FALSE,

    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Version tracking (incremented per requirement_id)
    version INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fast retrieval of latest version per requirement
CREATE INDEX idx_impact_map_requirement
ON impact_map(requirement_id, created_at DESC);

-- User-scoped queries
CREATE INDEX idx_impact_map_user
ON impact_map(user_id);

-- RLS
ALTER TABLE impact_map ENABLE ROW LEVEL SECURITY;

-- Users can read their own impact maps
CREATE POLICY impact_map_select ON impact_map
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own impact maps
CREATE POLICY impact_map_insert ON impact_map
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own impact maps
CREATE POLICY impact_map_update ON impact_map
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own impact maps
CREATE POLICY impact_map_delete ON impact_map
    FOR DELETE
    USING (user_id = auth.uid());
```

### 5.4 Versioning Strategy

**Same pattern as `requirement_understanding`:**
- Each regeneration creates a new row with `version = MAX(version) + 1` for that `requirement_id`
- Retrieval always fetches the latest (`ORDER BY created_at DESC LIMIT 1`)
- No DELETE — full audit trail preserved

### 5.5 Persistence Functions

Add to `src/lib/api.ts` (following the exact pattern of `saveRequirementUnderstanding` and `getLatestRequirementUnderstanding`):

```
saveImpactMap(input: SaveImpactMapInput): Promise<ImpactMapRow>
  1. Get authenticated user
  2. Determine version (SELECT max(version) + 1)
  3. INSERT into impact_map
  4. Return inserted row

getLatestImpactMap(requirementId: string): Promise<ImpactMapRow | null>
  1. SELECT FROM impact_map WHERE requirement_id = ?
  2. ORDER BY created_at DESC LIMIT 1
```

---

## 6. Wizard Integration Plan

### 6.1 Updated Step Flow

| Index | Title | Component | Purpose |
|-------|-------|-----------|---------|
| 0 | Requirement | WizardStep1 | Description + metadata + normalization |
| 1 | Technology | WizardStep2 | Tech preset selection |
| 2 | Understanding | WizardStepUnderstanding | AI-analyzed requirement structure |
| **3** | **Impact Map** | **WizardStepImpactMap** | **AI-analyzed architectural impact** |
| 4 | Technical Interview | WizardStepInterview | Round 0 planner + Round 1 estimation |
| 5 | Drivers & Risks | WizardStep4 | Multiplier/contingency selection |
| 6 | Results | WizardStep5 | Summary + title generation + save |

**Change:** Interview moves from index 3 → index 4. Drivers from 4 → 5. Results from 5 → 6. Impact Map takes index 3.

### 6.2 WizardData Extension

Add to `useWizardState.ts` → `WizardData` interface:

```typescript
// NEW: Impact Map artifact (Phase 2)
impactMap?: ImpactMap;
impactMapConfirmed?: boolean;
```

### 6.3 WizardStepImpactMap Component

**File:** `src/components/requirements/wizard/WizardStepImpactMap.tsx`

**Pattern:** Mirrors `WizardStepUnderstanding.tsx` exactly.

**Props:** `{ data: WizardData, onUpdate, onNext, onBack }`

**State phases:** `'loading' | 'review' | 'error'`

**Behavior:**

1. **Mount:** If `data.impactMap` is null, auto-generate
2. **Generation:** Call `generateImpactMap()` with:
   - `data.description`
   - `data.techCategory`
   - `data.techPresetId`
   - `data.requirementUnderstanding` (if confirmed in previous step)
3. **Review state:** Display `ImpactMapCard`, offer "Rigenera" and "Conferma e continua"
4. **Error state:** Display error, offer "Indietro", "Riprova", "Salta"
5. **Confirm:** `onUpdate({ impactMap, impactMapConfirmed: true })` → `onNext()`
6. **Skip:** `onUpdate({ impactMapConfirmed: false })` → `onNext()`

**Key UX rule:** "Salta" (skip) always available — Impact Map is optional for backward compatibility.

### 6.4 Generation Triggers

Impact Map generates only when:
1. User enters step 3 for the first time (no existing impactMap in WizardData)
2. User clicks "Rigenera" (explicit regeneration)

No auto-regeneration on back/forward navigation — same as Understanding.

### 6.5 Save Integration

In `RequirementWizard.tsx` `handleSave()`:

```
// After saving requirement + understanding...
if (data.impactMap && data.impactMapConfirmed) {
  await saveImpactMap({
    requirementId: requirement.id,
    impactMap: data.impactMap,
    inputDescription: data.description,
    inputTechCategory: data.techCategory || undefined,
    hasRequirementUnderstanding: !!data.requirementUnderstandingConfirmed,
  });
}
```

Non-blocking: error logged but doesn't fail overall save — same pattern as Understanding.

---

## 7. Downstream Integration

### 7.1 Threading Pattern

Impact Map follows the exact same threading pattern as Requirement Understanding:

```
WizardStepInterview
  → useRequirementInterview.generateQuestions(..., data.impactMap)
  → useRequirementInterview.generateEstimate(..., data.impactMap)
    → requirement-interview-api (spreads impactMap into POST body)
      → ai-requirement-interview (receives impactMap, calls formatImpactMapBlock)
      → ai-estimate-from-interview (receives impactMap, calls formatImpactMapBlock)
```

### 7.2 Files Modified for Downstream Threading

| File | Change |
|------|--------|
| `src/components/requirements/wizard/WizardStepInterview.tsx` | Pass `data.impactMap` to hook methods |
| `src/hooks/useRequirementInterview.ts` | Add `impactMap?` parameter to `generateQuestions()` and `generateEstimate()` |
| `src/lib/requirement-interview-api.ts` | Add `impactMap?` field to request types, spread into POST bodies |
| `src/types/requirement-interview.ts` | Add `impactMap?` to request interfaces |
| `netlify/functions/ai-requirement-interview.ts` | Add `impactMap?` to RequestBody, call `formatImpactMapBlock()` |
| `netlify/functions/ai-estimate-from-interview.ts` | Add `impactMap?` to RequestBody, call `formatImpactMapBlock()` |

### 7.3 formatImpactMapBlock() Helper

A new formatting helper (can be shared or defined locally in each endpoint, matching the Understanding pattern):

```typescript
function formatImpactMapBlock(impactMap?: Record<string, unknown>): string {
  if (!impactMap) return '';

  const im = impactMap as ImpactMap;
  let block = '\n\nMAPPA IMPATTO ARCHITETTURALE (validata dall\'utente):\n';
  block += `Sintesi: ${im.summary}\n`;
  block += `Confidenza complessiva: ${Math.round(im.overallConfidence * 100)}%\n`;
  block += 'Layer impattati:\n';

  for (const impact of im.impacts) {
    block += `- ${impact.layer} [${impact.action}]: `;
    block += impact.components.join(', ');
    block += ` — ${impact.reason}`;
    block += ` (confidenza: ${Math.round(impact.confidence * 100)}%)\n`;
  }

  return block;
}
```

### 7.4 Example Prompt Injection — Round 0 (Interview Planner)

```
USER PROMPT (composed):

Analizza il seguente requisito software:

[DESCRIZIONE]
Come utente manager, devo poter approvare o rifiutare le richieste
di acquisto sopra i 10.000€ con notifica automatica al richiedente.

COMPRENSIONE STRUTTURATA DEL REQUISITO (validata dall'utente):
- Obiettivo: Implementare processo di approvazione acquisti con soglia
- Output atteso: Flusso approvazione con notifica automatica
- Perimetro: approvazione manageriale, soglia importo, ...
- Complessità stimata: MEDIUM
- Confidenza comprensione: 85%

MAPPA IMPATTO ARCHITETTURALE (validata dall'utente):
Sintesi: Requisito impatta 4 layer: UI di approvazione, logica di
validazione soglia, modello dati ordini, automazione notifiche.
Confidenza complessiva: 82%
Layer impattati:
- frontend [create]: approval dashboard — manager needs approval UI (90%)
- logic [create]: approval service, threshold validator — approval rules (85%)
- data [modify]: purchase order entity — add approval status field (90%)
- automation [create]: notification workflow — auto-notify on decision (75%)

Genera domande tecniche focalizzate sui layer a bassa confidenza...
```

### 7.5 Example Prompt Injection — Round 1 (Estimation)

```
MAPPA IMPATTO ARCHITETTURALE (validata dall'utente):
...same block as above...

ISTRUZIONI:
- Assicurati di selezionare attività che coprano TUTTI i layer impattati
- Usa la confidenza per-layer per calibrare l'effort:
  layer a bassa confidenza → aggiungi margine nelle ore stimate
- Se un layer è contrassegnato come "create", preferisci attività di sviluppo
- Se un layer è contrassegnato come "modify", preferisci attività di refactoring
- Se un layer è contrassegnato come "configure", preferisci attività di configurazione
```

### 7.6 How Impact Map Influences Downstream

| Downstream Stage | Influence |
|-----------------|-----------|
| **Question generation** | Questions should target low-confidence layers first. If `automation` has confidence 0.5, ask about workflow complexity. |
| **Activity suggestion** | Layer-action mapping guides activity selection: `data [create]` → DB_DESIGN activity; `logic [modify]` → REFACTORING activity; `automation [create]` → WORKFLOW_DEV activity. |
| **Reasoning explanation** | "Selected FE_DEV because frontend layer requires a new approval dashboard (Impact Map: frontend [create])." |
| **Coverage validation** | In agentic pipeline REFLECT phase: verify that every impacted layer has at least one mapped activity. |

### 7.7 Impact Map vs Activity Catalog — Separation of Concerns

Syntero has a mature estimation architecture built on a deterministic engine, an activity catalog (with codes, base_hours, groups, size variants), drivers, and risks. The Impact Map must integrate with this architecture without subverting or duplicating it.

#### 7.7.1 What Impact Map Contributes

| Contribution | Mechanism |
|-------------|-----------|
| **Semantic coverage signal** | Impact Map tells the estimation stage "these architectural layers are affected" — the estimation AI can verify that its selected activities cover all flagged layers |
| **Action-type hint** | The `create` / `modify` / `read` / `configure` action per layer helps the estimation AI choose the right activity variant: `create` suggests new-build activities, `modify` suggests refactoring/extension activities |
| **Component grounding** | Named components (e.g. "approval service") give the estimation AI concrete nouns to reference in reasoning, reducing vague justifications |
| **Confidence-driven question targeting** | Low-confidence layers direct the interview planner toward the most uncertain areas, improving information gain |
| **Traceability** | The estimation reasoning can cite Impact Map entries: "Selected FE_DEV because Impact Map identifies `frontend [create]: approval dashboard`" |

#### 7.7.2 What Impact Map Does NOT Replace

| Existing mechanism | Why Impact Map does NOT replace it |
|-------------------|------------------------------------|
| **Activity catalog** | The catalog defines the universe of selectable activities with base_hours. Impact Map does not define activities, does not assign codes, and does not set hours. |
| **Activity selection (AI)** | The AI estimation stage (Round 1) selects specific activity codes from the catalog. Impact Map provides context for this selection but does not perform it. |
| **Estimation engine (deterministic)** | The engine computes `baseDays × driverMultiplier × contingency`. Impact Map does not feed into this formula at all. |
| **Drivers and risks** | Drivers are multipliers (complexity, integration, etc.) and risks produce contingency percentages. Impact Map does not set driver values or risk codes. |
| **Interview answers** | Interview answers are direct user input about technical decisions. Impact Map is an AI assessment. They serve different roles in the estimation prompt. |

#### 7.7.3 The Boundary In Practice

```
Impact Map says:        "data layer affected — action: modify — component: order entity"
                         ↓
Estimation AI decides:  "Select DB_SCHEMA_CHANGE activity (code: DB_MOD_SM, base_hours: 2)"
                         ↓
Estimation Engine:      "DB_MOD_SM contributes 2h to base_hours total"
```

Impact Map provides the *architectural reason* for the activity choice. The catalog provides the *activity definition*. The engine provides the *arithmetic*. These three responsibilities must never be collapsed.

#### 7.7.4 Coverage Validation Pattern

Impact Map enables a new validation heuristic (not implemented in V1, but architecturally supported):

> For each impact in the Impact Map where confidence ≥ 0.7, the selected activity set should include at least one activity that plausibly covers that layer.

This is a soft check for the REFLECT phase of the agentic pipeline. It does NOT mean:
- Every layer must map to exactly one activity (some layers share activities)
- Low-confidence layers must have coverage (they're uncertain)
- The check should block estimation (it's a quality signal, not a gate)

### 7.8 Prompt Discipline — Context Injection Rules

The Impact Map is injected into downstream prompts (Interview Round 0, Estimation Round 1) as formatted text. Without discipline, this injection risks prompt bloat, redundancy with the Understanding block, and signal dilution.

#### 7.8.1 Formatting Rules

| Rule | Rationale |
|------|-----------|
| **No raw JSON in prompts** | JSON is token-expensive and hard for LLMs to reason about in-context. Always use `formatImpactMapBlock()` to produce concise formatted text. |
| **One summary line + compact impact lines** | The block should be ~150-300 tokens, not 500+. Each impact line should be a single formatted line. |
| **No redundant field repetition** | Metadata (generatedAt, model, inputDescriptionLength) is NOT included in the prompt block — it's for persistence/debugging only. |
| **Use the same language as the requirement** | If the requirement is in Italian, the block header and labels should be in Italian. Content (summary, reasons) should already be in the requirement's language (the generation prompt enforces this). |

#### 7.8.2 Block Format Specification

```
MAPPA IMPATTO ARCHITETTURALE (validata dall'utente):
Sintesi: [summary — max 1 sentence]
Confidenza complessiva: [N]%
Impatti:
- [layer] [[action]]: [component1], [component2] — [reason] ([N]%)
- [layer] [[action]]: [component1] — [reason] ([N]%)
...
```

**Max block size:** ~300 tokens. If the Impact Map has >8 impacts, truncate to the top 8 by confidence. Include a note: `(+N altri impatti omessi per brevità)`.

#### 7.8.3 Coexistence with Understanding Block

Both the Understanding and Impact Map blocks may appear in the same prompt. Rules for coexistence:

| Rule | Detail |
|------|--------|
| **Understanding block goes first** | It establishes business scope; Impact Map references it |
| **Impact Map block goes second** | It builds on Understanding; order matters for LLM reasoning |
| **No cross-referencing in blocks** | The Impact Map block must NOT restate Understanding fields (objective, perimeter, actors). It references them implicitly through the `reason` field of each impact. |
| **Clear section headers** | Each block has a distinct header: `COMPRENSIONE STRUTTURATA DEL REQUISITO` vs `MAPPA IMPATTO ARCHITETTURALE` |
| **Combined size budget** | Understanding (~200-300 tokens) + Impact Map (~150-300 tokens) = **≤600 tokens total**. This is well within limits but should be monitored. |

#### 7.8.4 What NOT To Do in Prompt Injection

| Anti-pattern | Why |
|-------------|-----|
| Dump `JSON.stringify(impactMap)` into the prompt | Token-wasteful, hard for LLM to reason about |
| Repeat the requirement description inside the Impact Map block | Already present in the prompt as the primary input |
| Include metadata fields (model, generatedAt, inputLength) | Irrelevant to the LLM's task; noise |
| Add instructions inside the block | Instructions belong in the system prompt, not in the data block |
| Include >8 impacts without truncation | Dilutes signal; the LLM will lose focus |

### 7.9 Backward Compatibility

- `impactMap` is **optional** everywhere in the chain
- `formatImpactMapBlock()` returns empty string if undefined
- All endpoints function identically with or without Impact Map
- No breaking changes to request/response contracts
- Telemetry flag: `hasImpactMap: boolean` for adoption tracking

---

## 8. UI Design Concept

### 8.1 First Iteration (V1) — Minimal Implementation

V1 prioritizes simplicity and consistency with `WizardStepUnderstanding`. No custom visualizations, no progress bars, no collapsible sections.

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  Impatto Architetturale                          │
│                                                  │
│  [summary text — one paragraph]                  │
│                                                  │
│  Confidenza complessiva: 82%                     │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Frontend          CREATE            90%    │ │
│  │  • approval dashboard                       │ │
│  │  manager needs approval UI                  │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Logic             CREATE            85%    │ │
│  │  • approval service                         │ │
│  │  • threshold validator                      │ │
│  │  business rules for approval process        │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Data              MODIFY            90%    │ │
│  │  • purchase order entity                    │ │
│  │  add approval status tracking field         │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Automation        CREATE            75%    │ │
│  │  • notification workflow                    │ │
│  │  auto-notify requester on decision          │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  [Rigenera]              [Conferma e continua →] │
└──────────────────────────────────────────────────┘
```

**V1 elements:**

| Element | Implementation |
|---------|---------------|
| Summary | Plain text paragraph |
| Overall confidence | Text: `"Confidenza complessiva: N%"` — no progress bar |
| Impact list | Flat list of cards/rows, one per impact |
| Layer name | Bold text label |
| Action badge | Colored inline badge: emerald (CREATE), amber (MODIFY), blue (READ), gray (CONFIG) |
| Per-impact confidence | Colored percentage text: emerald (≥0.8), amber (0.5–0.79), red (<0.5) |
| Components | Bulleted list within the impact row |
| Reason | Muted text below components |
| Buttons | Same pattern as WizardStepUnderstanding: Rigenera, Conferma e continua, Salta, Indietro |

**V1 deliberately omits:** Icons per layer, collapsible sections, progress bar visualization, sorting/filtering, component count badges.

### 8.2 Future Iteration (V2) — Potential Enhancements

For future consideration (not part of Milestone 2 implementation):

| Enhancement | Benefit |
|-------------|---------|
| Layer icons (Monitor, Database, etc.) | Faster visual scanning |
| Confidence progress bars | More intuitive than percentage text |
| Collapsible impact rows | Better for Impact Maps with 5+ layers |
| Color-coded layer chips | Visual grouping by layer type |
| "Why low confidence?" tooltip | Transparency on ambiguous impacts |
| Side-by-side with Understanding | Quick cross-reference during review |

### 8.3 Interaction Model (V1)

| Action | Behavior |
|--------|----------|
| **Review** | Read-only display. No editing of individual impacts. |
| **Rigenera** | Full regeneration via API. Replaces entire artifact. |
| **Conferma e continua** | Sets `impactMapConfirmed: true`, advances wizard. |
| **Salta** | Sets `impactMapConfirmed: false`, advances without artifact. |
| **Indietro** | Back to Understanding step. No data loss. |

**Design decision — no partial editing:** Individual impact editing would introduce a significant UX complexity surface (add/remove/reorder impacts, validate combinations) for marginal value. The user can regenerate if unsatisfied. This matches the Understanding step's interaction model.

---

## 9. Implementation Roadmap

### Phase 2a — Types & Schemas

**Files created:**
- `src/types/impact-map.ts` — ImpactLayer, ImpactAction, ImpactItem, ImpactMap, ImpactMapMetadata, ImpactMapRequest, ImpactMapResponse, Zod schemas

**Files modified:**
- None

**Risks:** None — pure type definitions.  
**Estimated scope:** 1 file, ~120 lines.

---

### Phase 2b — AI Generation Backend

**Files created:**
- `netlify/functions/ai-impact-map.ts` — Endpoint (createAIHandler)
- `netlify/functions/lib/ai/actions/generate-impact-map.ts` — Action (cache → LLM → validate)
- `netlify/functions/lib/ai/prompts/impact-map-generation.ts` — System prompt + JSON schema

**Files modified:**
- None

**Risks:**
- Prompt quality directly determines output quality. Needs testing with diverse requirement descriptions.
- LLM may confuse architectural layers with technology-specific terms. Prompt must strongly enforce tech-agnosticism.
- WBS drift risk: prompt must include anti-WBS rules from §2.6 and anti-drift rules from §2.8.

**Estimated scope:** 3 files, ~400 lines total.

**Prompt requirements (from this plan):**
- Must include anti-WBS examples (§2.6.4)
- Must include anti-drift rules (§2.8.3)
- Must include layer boundary guidance (§3.4, summarized)
- Must include components[] rules (§3.5, summarized)
- Must include confidence scale definitions (§2.7.1)

---

### Phase 2c — Database Migration

**Files created:**
- `supabase/migrations/20260308_impact_map.sql` — Table + indexes + RLS

**Files modified:**
- `src/lib/api.ts` — Add `saveImpactMap()` and `getLatestImpactMap()` (~40 lines)
- `src/types/database.ts` — Add `ImpactMapRow` interface (if this file has table row types)

**Risks:**
- Zero migration risk (CREATE TABLE, no ALTER on existing tables)
- RLS policy must be tested to ensure no access leaks

**Estimated scope:** 1 new file + 2 updated files, ~80 lines.

---

### Phase 2d — Wizard UI

**Files created:**
- `src/components/requirements/wizard/WizardStepImpactMap.tsx` — Step component
- `src/components/requirements/wizard/ImpactMapCard.tsx` — Display card (V1 minimal, per §8.1)
- `src/lib/impact-map-api.ts` — Client API wrapper

**Files modified:**
- `src/components/requirements/RequirementWizard.tsx` — Add step to steps array + import + save logic
- `src/hooks/useWizardState.ts` — Add `impactMap` + `impactMapConfirmed` to WizardData

**Risks:**
- Step reindexing: Interview, Drivers, Results all shift by +1. Must verify no hardcoded step indices elsewhere.
- localStorage schema change: Existing wizard sessions in progress will lack the new fields. The optional typing handles this (backward compatible).

**Estimated scope:** 3 new files + 2 updated files, ~350 lines.

---

### Phase 2e — Downstream AI Enrichment

**Files modified:**
- `src/components/requirements/wizard/WizardStepInterview.tsx` — Thread `data.impactMap`
- `src/hooks/useRequirementInterview.ts` — Add `impactMap?` parameter
- `src/lib/requirement-interview-api.ts` — Add `impactMap?` to request types + POST bodies
- `src/types/requirement-interview.ts` — Add `impactMap?` to request interfaces
- `netlify/functions/ai-requirement-interview.ts` — Add `impactMap?` to RequestBody + `formatImpactMapBlock()`
- `netlify/functions/ai-estimate-from-interview.ts` — Add `impactMap?` to RequestBody + `formatImpactMapBlock()`

**Risks:**
- Must maintain full backward compatibility — all additions are optional
- `formatImpactMapBlock()` must handle malformed/partial ImpactMap gracefully
- Prompt length increase — Impact Map block adds ~150-300 tokens per §7.8. Total prompt stays well within limits.
- Must follow prompt discipline rules from §7.8 (no raw JSON, truncation at 8 impacts, coexistence rules with Understanding block)

**Estimated scope:** 6 files modified, ~100 lines of changes.

---

### Phase 2f — Tests & Documentation

**Files created:**
- `src/test/impact-map-schema.test.ts` — Zod validation tests (valid/invalid/edge cases)

**Files modified:**
- `docs/data-model.md` — Add impact_map table documentation
- `docs/ai-integration.md` — Add Impact Map artifact to pipeline diagram + data flow
- `docs/api/ai-endpoints.md` — Add ai-impact-map endpoint documentation
- `docs/architecture.md` — Update pipeline diagram + component list

**Risks:** None — documentation and tests.  
**Estimated scope:** 1 new file + 4 doc updates, ~200 lines.

---

### Phase Summary

| Phase | New Files | Modified Files | Total Lines (est.) |
|-------|-----------|----------------|-------------------|
| 2a — Types | 1 | 0 | ~120 |
| 2b — Backend | 3 | 0 | ~400 |
| 2c — Database | 1 | 2 | ~80 |
| 2d — Wizard UI | 3 | 2 | ~350 |
| 2e — Downstream | 0 | 6 | ~100 |
| 2f — Tests & Docs | 1 | 4 | ~200 |
| **TOTAL** | **9** | **14** | **~1250** |

---

## 10. Risks and Tradeoffs

### 10.1 AI Hallucination Risk

**Risk:** LLM may invent impacts that don't correspond to the requirement, or miss obvious impacts.

**Mitigation:**
- Strict JSON schema constrains output to valid layer/action enums
- Per-impact confidence gives transparency — user can spot low-confidence hallucinations
- User review step (confirm/regenerate) provides human validation gate
- Prompt includes explicit anti-hallucination rule: "DO NOT invent facts"
- Requirement Understanding provides grounding context for the LLM
- Anti-drift rules (§2.8) explicitly ban scope invention and transitive impact inclusion

**Severity:** Medium — mitigated by review step + anti-drift prompt rules.

### 10.2 WBS Drift Risk (NEW)

**Risk:** The Impact Map may drift from architectural assessment into work-breakdown territory. Components may contain tasks ("implement approval API"), reasons may describe work items ("build and deploy the new form"), and the artifact may become a disguised project plan.

**Mitigation:**
- Formal architectural contract (§2.6) with valid/invalid examples encoded in the system prompt
- Components[] rules (§3.5) explicitly ban verbs, file names, code symbols, and task language
- The fundamental test: "If it could be a Sprint backlog item, it's WBS drift"
- Anti-drift rules (§2.8) ban task language, deliverable descriptions, and effort references
- Schema validation constrains structure; prompt engineering constrains semantics

**Severity:** HIGH — this is the most important quality risk. If the Impact Map becomes a WBS, it collapses the pipeline's separation of concerns and adds no value over what the estimation stage already does. Continuous prompt refinement required.

### 10.3 Overengineering Risk

**Risk:** Impact Map adds a step to an already multi-step wizard, increasing cognitive load.

**Mitigation:**
- Skip button ("Salta") is always available — zero mandatory friction
- Read-only review (no editing) keeps interaction minimal
- Auto-generation on step entry — no manual composition
- V1 UI is deliberately minimal (§8.1)

**Severity:** Low — the skip mechanism is the safety valve.

### 10.4 Duplicate Reasoning Risk

**Risk:** Impact Map may overlap with Requirement Understanding (both analyze the requirement), causing redundant information in prompts.

**Mitigation:**
- Clear boundary in prompt: "DO NOT repeat the Requirement Understanding"
- Understanding focuses on WHAT (business scope), Impact Map focuses on WHERE (architecture scope)
- Different personas: Business Analyst vs Solution Architect
- Downstream injection keeps both blocks distinct (§7.8.3)
- Anti-drift rule: "Do not restate the Understanding" (§2.8.1)
- Prompt discipline enforces separate headers and no cross-referencing (§7.8.3)

**Severity:** Medium — requires careful prompt engineering. The two prompts must be designed together.

### 10.5 Technology Coupling Risk

**Risk:** LLM may embed technology-specific terms into components[] (e.g., "Power Automate flow" instead of "notification workflow").

**Mitigation:**
- Prompt explicitly forbids technology-specific terms
- Layer/action enums are tech-agnostic by design
- Components[] rules (§3.5) provide explicit good/bad examples in the prompt
- Zod validation cannot catch semantic tech coupling (prompt is the guard)

**Severity:** Medium — ongoing prompt refinement may be needed.

### 10.6 Component Granularity Drift (NEW)

**Risk:** Components may be too broad ("the backend"), too narrow ("the email subject line template"), or inconsistent across regenerations.

**Mitigation:**
- §3.5.4 defines a granularity heuristic: "Can it appear in an architecture diagram box?"
- Prompt includes explicit granularity guidance with examples
- Zod schema constrains string length (min 1, max 200) and array size (1-10)
- User review step catches obviously wrong granularity

**Severity:** Medium — hard to fully constrain via prompt, but the review step mitigates.

### 10.7 Prompt Token Budget Risk

**Risk:** Adding Impact Map block to downstream prompts increases token usage.

**Mitigation:**
- Prompt discipline rules (§7.8) cap the block at ~300 tokens with truncation at 8 impacts
- Combined with Understanding block, total context addition is ≤600 tokens (§7.8.3)
- gpt-4o-mini has 128k context — well within limits

**Severity:** Low.

### 10.8 Confidence Misuse Risk (NEW)

**Risk:** Downstream consumers (AI or human) may misinterpret confidence as an effort multiplier, quality score, or priority ranking, distorting estimation outcomes.

**Mitigation:**
- §2.7 defines operational semantics for every consumer (Interview, Estimation, UI)
- §2.7.5 explicitly lists what confidence is NOT
- Prompt instructions tell downstream AI: "confidence measures architectural certainty, NOT effort magnitude"
- UI presents confidence as colored text, not as a slider or weight

**Severity:** Low-Medium — the defined semantics prevent misuse if followed.

### 10.9 Cache Key Collision Risk

**Risk:** Two requirements with similar descriptions might share cached Impact Maps.

**Mitigation:**
- Cache key includes description + techCategory (same as Understanding)
- If `requirementUnderstanding` is included in cache key, different understandings produce different cache keys
- 12h TTL limits stale cache impact

**Severity:** Low.

### 10.10 UI Complexity Risk

**Risk:** Yet another card/step in the wizard could confuse users or slow them down.

**Mitigation:**
- Consistent visual language with WizardStepUnderstanding (same interaction model)
- V1 is deliberately minimal (§8.1): no icons, no progress bars, no collapsible sections
- Wizard progress bar shows clear position

**Severity:** Low.

---

## 11. Final Recommendation

### Is Impact Map a Good Addition?

**Yes**, with the constraints defined in this revision.

Impact Map fills a genuine structural gap: the pipeline currently jumps from "what does the requirement do?" (Understanding) to "what questions should I ask?" (Interview) with no intermediate step that maps requirement → architecture. The interview and estimation AI must simultaneously infer architectural impact AND perform their primary tasks.

Impact Map decomposes this by providing an explicit, user-validated architectural assessment before the interview and estimation stages.

### Critical Success Conditions

This revision identifies conditions that must hold for the Impact Map to deliver value:

1. **It must remain pre-task.** If the Impact Map degrades into a WBS (tasks, deliverables, effort), it collapses the pipeline's separation of concerns and duplicates work the estimation stage already does. The anti-WBS constraints in §2.6 must be strictly enforced in the prompt.

2. **It must not replace the activity catalog.** The Impact Map is an *intermediate signal* that helps the estimation AI select from the existing catalog more accurately. It does not define activities, assign codes, or set hours (§7.7).

3. **Confidence must remain an uncertainty signal.** It must not become a hidden estimator, effort multiplier, or quality score (§2.7).

4. **Prompt discipline must be maintained.** The formatted block must stay compact, non-redundant with Understanding, and never dump raw JSON (§7.8).

5. **The UI must stay minimal for V1.** Over-designing the review step adds cognitive load without proportional value. The V1 spec in §8.1 is intentionally austere.

### Benefits It Unlocks

1. **Estimation accuracy:** Activities are selected with explicit knowledge of which layers are impacted, reducing hallucination and omission.

2. **Explainability:** Audit trail from requirement → architectural impact → activity selection.

3. **AI stability:** Narrower reasoning scope per stage reduces LLM variance.

4. **Cross-platform universality:** Tech-agnostic layer taxonomy works for Power Platform, ServiceNow, SaaS, and custom development.

5. **Interview targeting:** Low-confidence impacts direct questions to the most uncertain areas.

### Long-Term Capabilities (Out of Scope for Milestone 2)

1. **Coverage validation:** Verify selected activities cover all impacted layers.
2. **Activity auto-mapping:** Layer → activity group mapping for semi-automatic suggestion.
3. **RAG enrichment:** "Find estimates with similar architectural impact."
4. **Complexity proxy:** Impact count and create/modify ratio as structural complexity signal.

---

## Appendix A: File Inventory

### New Files (9)

| # | Path | Type |
|---|------|------|
| 1 | `src/types/impact-map.ts` | Types + Zod schemas |
| 2 | `src/lib/impact-map-api.ts` | Client API wrapper |
| 3 | `src/components/requirements/wizard/WizardStepImpactMap.tsx` | Wizard step |
| 4 | `src/components/requirements/wizard/ImpactMapCard.tsx` | Display card (V1 minimal) |
| 5 | `netlify/functions/ai-impact-map.ts` | Serverless endpoint |
| 6 | `netlify/functions/lib/ai/actions/generate-impact-map.ts` | AI action |
| 7 | `netlify/functions/lib/ai/prompts/impact-map-generation.ts` | Prompt + schema |
| 8 | `supabase/migrations/20260308_impact_map.sql` | DB migration |
| 9 | `src/test/impact-map-schema.test.ts` | Schema validation tests |

### Modified Files (14)

| # | Path | Change Description |
|---|------|--------------------|
| 1 | `src/hooks/useWizardState.ts` | Add `impactMap`, `impactMapConfirmed` to WizardData |
| 2 | `src/components/requirements/RequirementWizard.tsx` | Add step + import + save logic |
| 3 | `src/components/requirements/wizard/WizardStepInterview.tsx` | Thread `data.impactMap` |
| 4 | `src/hooks/useRequirementInterview.ts` | Add `impactMap?` parameter |
| 5 | `src/lib/requirement-interview-api.ts` | Add `impactMap?` to requests |
| 6 | `src/types/requirement-interview.ts` | Add `impactMap?` to interfaces |
| 7 | `netlify/functions/ai-requirement-interview.ts` | Add `impactMap?` + format block |
| 8 | `netlify/functions/ai-estimate-from-interview.ts` | Add `impactMap?` + format block |
| 9 | `src/lib/api.ts` | Add `saveImpactMap()` + `getLatestImpactMap()` |
| 10 | `src/types/database.ts` | Add `ImpactMapRow` (if applicable) |
| 11 | `docs/data-model.md` | Add impact_map table |
| 12 | `docs/ai-integration.md` | Add Impact Map pipeline section |
| 13 | `docs/api/ai-endpoints.md` | Add ai-impact-map endpoint |
| 14 | `docs/architecture.md` | Update pipeline diagram |

---

## Appendix B: Architectural Constraint Quick Reference

For implementation-phase reference, these are the binding constraints from this plan:

| # | Constraint | Section |
|---|-----------|---------|
| C1 | Impact Map is pre-task, never WBS | §2.6 |
| C2 | Impact Map does not generate activity codes | §7.7.2 |
| C3 | Confidence is an uncertainty signal, not an effort multiplier | §2.7.5 |
| C4 | Components[] must be architecture-oriented nouns, not tasks or code | §3.5 |
| C5 | No raw JSON in downstream prompts | §7.8.1 |
| C6 | Understanding + Impact Map combined ≤600 tokens in prompts | §7.8.3 |
| C7 | Anti-drift rules must be encoded in system prompt | §2.8.3 |
| C8 | V1 UI is minimal — no icons, no progress bars | §8.1 |
| C9 | Impact Map is optional at every boundary | §7.9 |
| C10 | Each layer has defined operational boundaries | §3.4 |

---

*End of Milestone 2 Implementation Plan — Revision R1*
