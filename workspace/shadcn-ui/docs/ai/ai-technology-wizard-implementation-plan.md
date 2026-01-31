# AI Technology Wizard - Piano di Implementazione

## 📋 Executive Summary

**Obiettivo**: Implementare un flusso generativo AI-driven per la creazione di Technology Presets, invertendo l'approccio classico "form-filling" con un'**esperienza di intervista interattiva** dove l'AI genera domande contestuali per raffinare i requisiti prima della generazione finale.

**Approccio Innovativo - Two-Stage AI Interaction**:
1. **Stage 1 - Question Generation**: L'AI analizza l'intent dell'utente e genera 3-5 domande mirate (architettura, compliance, team context)
2. **Stage 2 - Preset Generation**: L'AI combina l'intent originale + risposte strutturate + catalogo DB per generare la configurazione finale

**Vantaggi vs Single-Stage**:
- ✅ Input più ricco e strutturato → output più accurato
- ✅ User si sente guidato (meno overwhelm da form vuoto)
- ✅ Raccolta implicita di context (team size, compliance needs)
- ✅ Riduce necessità di editing manuale in review

**Validazione**: 4-level validation pipeline (client, server, AI-side, post-validation) su entrambi gli stage

**Timeline stimata**: 3-4 settimane (sviluppo + testing + documentazione)

---

## 🎯 Requisiti Funzionali

### User Journey Target (Two-Stage Approach)

1. **Trigger**: Click su "Crea nuova tecnologia" → mostra 2 opzioni:
   - "Crea Manualmente" (form classico esistente)
   - "🎤 AI Interview" (nuovo wizard interattivo)

2. **Step 1 - Intent Input**: Schermata con textarea per descrizione libera
   - Input: "Applicazione E-commerce B2B con integrazione SAP e Frontend React"
   - Helper text con esempi di prompt efficaci
   - CTA: "Inizia Interview ✨"

3. **Step 2 - AI Question Generation**: Loading state breve (3-5s)
   - Feedback: "Analizzo il tuo progetto..."
   - AI genera 3-5 domande contestuali

4. **Step 3 - Interactive Interview**: Form dinamico con domande generate
   - Domande adattive basate sull'intent (es. "Quale architettura?", "Team size?", "Compliance?")
   - Tipi supportati: Single-choice (RadioGroup), Multiple-choice (Checkboxes), Range (Slider), Text
   - Visual feedback: X/Y domande completate
   - CTA: "Genera Tecnologia"

5. **Step 4 - AI Preset Generation**: Loading state con progress (10-15s)
   - Feedback: "Seleziono attività rilevanti...", "Calcolo stime orarie...", "Identifico rischi..."
   - AI combina intent + risposte + DB catalog

6. **Step 5 - Review & Edit**: Wizard multi-tab per revisione
   - **Tab 5a - Identità**: Nome, categoria, descrizione (editable)
   - **Tab 5b - Attività**: Table con ore, reasoning AI, priority badges (editable, add/remove)
   - **Tab 5c - Rischi & Driver**: Checkboxes pre-selezionati, driver values (editable)
   - **Tab 5d - Summary**: Totale ore, confidence score, reasoning complessivo
   - CTA: "Salva Tecnologia" o "← Torna all'Interview"

7. **Step 6 - Conferma**: Toast success + redirect a lista preset

---

## 🏗️ Architettura Tecnica

### Overview: Two-Stage AI Architecture

```
User Input (Intent)
       ↓
  [Stage 1: Question Generation API]
       ↓
  AI-Generated Questions (3-5 domande)
       ↓
  User Answers (Structured Data)
       ↓
  [Stage 2: Preset Generation API]
       ↓
  Generated Preset + Confidence Score
       ↓
  Human Review & Edit
       ↓
  Save to Database
```

---

### 1. Stage 1: Question Generation Endpoint

**Path**: `netlify/functions/ai-generate-questions.ts`

**Responsabilità**:
- Ricevere intent description dall'utente
- Analizzare context e dominio tecnico
- Generare 3-5 domande mirate per raffinare requirements
- Restituire JSON schema delle domande con opzioni

**Stack tecnologico**:
- Modello: `gpt-4o-mini`
- Temperature: `0.3` (creatività controllata per diversity domande)
- Response format: `json_object`

**Input Schema**:
```typescript
interface GenerateQuestionsRequest {
  description: string;        // User intent (sanitized)
  userId: string;            // For audit
}
```

**Output Schema**:
```typescript
interface AiQuestion {
  id: string;                           // Unique question ID
  type: 'single-choice' | 'multiple-choice' | 'text' | 'range';
  question: string;                     // The actual question text
  description?: string;                 // Helper text explaining why
  options?: QuestionOption[];           // For choice-based questions
  required: boolean;
  defaultValue?: string | string[] | number;
  // For range type
  min?: number;
  max?: number;
  step?: number;
  unit?: string;                        // e.g., "developers", "months"
}

interface QuestionGenerationResponse {
  success: boolean;
  questions: AiQuestion[];
  reasoning?: string;                    // Why these specific questions
  suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
}
```

**System Prompt Strategy**:
```text
You are an expert Technical Consultant conducting a requirements interview.

USER INTENT: "${description}"

Your task: Generate 3-5 multiple-choice questions to clarify technical requirements.

FOCUS AREAS:
1. Architecture pattern (monolith, microservices, serverless)
2. Compliance needs (GDPR, PCI-DSS, HIPAA, SOC2)
3. Team context (size, seniority, location)
4. Integration requirements (third-party systems, APIs)
5. Deployment targets (cloud provider, on-premise, hybrid)

RULES:
- Questions must be specific and actionable
- Each question: 2-5 clear options
- Avoid generic questions ("What's your budget?")
- Focus on technical decisions that impact activity selection

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "id": "architecture",
      "type": "single-choice",
      "question": "Which architecture pattern fits best?",
      "description": "This affects scalability and deployment strategy",
      "options": [
        {"id": "monolith", "label": "Monolithic", "description": "Single deployable"},
        {"id": "microservices", "label": "Microservices", "description": "Independent services"}
      ],
      "required": true
    }
  ],
  "reasoning": "These questions determine deployment complexity and tech stack",
  "suggestedTechCategory": "MULTI"
}
```

**Validation Pipeline (4 levels)**:
1. **Client**: `sanitizePromptInput()` on description
2. **Server**: Re-sanitize + deterministic checks (min 20 chars, no placeholders)
3. **AI-side**: Prompt instructs rejection of vague/test inputs
4. **Post-validation**: Zod schema validation + question structure checks

---

### 2. Stage 2: Preset Generation Endpoint

**Path**: `netlify/functions/ai-generate-preset.ts`

**Responsabilità**:
- Ricevere: original description + structured answers + DB catalogs
- Costruire prompt arricchito con full context
- Chiamare OpenAI con strict JSON Schema (enum constraints)
- Restituire preset completo con reasoning per ogni scelta

**Stack tecnologico**:
- Modello: `gpt-4o-mini`
- Temperature: `0.2` (bassa varianza per consistenza)
- Response format: `json_schema` con **strict mode** + enum enforcement

**Input Schema**:
```typescript
interface GeneratePresetRequest {
  // Original user input
  originalDescription: string;
  
  // Structured answers from interview
  answers: Array<{
    questionId: string;
    type: QuestionType;
    value: string | string[] | number;
  }>;
  
  // Database context (for AI mapping)
  availableActivities: Array<{
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
  }>;
  
  availableRisks: Array<{
    code: string;
    name: string;
    description: string;
  }>;
  
  availableDrivers: Array<{
    code: string;
    name: string;
    options: Array<{ value: string; label: string; multiplier: number }>;
  }>;
  
  userId: string;
}
```

**Output Schema**:
```typescript
interface GeneratedActivity {
  code: string;                         // MUST match DB activity.code
  estimatedHours: number;
  reasoning: string;                    // Why this activity
  priority: 'core' | 'recommended' | 'optional';
}

interface GeneratedPreset {
  // Identity
  name: string;
  description: string;
  techCategory: 'FRONTEND' | 'BACKEND' | 'MULTI';
  
  // Core configuration
  activities: GeneratedActivity[];
  riskCodes: string[];                  // Array of risk.code
  driverValues: Record<string, string>; // { "COMPLEXITY": "HIGH", ... }
  
  // Metadata
  totalEstimatedHours: number;
  confidenceScore: number;              // 0-1, AI certainty
  generationReasoning: string;          // Overall explanation
}

interface GeneratePresetResponse {
  success: boolean;
  preset?: GeneratedPreset;
  error?: string;
  warnings?: string[];                  // e.g., "Low confidence - review needed"
}
```

**Schema Enforcement** (JSON Schema per OpenAI - Stage 2):
```typescript
const presetGenerationSchema = {
  type: "object",
  properties: {
    name: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 800 },
    techCategory: { type: "string", enum: ["FRONTEND", "BACKEND", "MULTI"] },
    activities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", enum: availableActivityCodes }, // CRITICAL: only DB codes
          estimatedHours: { type: "number", minimum: 0, maximum: 1000 },
          reasoning: { type: "string", maxLength: 300 },
          priority: { type: "string", enum: ["core", "recommended", "optional"] }
        },
        required: ["code", "estimatedHours", "reasoning", "priority"]
      }
    },
    riskCodes: {
      type: "array",
      items: { type: "string", enum: availableRiskCodes } // CRITICAL: only DB codes
    },
    driverValues: {
      type: "object",
      additionalProperties: { type: "string" }
    },
    totalEstimatedHours: { type: "number", minimum: 0 },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 },
    generationReasoning: { type: "string", maxLength: 1000 }
  },
  required: ["name", "techCategory", "activities", "totalEstimatedHours", "confidenceScore"],
  additionalProperties: false
};
```

**System Prompt** (Stage 2 - strategia arricchita):
```text
You are a Senior Technical Architect creating a detailed project estimation template.

ORIGINAL INTENT: "${originalDescription}"

USER ANSWERS FROM INTERVIEW:
${answers.map(a => `- ${a.questionId}: ${JSON.stringify(a.value)}`).join('\n')}

AVAILABLE ACTIVITIES (use ONLY these codes):
${JSON.stringify(availableActivities, null, 2)}

AVAILABLE RISKS:
${JSON.stringify(availableRisks, null, 2)}

AVAILABLE DRIVERS:
${JSON.stringify(availableDrivers, null, 2)}

TASK: Generate a comprehensive Technology Preset based on intent + structured answers.

OUTPUT REQUIREMENTS:
1. **Name**: Short, descriptive (e.g., "B2B Ecommerce Microservices + SAP")
2. **Description**: 2-3 sentences explaining the stack and key characteristics
3. **Category**: FRONTEND | BACKEND | MULTI (based on primary focus)
4. **Activities**: 
   - Select relevant activities from provided list
   - Estimate hours realistically (consider team size, architecture complexity from answers)
   - Mark priority: 
     * core (must-have for MVP)
     * recommended (important but could be deferred)
     * optional (nice-to-have enhancements)
   - Explain reasoning for each selection
5. **Risks**: Select applicable risks based on compliance, architecture, integrations
6. **Drivers**: Set appropriate values (COMPLEXITY, TEAM_SIZE, DEPLOYMENT_MODEL, etc.)
7. **Confidence Score**: 0-1 (how certain are you based on provided information?)

ESTIMATION GUIDELINES:
- Architecture impact:
  * Monolith: Standard hours
  * Microservices: +30% for orchestration, API gateway, service mesh
  * Serverless: +20% for event-driven design, cold start optimization
- Compliance impact:
  * GDPR/HIPAA: Add DATA_PRIVACY, AUDIT_LOGGING activities
  * PCI-DSS: Add SECURITY_HARDENING, PENETRATION_TEST
- Team size impact:
  * 1-3 devs: Lower hours (less coordination overhead)
  * 4-8 devs: Standard hours
  * 9+ devs: +15% for coordination, code review processes

CRITICAL RULES:
- Use ONLY activity codes from the provided list
- Hours must be realistic (8-200 per activity typically)
- Total hours should align with project scope
- If confidence < 0.7, explain why in generationReasoning

OUTPUT FORMAT (JSON):
{
  "name": "B2B Ecommerce Microservices + SAP",
  "description": "Full-stack solution for B2B ecommerce with React frontend, Node.js microservices backend, and SAP ERP integration. Designed for high scalability and GDPR compliance.",
  "techCategory": "MULTI",
  "activities": [
    {
      "code": "TECH_ANALYSIS",
      "estimatedHours": 48,
      "reasoning": "Microservices architecture requires detailed technical planning for service boundaries, API contracts, and SAP integration patterns",
      "priority": "core"
    },
    {
      "code": "UX_DESIGN",
      "estimatedHours": 60,
      "reasoning": "B2B ecommerce demands complex user flows (catalog browsing, bulk ordering, approval workflows)",
      "priority": "core"
    },
    {
      "code": "FE_DEV",
      "estimatedHours": 120,
      "reasoning": "React frontend with state management, responsive design, and real-time order tracking",
      "priority": "core"
    }
  ],
  "riskCodes": ["RISK_INTEGRATION_THIRD_PARTY", "RISK_COMPLIANCE", "RISK_SCALABILITY"],
  "driverValues": {
    "COMPLEXITY": "HIGH",
    "TEAM_SIZE": "LARGE",
    "DEPLOYMENT_MODEL": "CLOUD_NATIVE"
  },
  "totalEstimatedHours": 580,
  "confidenceScore": 0.88,
  "generationReasoning": "High confidence based on clear architecture choice (microservices), defined compliance needs (GDPR), and team context (8 developers). Estimates account for SAP integration complexity and distributed system coordination overhead."
}
```

**Validation Pipeline (4 levels - both stages)**:
1. **Client**: `sanitizePromptInput()` on all text inputs
2. **Server**: Re-sanitize + deterministic checks + enum validation
3. **AI-side**: System prompt with rejection criteria
4. **Post-validation**: 
   - Stage 1: Zod schema on questions structure
   - Stage 2: Zod schema + DB cross-check (activity/risk codes existence)

---

### 3. Frontend: `AiTechnologyWizard.tsx`

**Path**: `src/components/configuration/presets/AiTechnologyWizard.tsx`

**Architecture**: State machine con reducer pattern

**Stato Component**:
```typescript
type WizardStep = 'intent' | 'generating-questions' | 'interview' | 'generating-preset' | 'review';

interface WizardState {
  currentStep: WizardStep;
  
  // Step 1: Intent
  userIntent: string;
  
  // Step 2-3: Interview
  questions: AiQuestion[];
  answers: Map<string, AiAnswer>;
  questionGenerationReasoning?: string;
  
  // Step 4: Generation
  isGeneratingPreset: boolean;
  generationProgress: string;           // Status message for user
  
  // Step 5: Review
  generatedPreset: GeneratedPreset | null;
  editedPreset: GeneratedPreset | null; // User modifications
  
  // Error handling
  error: string | null;
  canRetry: boolean;
}

interface AiAnswer {
  questionId: string;
  type: QuestionType;
  value: string | string[] | number;
}
```

**Key Components**:
1. **WizardStepIntent.tsx**: Textarea con examples, character counter
2. **WizardStepInterview.tsx**: Container per `DynamicQuestionnaire`
3. **DynamicQuestionnaire.tsx**: Render dinamico basato su question.type
   - `SingleChoiceQuestion.tsx` (RadioGroup con cards)
   - `MultipleChoiceQuestion.tsx` (Checkboxes con icons)
   - `TextQuestion.tsx` (Textarea con validation)
   - `RangeQuestion.tsx` (Slider con live value + unit)
4. **WizardStepGeneration.tsx**: Animated loader con status updates
5. **WizardStepReview.tsx**: Multi-section editable form
   - `ReviewIdentitySection.tsx`
   - `ReviewActivitiesTable.tsx` (editable hours, add/remove)
   - `ReviewRisksSection.tsx`
   - `ReviewSummaryCard.tsx` (confidence score, reasoning)

**State Management**:
```typescript
// useAiWizardState.ts - Custom hook con reducer
type WizardAction =
  | { type: 'SET_INTENT'; payload: string }
  | { type: 'START_QUESTION_GENERATION' }
  | { type: 'QUESTIONS_LOADED'; payload: QuestionGenerationResponse }
  | { type: 'ANSWER_QUESTION'; payload: { questionId: string; answer: AiAnswer } }
  | { type: 'START_PRESET_GENERATION' }
  | { type: 'PRESET_GENERATED'; payload: GeneratedPreset }
  | { type: 'EDIT_PRESET_FIELD'; payload: { field: string; value: any } }
  | { type: 'SET_ERROR'; payload: { message: string; canRetry: boolean } }
  | { type: 'RESET' };
```

**Gestione errori avanzata**:
- **Question generation fails**: Mostra error + "Retry" button + "Skip to Manual Form"
- **Preset generation timeout**: Show partial result se disponibile + edit manual
- **Low confidence score (<0.6)**: Warning banner: "Review carefully - AI uncertain"
- **Network error**: Offline indicator + auto-retry con exponential backoff

---

### 4. UI Entry Point: Modifica `ConfigurationPresets.tsx`

**Cambio nel button "Crea nuova tecnologia"**:
```tsx
// OLD:
<Button onClick={handleCreate}>
  <Plus /> Crea nuova tecnologia
</Button>

// NEW:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>
      <Plus /> Crea nuova tecnologia
      <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleCreateManual}>
      <Pencil className="mr-2 h-4 w-4" />
      Crea Manualmente
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleCreateWithAI}>
      <MessageSquareQuote className="mr-2 h-4 w-4" />
      🎤 AI Interview
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**State aggiuntivo**:
```typescript
const [aiWizardOpen, setAiWizardOpen] = useState(false);
const [wizardMode, setWizardMode] = useState<'manual' | 'ai-interview' | null>(null);
```

---

### 5. Validation & Types

**File**: `src/types/ai-interview.ts` (NEW)

```typescript
import { z } from 'zod';

// Question Types
export type QuestionType = 'single-choice' | 'multiple-choice' | 'text' | 'range';

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface AiQuestion {
  id: string;
  type: QuestionType;
  question: string;
  description?: string;
  options?: QuestionOption[];
  required: boolean;
  defaultValue?: string | string[] | number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export const AiQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['single-choice', 'multiple-choice', 'text', 'range']),
  question: z.string().min(5).max(200),
  description: z.string().max(300).optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  })).optional(),
  required: z.boolean(),
  defaultValue: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
});

export interface AiAnswer {
  questionId: string;
  type: QuestionType;
  value: string | string[] | number;
}

export const QuestionGenerationResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(AiQuestionSchema),
  reasoning: z.string().max(500).optional(),
  suggestedTechCategory: z.enum(['FRONTEND', 'BACKEND', 'MULTI']).optional(),
});
```

**File**: `src/types/ai-preset-generation.ts` (UPDATED)

```typescript
import { z } from 'zod';
import { AiAnswer } from './ai-interview';

export interface GeneratePresetRequest {
  originalDescription: string;
  answers: AiAnswer[];
  availableActivities: Array<{
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
    tech_category: string;
  }>;
  availableRisks: Array<{
    code: string;
    name: string;
    description: string;
  }>;
  availableDrivers: Array<{
    code: string;
    name: string;
    options: Array<{ value: string; label: string; multiplier: number }>;
  }>;
  userId: string;
}

export interface GeneratedActivity {
  code: string;
  estimatedHours: number;
  reasoning: string;
  priority: 'core' | 'recommended' | 'optional';
}

export const GeneratedActivitySchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]{3,50}$/),
  estimatedHours: z.number().min(0).max(1000),
  reasoning: z.string().max(300),
  priority: z.enum(['core', 'recommended', 'optional']),
});

export interface GeneratedPreset {
  name: string;
  description: string;
  techCategory: 'FRONTEND' | 'BACKEND' | 'MULTI';
  activities: GeneratedActivity[];
  riskCodes: string[];
  driverValues: Record<string, string>;
  totalEstimatedHours: number;
  confidenceScore: number;
  generationReasoning: string;
}

export const GeneratedPresetSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(800),
  techCategory: z.enum(['FRONTEND', 'BACKEND', 'MULTI']),
  activities: z.array(GeneratedActivitySchema).min(1),
  riskCodes: z.array(z.string()),
  driverValues: z.record(z.string()),
  totalEstimatedHours: z.number().min(0),
  confidenceScore: z.number().min(0).max(1),
  generationReasoning: z.string().max(1000),
});

export interface GeneratePresetResponse {
  success: boolean;
  preset?: GeneratedPreset;
  error?: string;
  warnings?: string[];
}

export const GeneratePresetResponseSchema = z.object({
  success: z.boolean(),
  preset: GeneratedPresetSchema.optional(),
  error: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
```

---

### 6. Client API Wrappers

**File**: `src/lib/ai-interview-api.ts` (NEW)

```typescript
import { sanitizePromptInput } from '@/types/ai-validation';
import { QuestionGenerationResponseSchema } from '@/types/ai-interview';
import type { AiQuestion } from '@/types/ai-interview';

export async function generateQuestions(
  description: string,
  userId: string
): Promise<{ success: boolean; questions: AiQuestion[]; reasoning?: string }> {
  // 1. Client-side sanitization
  const sanitizedDescription = sanitizePromptInput(description);
  
  if (!sanitizedDescription || sanitizedDescription.length < 20) {
    throw new Error('La descrizione deve contenere almeno 20 caratteri significativi');
  }

  // 2. Call Netlify Function
  const response = await fetch('/.netlify/functions/ai-generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
    },
    body: JSON.stringify({
      description: sanitizedDescription,
      userId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Errore durante la generazione delle domande');
  }

  const data = await response.json();
  
  // 3. Validate response
  const validated = QuestionGenerationResponseSchema.parse(data);
  
  return validated;
}
```

**File**: `src/lib/ai-preset-api.ts` (UPDATED)

```typescript
import { sanitizePromptInput } from '@/types/ai-validation';
import { GeneratePresetRequest, GeneratePresetResponse, GeneratePresetResponseSchema } from '@/types/ai-preset-generation';
import type { AiAnswer } from '@/types/ai-interview';
import type { Activity, Risk, Driver } from '@/types/database';

export async function generatePresetWithAI(
  originalDescription: string,
  answers: AiAnswer[],
  availableActivities: Activity[],
  availableRisks: Risk[],
  availableDrivers: Driver[],
  userId: string
): Promise<GeneratePresetResponse> {
  // 1. Sanitize all text inputs
  const sanitizedDescription = sanitizePromptInput(originalDescription);
  
  // Sanitize text answers
  const sanitizedAnswers = answers.map(answer => ({
    ...answer,
    value: typeof answer.value === 'string' 
      ? sanitizePromptInput(answer.value) 
      : answer.value
  }));

  // 2. Build request payload
  const request: GeneratePresetRequest = {
    originalDescription: sanitizedDescription,
    answers: sanitizedAnswers,
    availableActivities: availableActivities.map(a => ({
      code: a.code,
      name: a.name,
      description: a.description || '',
      base_hours: a.base_days * 8, // Convert days to hours
      group: a.group,
      tech_category: a.tech_category
    })),
    availableRisks: availableRisks.map(r => ({
      code: r.code,
      name: r.name,
      description: r.description || ''
    })),
    availableDrivers: availableDrivers.map(d => ({
      code: d.code,
      name: d.name,
      options: d.options
    })),
    userId
  };

  // 3. Call Netlify Function
  const response = await fetch('/.netlify/functions/ai-generate-preset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Errore durante la generazione del preset');
  }

  const data = await response.json();
  
  // 4. Validate response
  const validated = GeneratePresetResponseSchema.parse(data);
  
  return validated;
}
```

---

## 📂 File Structure (Aggiornata)

```
workspace/shadcn-ui/
├── netlify/functions/
│   ├── ai-suggest.ts                                  # Existing (reference)
│   ├── ai-generate-questions.ts                       # NEW: Stage 1 - Question generation
│   ├── ai-generate-preset.ts                          # NEW: Stage 2 - Preset generation
│   └── lib/
│       └── ai/
│           ├── actions/
│           │   ├── suggest-activities.ts              # Existing
│           │   ├── generate-questions.ts              # NEW: Question generation logic
│           │   └── generate-preset.ts                 # NEW: Preset generation logic
│           └── prompts/
│               ├── question-generation.ts             # NEW: Stage 1 system prompt
│               └── preset-generation.ts               # NEW: Stage 2 system prompt
│
├── src/
│   ├── components/configuration/presets/
│   │   ├── TechnologyDialog.tsx                      # Existing (manual form)
│   │   ├── AiTechnologyWizard.tsx                    # NEW: Main wizard container
│   │   ├── ai-wizard/
│   │   │   ├── steps/
│   │   │   │   ├── WizardStepIntent.tsx              # NEW: Step 1 - Intent input
│   │   │   │   ├── WizardStepInterview.tsx           # NEW: Step 3 - Interview container
│   │   │   │   ├── WizardStepGeneration.tsx          # NEW: Step 4 - Loading state
│   │   │   │   └── WizardStepReview.tsx              # NEW: Step 5 - Review & edit
│   │   │   ├── interview/
│   │   │   │   ├── DynamicQuestionnaire.tsx          # NEW: Question renderer
│   │   │   │   ├── QuestionCard.tsx                  # NEW: Question wrapper
│   │   │   │   └── questions/
│   │   │   │       ├── SingleChoiceQuestion.tsx      # NEW: Radio group
│   │   │   │       ├── MultipleChoiceQuestion.tsx    # NEW: Checkboxes
│   │   │   │       ├── TextQuestion.tsx              # NEW: Textarea
│   │   │   │       └── RangeQuestion.tsx             # NEW: Slider
│   │   │   ├── review/
│   │   │   │   ├── ReviewIdentitySection.tsx         # NEW: Name, category, desc
│   │   │   │   ├── ReviewActivitiesTable.tsx         # NEW: Editable activities
│   │   │   │   ├── ReviewRisksSection.tsx            # NEW: Risks checkboxes
│   │   │   │   └── ReviewSummaryCard.tsx             # NEW: Confidence, reasoning
│   │   │   └── WizardProgress.tsx                    # NEW: Stepper indicator
│   │   └── PresetCreationMenu.tsx                    # NEW: Dropdown (Manual vs AI)
│   │
│   ├── hooks/
│   │   └── useAiWizardState.ts                       # NEW: State machine with reducer
│   │
│   ├── lib/
│   │   ├── ai-interview-api.ts                       # NEW: Question generation client
│   │   └── ai-preset-api.ts                          # NEW: Preset generation client (updated)
│   │
│   ├── types/
│   │   ├── ai-validation.ts                          # Existing (reused)
│   │   ├── ai-interview.ts                           # NEW: Question/Answer types
│   │   └── ai-preset-generation.ts                   # NEW: Generation types (updated)
│   │
│   └── pages/configuration/
│       └── ConfigurationPresets.tsx                  # MODIFY: Add AI Interview entry point
│
└── docs/ai/
    ├── ai-input-validation.md                        # Existing (reference)
    ├── ai-system-overview.md                         # UPDATE: Document both endpoints
    ├── ai-interview-wizard-user-guide.md             # NEW: User documentation
    └── ai-technology-wizard-implementation-plan.md   # THIS FILE (updated)
```

---

## 🔄 Fasi di Implementazione (Aggiornate per Two-Stage Approach)

### **FASE 1: Backend AI Infrastructure - Stage 1 (Question Generation)** (Settimana 1 - Giorni 1-3)

#### Task 1.1: Setup Question Generation Endpoint
- [ ] Creare `netlify/functions/ai-generate-questions.ts`
- [ ] Riutilizzare auth/cors/rate-limiter da `ai-suggest.ts`
- [ ] Implementare handler base con placeholder response

#### Task 1.2: Prompt Engineering per Question Generation
- [ ] Creare `netlify/functions/lib/ai/prompts/question-generation.ts`
- [ ] Scrivere system prompt per generazione domande contestuali
- [ ] Definire regole per tipi di domande (architecture, compliance, team)
- [ ] Test manuale con OpenAI Playground (10+ scenari diversi)

#### Task 1.3: Question Generation Logic & Validation
- [ ] Implementare `generate-questions.ts` action
- [ ] Applicare 4-level validation pipeline su intent description
- [ ] Validare struttura domande generate (Zod schema)
- [ ] Test con vari input:
  - [ ] "E-commerce B2B con SAP" → domande su architettura, compliance
  - [ ] "Mobile app iOS banking" → domande su security, biometrics
  - [ ] "Microservizi Node.js IoT" → domande su scalability, protocols

#### Task 1.4: Error Handling & Rate Limiting
- [ ] Gestione timeout OpenAI (15s limit per question gen)
- [ ] Rate limiting: 20 question generation calls/hour/user
- [ ] Caching domande per intent simili (hash description)
- [ ] Logging sanitized (intent + question count, no full prompts)

**Deliverable**: Endpoint `/ai-generate-questions` funzionante con test Postman

---

### **FASE 1 (continua): Backend AI Infrastructure - Stage 2 (Preset Generation)** (Settimana 1 - Giorni 4-7)

#### Task 1.5: Setup Preset Generation Endpoint
- [ ] Creare `netlify/functions/ai-generate-preset.ts`
- [ ] Riutilizzare validation pipeline e DB query utilities

#### Task 1.6: Database Context Building
- [ ] Query per fetchare activities con descriptions (filtrate per tech_category)
- [ ] Query per risks e drivers con opzioni complete
- [ ] Function `buildEnrichedContext()` che formatta intent + answers + DB catalog

#### Task 1.7: Prompt Engineering per Preset Generation
- [ ] Creare `netlify/functions/lib/ai/prompts/preset-generation.ts`
- [ ] Scrivere system prompt che integra intent + structured answers
- [ ] Definire JSON Schema con enum constraints (activity/risk codes)
- [ ] Aggiungere esempi di output con priority tagging e reasoning

#### Task 1.8: Preset Generation Logic & Validation
- [ ] Implementare `generate-preset.ts` action
- [ ] Chiamata OpenAI con strict JSON Schema
- [ ] Cross-check activity/risk codes con DB (post-validation)
- [ ] Calcolo confidence score based on answer completeness
- [ ] Test end-to-end: intent + mock answers → preset validato

#### Task 1.9: Advanced Error Handling
- [ ] Gestione low confidence (<0.6) → warnings in response
- [ ] Partial preset recovery se generation fails mid-way
- [ ] Fallback suggestions se nessuna attività match

**Deliverable**: Endpoint `/ai-generate-preset` completo con integration tests

---

### **FASE 2: Frontend Core Components** (Settimana 2 - Giorni 8-12)

#### Task 2.1: Type System & Validation
- [ ] Creare `src/types/ai-interview.ts` (questions, answers, types)
- [ ] Aggiornare `src/types/ai-preset-generation.ts` (con priority, confidence)
- [ ] Definire Zod schemas per tutte le interfacce
- [ ] Write unit tests per schema validation

#### Task 2.2: Dynamic Questionnaire System
- [ ] `DynamicQuestionnaire.tsx`: Container con progress tracker
- [ ] `QuestionCard.tsx`: Wrapper con styling consistente
- [ ] Implementare question components:
  - [ ] `SingleChoiceQuestion.tsx`: RadioGroup con cards layout
  - [ ] `MultipleChoiceQuestion.tsx`: Checkboxes con icons
  - [ ] `TextQuestion.tsx`: Textarea con char counter + validation
  - [ ] `RangeQuestion.tsx`: Slider con live value display + unit
- [ ] Answer validation logic (required fields, value constraints)
- [ ] Test con mock question data (5+ diverse tipologie)

#### Task 2.3: State Management - Wizard Reducer
- [ ] `useAiWizardState.ts`: Implement reducer pattern
- [ ] Define all action types (12+ actions per full flow)
- [ ] State persistence in sessionStorage (draft recovery)
- [ ] Error recovery mechanisms (retry, fallback)
- [ ] Unit tests per reducer logic (40+ test cases)

#### Task 2.4: Client API Wrappers
- [ ] `src/lib/ai-interview-api.ts`: Question generation client
- [ ] `src/lib/ai-preset-api.ts`: Preset generation client (updated)
- [ ] Implement retry logic con exponential backoff
- [ ] Mock implementations per testing senza backend

**Deliverable**: Core components con Storybook stories + unit tests

---

### **FASE 3: Wizard Integration** (Settimana 2-3 - Giorni 13-17)

#### Task 3.1: Wizard Step Components
- [ ] `WizardStepIntent.tsx`: 
  - Textarea con examples popover
  - Character counter (min 20, max 1000)
  - Real-time validation feedback
- [ ] `WizardStepInterview.tsx`:
  - Integrate DynamicQuestionnaire
  - Progress indicator (X/Y answered)
  - AI reasoning display (collapsible)
- [ ] `WizardStepGeneration.tsx`:
  - Animated skeleton loader
  - Status messages sequenziali
  - Estimated time remaining
- [ ] `WizardStepReview.tsx`:
  - Tab-based layout (Identity, Activities, Risks, Summary)
  - Inline editing con validation
  - Confidence score visualization (progress ring)

#### Task 3.2: Review Section Components
- [ ] `ReviewIdentitySection.tsx`: Editable name, category, description
- [ ] `ReviewActivitiesTable.tsx`:
  - Sortable table (by priority, hours, group)
  - Inline hour editing con constraints
  - Add manual activity modal
  - Remove with confirmation
  - Priority badge coloring
- [ ] `ReviewRisksSection.tsx`: Checkboxes + driver selects
- [ ] `ReviewSummaryCard.tsx`:
  - Total hours calculation
  - Confidence score con tooltip explanation
  - Generation reasoning display

#### Task 3.3: Main Wizard Container
- [ ] `AiTechnologyWizard.tsx`:
  - Integrate useAiWizardState hook
  - Step navigation logic (Next/Back/Cancel)
  - API calls orchestration (Stage 1 → Stage 2)
  - Error boundary with fallback UI
  - Dialog animations (Framer Motion)
- [ ] `WizardProgress.tsx`: Stepper indicator con step labels

#### Task 3.4: UI Entry Point Integration
- [ ] Modificare `ConfigurationPresets.tsx`:
  - Sostituire button con DropdownMenu
  - Add "AI Interview" option
  - Route wizard vs manual dialog
- [ ] `PresetCreationMenu.tsx`: Reusable dropdown component

**Deliverable**: Complete wizard flow con mock API responses

---

### **FASE 4: End-to-End Integration & Polish** (Settimana 3 - Giorni 18-21)

#### Task 4.1: Real API Integration
- [ ] Connect wizard to `/ai-generate-questions` endpoint
- [ ] Connect wizard to `/ai-generate-preset` endpoint
- [ ] Test complete flow con account utente reale
- [ ] Handle edge cases:
  - [ ] Network offline → show offline indicator + draft save
  - [ ] API timeout → retry with user control
  - [ ] Low confidence → warning banner + manual review prompt

#### Task 4.2: Preset Save Flow
- [ ] Convert `GeneratedPreset` → `PresetForm` format
- [ ] Integrate con existing `usePresetManagement` hook
- [ ] Add DB field: `created_via_ai` (boolean), `ai_confidence_score` (float)
- [ ] Toast notifications per tutti gli stati (success, error, warning)
- [ ] Redirect dopo save con scroll to nuovo preset

#### Task 4.3: UX Refinements
- [ ] Loading states granulari (skeleton, spinner, progress bar)
- [ ] Empty states (es. "Nessuna domanda generata - riprova")
- [ ] Tooltips esplicativi:
  - AI reasoning badges
  - Confidence score interpretation
  - Priority meanings
- [ ] Animazioni:
  - Step transitions (slide + fade)
  - Question cards (stagger animation)
  - Confidence ring (animated fill)
- [ ] Keyboard shortcuts (Esc = cancel, Enter = next)

#### Task 4.4: Accessibility & Responsive
- [ ] Full keyboard navigation (Tab, Arrow keys)
- [ ] Screen reader announcements (ARIA live regions)
- [ ] Focus management tra steps
- [ ] Mobile layout:
  - Stack wizard progress vertically
  - Collapse review tabs → accordion
  - Touch-friendly button sizing
- [ ] WCAG 2.1 AA compliance audit

**Deliverable**: Production-ready feature con real AI integration

---

### **FASE 5: Testing & Documentation** (Settimana 4 - Giorni 22-28)

#### Task 5.1: Unit Tests
- [ ] Backend endpoint tests:
  - `ai-generate-questions.test.ts`: Question generation + validation
  - `ai-generate-preset.test.ts`: Preset generation + schema enforcement
- [ ] Frontend component tests:
  - Question components (5 file tests)
  - Review components (4 file tests)
  - Wizard container (state machine transitions)
- [ ] API client tests (mock fetch)
- [ ] Reducer tests (all action types)

**Target**: >85% code coverage

#### Task 5.2: Integration Tests
- [ ] E2E wizard flow (Playwright):
  - Happy path: Intent → Questions → Answers → Preset → Save
  - Error scenarios: Timeout, network error, invalid input
  - Back navigation + state preservation
  - Cancel at various steps
- [ ] AI variance testing:
  - Same intent → 3 runs → check consistency (<20% hour variance)
  - Different intents → verify appropriate question diversity

#### Task 5.3: AI Quality Assurance
- [ ] Test con 20+ descrizioni realistiche
- [ ] Verificare question relevance (manual review)
- [ ] Verificare preset quality:
  - Activity codes sempre validi
  - Hours realistiche per complessità
  - Risk matching correct per compliance
- [ ] Low confidence threshold tuning

#### Task 5.4: Performance Optimization
- [ ] Question generation caching (Redis, 24h TTL, hash key = sanitized description)
- [ ] Preset generation caching (hash key = description + answers JSON)
- [ ] Lazy load wizard components (React.lazy + Suspense)
- [ ] Debounce textarea input (300ms)
- [ ] Image optimization per icons
- [ ] Bundle analysis + code splitting

#### Task 5.5: Documentation
- [ ] Update `docs/ai/ai-system-overview.md`:
  - Sezione "Two-Stage AI Architecture"
  - Documenta entrambi gli endpoints
  - Flow diagrams (Mermaid)
- [ ] Create `docs/ai/ai-interview-wizard-user-guide.md`:
  - Come funziona l'AI Interview
  - Best practices per intent description
  - Best practices per risposte alle domande
  - Interpretazione confidence score
  - FAQ
- [ ] Inline JSDoc per tutte le funzioni pubbliche
- [ ] Video tutorial (3-4 min) per onboarding
- [ ] Update `README.md` con nuova feature highlight

#### Task 5.6: Monitoring & Observability Setup
- [ ] CloudWatch metrics:
  - Question generation latency (p50, p95, p99)
  - Preset generation latency
  - Error rates per endpoint
  - Cache hit rates
- [ ] Sentry error tracking:
  - Custom tags: `ai-wizard`, `step-name`, `error-type`
  - User feedback integration
- [ ] Analytics events (Mixpanel/GA4):
  - `ai_interview_started`
  - `ai_questions_generated` (+ question count)
  - `ai_interview_completed` (+ answers count)
  - `ai_preset_generated` (+ confidence score)
  - `ai_preset_saved` (+ edits made count)
  - `ai_interview_abandoned` (+ step)
  - `ai_interview_fallback_to_manual`

**Deliverable**: Feature 100% pronta per production con metrics dashboard

---

## 🧪 Testing Strategy

### 1. Backend AI Endpoint Tests

**File**: `netlify/functions/ai-generate-preset.test.ts`

```typescript
describe('ai-generate-preset', () => {
  it('should reject too short descriptions', async () => {
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ description: 'test', userId: 'uuid' })
    });
    expect(response.statusCode).toBe(400);
  });

  it('should generate valid preset for e-commerce description', async () => {
    const response = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        description: 'Portale E-commerce B2B con React e SAP',
        complexity: 'HIGH',
        userId: 'uuid'
      })
    });
    const data = JSON.parse(response.body);
    expect(data.preset.activities).toHaveLength(> 0);
    expect(data.preset.category).toMatch(/FRONTEND|BACKEND|MULTI/);
  });

  it('should only return valid activity codes from DB', async () => {
    // Mock DB to return specific codes
    // Call endpoint
    // Assert response.preset.activities.every(a => dbCodes.includes(a.code))
  });
});
```

### 2. AI Variance Tests

**File**: `src/test/aiPresetGeneration.test.ts`

```typescript
describe('AI Preset Generation - Consistency', () => {
  const testDescriptions = [
    'Mobile app iOS per banking con biometria',
    'CRM web-based con Salesforce integration',
    'Microservizi backend Node.js per IoT'
  ];

  testDescriptions.forEach(description => {
    it(`should be consistent for: "${description}"`, async () => {
      const runs = await Promise.all(
        Array(3).fill(null).map(() => generatePresetWithAI(description, 'MEDIUM', 'test-user'))
      );

      // Check all runs have similar total hours (< 20% variance)
      const totalHours = runs.map(r => 
        r.preset!.activities.reduce((sum, a) => sum + a.estimatedHours, 0)
      );
      const variance = Math.max(...totalHours) / Math.min(...totalHours);
      expect(variance).toBeLessThan(1.2); // < 20% variance

      // Check all runs suggest same core activities (at least 70% overlap)
      const activitySets = runs.map(r => 
        new Set(r.preset!.activities.map(a => a.code))
      );
      const intersection = activitySets.reduce((acc, set) => 
        new Set([...acc].filter(x => set.has(x)))
      );
      expect(intersection.size / activitySets[0].size).toBeGreaterThan(0.7);
    });
  });
});
```

### 3. E2E User Flow Tests

**File**: `src/test/e2e/aiTechnologyWizard.spec.ts` (Playwright)

```typescript
test('complete AI wizard flow', async ({ page }) => {
  await page.goto('/configuration/presets');
  await page.click('button:has-text("Crea nuova tecnologia")');
  await page.click('text=Genera con AI');

  // Step 1: Prompt
  await page.fill('textarea[name="description"]', 'App mobile React Native per logistica');
  await page.click('button:has-text("Genera Bozza")');

  // Step 2: Wait for AI (max 30s)
  await page.waitForSelector('text=/Identità/i', { timeout: 30000 });

  // Step 3a: Identity
  expect(await page.inputValue('input[name="name"]')).toContain('Logistica');
  await page.click('button:has-text("Avanti")');

  // Step 3b: Activities
  await expect(page.locator('table tbody tr')).toHaveCount.greaterThan(0);
  await page.click('button:has-text("Avanti")');

  // Step 3c: Risks
  await page.click('button:has-text("Avanti")');

  // Step 4: Confirm
  await page.click('button:has-text("Salva Tecnologia")');
  await expect(page.locator('text=/Tecnologia creata/i')).toBeVisible();
});
```

---

## 📊 Success Metrics (Aggiornate)

### Quantitative KPIs

| Metrica | Target | Misurazione |
|---------|--------|-------------|
| **Question Generation Time** | < 5s (p95) | CloudWatch Netlify Functions |
| **Preset Generation Time** | < 12s (p95) | CloudWatch Netlify Functions |
| **End-to-End Wizard Time** | < 3 min (avg) | Analytics event tracking (start → save) |
| **AI Question Success Rate** | > 95% | Logs (questions returned vs errors) |
| **AI Preset Success Rate** | > 90% | Logs (preset generated vs errors) |
| **Question Relevance Score** | > 4.2/5 | User feedback survey post-interview |
| **Preset Confidence Score** | > 0.75 (avg) | DB analytics on generated presets |
| **User Adoption Rate** | > 50% via AI Interview | DB query (AI vs manual presets created) |
| **Interview Completion Rate** | > 75% | Analytics funnel (started vs completed) |
| **Manual Edits in Review** | < 25% fields | Track changes between generated and saved |
| **User Satisfaction** | > 4.5/5 | In-app NPS survey post-save |

### Qualitative Goals

- [ ] User feedback: "AI Interview è intuitivo e mi fa risparmiare tempo"
- [ ] User feedback: "Le domande sono pertinenti al mio progetto"
- [ ] Product: Riduce barriera entry per nuovi utenti (no form overwhelm)
- [ ] Product: Aumenta qualità dei preset (meno campi vuoti/sbagli)
- [ ] Tech: Dimostra capacità AI infra per future features (es. conversational refinement)

### Comparison Metrics (AI vs Manual)

| Aspetto | Manual Form | AI Interview | Target Improvement |
|---------|-------------|--------------|-------------------|
| Time to Complete | ~10 min | ~3 min | **-70%** |
| Fields Left Empty | ~30% | <10% | **-65%** |
| Activity Selection Errors | ~20% | <8% | **-60%** |
| User Drop-off Rate | ~40% | <25% | **-38%** |

---

## 🚨 Rischi & Mitigation (Aggiornati per Two-Stage)

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| **OpenAI API instabile (Stage 1)** | Media | Medio | Fallback: mostra 3 domande standard pre-definite + continue to Stage 2 |
| **OpenAI API instabile (Stage 2)** | Media | Alto | Fallback a form manuale + caching aggressive + retry logic |
| **AI genera domande irrilevanti** | Media | Medio | Feedback loop: "Queste domande sono utili?" → retrain prompt + examples |
| **User abbandona durante interview** | Alta | Medio | Auto-save draft in sessionStorage + "Resume" button on return |
| **AI suggerisce attività sbagliate** | Media | Medio | Human-in-the-loop review obbligatorio (Step 5) + reasoning display |
| **Costi OpenAI elevati** | Bassa | Medio | Rate limiting (20 question gen + 10 preset gen per day/user) + caching aggressive |
| **User preferisce sempre manual form** | Media | Basso | A/B testing + onboarding video + preset examples gallery |
| **Low confidence preset** | Alta | Basso | Warning banner: "Rivedi attentamente - AI incerto" + reasoning display |
| **Prompt injection attacks** | Bassa | Alto | 4-level validation + schema strict + no system prompt in response |
| **Interview feels too long (>5 questions)** | Media | Medio | Cap a 5 domande max + smart question prioritization in AI prompt |
| **Network timeout durante generation** | Media | Medio | Streaming response con status updates + "Cancel and Edit" button |

---

## 🔐 Security Checklist (Aggiornata)

- [ ] API key OpenAI mai esposta al client (solo server-side)
- [ ] Rate limiting differenziato:
  - [ ] Question generation: 20 calls/day/user
  - [ ] Preset generation: 10 calls/day/user
- [ ] Input sanitization a 4 livelli su TUTTI i text input (intent, text answers)
- [ ] Output validation con Zod + DB cross-check (activity/risk codes)
- [ ] Auth token required per entrambi gli endpoints
- [ ] Logging sanitized:
  - [ ] No user PII in logs
  - [ ] No full prompts/responses (solo metadata: length, question count)
  - [ ] Hash user answers per analytics (no raw values)
- [ ] Timeout differenziato:
  - [ ] Question generation: 15s
  - [ ] Preset generation: 30s
- [ ] No eval() o code execution su AI responses
- [ ] CORS allowlist verification su entrambi gli endpoint
- [ ] SQL injection protection su DB queries (parameterized)
- [ ] XSS protection: sanitize before rendering AI-generated text
- [ ] CSRF protection: validate origin header
- [ ] Content Security Policy headers configurati

---

## 📖 User Documentation Plan

### 1. In-App Onboarding

**First-time user flow**:
- Tooltip sopra "Genera con AI" button: "✨ Prova il nuovo wizard intelligente!"
- Video tutorial (30s) embedded in Step 1
- Example prompts suggeriti:
  - "App mobile React Native per logistica"
  - "Backend API Node.js con autenticazione OAuth"
  - "Dashboard React con grafici real-time"

### 2. Help Center Article

**Path**: `/docs/ai/ai-preset-wizard-user-guide.md`

**Sections**:
- Come funziona l'AI Wizard
- Best practices per descrivere una tecnologia
- Esempi di prompt efficaci
- Come interpretare le ore suggerite
- FAQ (es. "Posso modificare le attività?" → Sì, step 3b)

### 3. Admin Dashboard

**Metrics to expose**:
- Numero preset creati via AI vs Manual
- Average time wizard completion
- Most common technologies created
- Activity codes più suggeriti dall'AI

---

## 🎨 Design System Extensions

### New Components Needed

1. **`WizardStepper`**: Progress indicator (1 → 2 → 3 → 4)
   - Active state: blue
   - Completed: green checkmark
   - Disabled: gray

2. **`AIReasoningBadge`**: Tooltip mostra reasoning AI
   - Icon: Sparkles
   - Color: amber-500
   - Hover: show full reasoning text

3. **`ComplexitySlider`**: Tri-state slider (Low/Medium/High)
   - Visual: Color gradient (green → yellow → red)
   - Labels: "Semplice", "Medio", "Complesso"

4. **`EditableActivityTable`**: Table con inline editing
   - Editable column: Hours (input number)
   - Action column: Remove button
   - Footer: "Aggiungi attività manuale"

5. **`PresetSummaryCard`**: Read-only recap (Step 4)
   - Sections: Identity, Activities, Risks, Drivers
   - Style: Card con border-l-4 accent color per category

---

## 🔄 Future Enhancements (Post-MVP)

### Phase 2 Features (V2)

1. **Adaptive Question Branching**:
   - "Se user seleziona 'microservices', aggiungi domanda su container orchestration"
   - Dynamic question tree basato su risposte precedenti
   - Riduce interview length per scenari semplici

2. **Historical Learning**:
   - "Progetti simili hanno usato queste attività 85% delle volte"
   - ML clustering su preset esistenti per migliorare suggestions
   - Personalization basata su user history

3. **Collaborative Interviews**:
   - Multiple stakeholders rispondono a question sets diversi
   - Product Owner → domande business
   - Tech Lead → domande architetturali
   - Merge automatico delle risposte

4. **Voice Input per Intent**:
   - Registra descrizione vocale invece di typing
   - Speech-to-text con Azure/AWS
   - Particolarmente utile per mobile

5. **Question Templates**:
   - Pre-built interview sets per scenari comuni:
     - E-commerce template
     - CRM template
     - Mobile app template
     - Microservices template
   - User può selezionare template invece di free-text intent

6. **Smart Question Prioritization**:
   - AI ordina domande per importance based on intent
   - Opzionale: "Quick interview" (3 domande core) vs "Deep interview" (7 domande)

### Phase 3 Features (V3)

1. **Conversational AI Refinement**:
   - Chat-based interface dopo generation
   - "Aggiungi testing E2E", "Rimuovi deploy activities"
   - Iterative refinement senza tornare all'interview

2. **Visual Activity Builder**:
   - Drag-drop activities su timeline
   - AI suggestions come sidebar
   - Real-time hour calculation

3. **Preset Comparison & Benchmarking**:
   - "Confronta questa tecnologia con MERN_STACK"
   - Highlight differenze attività/rischi
   - Benchmark hours contro industry averages

4. **Multi-language Interview Support**:
   - User risponde in italiano/inglese/spagnolo
   - AI genera domande nella lingua preferita
   - Preset description tradotta automaticamente

5. **Confidence Score Explanation**:
   - Breakdown dettagliato: "Confidence bassa perché..."
   - Suggerimenti per migliorare input
   - Link a esempi migliori

### Technical Debt Planned

- [ ] Refactor `TechnologyDialog.tsx` per condividere form components con wizard
- [ ] Unificare validation logic tra manual e AI flow (shared hooks)
- [ ] Migrate a React Query per gestire AI call caching + retry
- [ ] Implement Optimistic UI updates (show draft preset mentre salva)
- [ ] Extract question rendering logic to standalone library (reusabile)

---

## 📝 Appendice: Prompt Examples Database

Per training e testing, creiamo un dataset di prompt → expected output:

```typescript
// seed-data/ai-preset-test-cases.ts
export const TEST_PROMPTS = [
  {
    input: "Applicazione mobile React Native per tracking logistica con GPS",
    expectedOutputs: {
      category: "FRONTEND",
      mustIncludeActivities: ["FE_DEV", "MOBILE_DEV", "INTEGRATION_TEST"],
      mustIncludeRisks: ["RISK_MOBILE_FRAGMENTATION", "RISK_GEOLOCATION"],
      estimatedTotalHours: { min: 200, max: 400 }
    }
  },
  {
    input: "Microservizi backend Node.js per IoT con MQTT e timeseries DB",
    expectedOutputs: {
      category: "BACKEND",
      mustIncludeActivities: ["BE_DEV", "ARCHITECTURE_DESIGN", "PERF_OPT"],
      mustIncludeRisks: ["RISK_SCALABILITY", "RISK_INTEGRATION_THIRD_PARTY"],
      estimatedTotalHours: { min: 250, max: 500 }
    }
  },
  // ... 20+ examples
];
```

---

## 🎯 Definition of Done (Aggiornata)

### Feature è completa quando:

- [ ] **Backend**: Entrambi gli endpoint funzionanti (question gen + preset gen)
- [ ] **Frontend**: Tutti i 6 wizard steps implementati e testati
- [ ] **Tests**: Tutti i test passano (unit + integration + E2E + AI variance)
  - [ ] Backend endpoint tests (question gen + preset gen)
  - [ ] Frontend component tests (>85% coverage)
  - [ ] E2E wizard flow tests (happy path + error scenarios)
  - [ ] AI consistency tests (20+ descriptions, 3 runs each)
- [ ] **Code Review**: Approvata da 2+ reviewers (1 backend, 1 frontend)
- [ ] **Documentation**: Completa e aggiornata
  - [ ] `docs/ai/ai-system-overview.md` updated (two-stage architecture)
  - [ ] `docs/ai/ai-interview-wizard-user-guide.md` created
  - [ ] `README.md` updated con feature highlight
  - [ ] JSDoc per tutte le funzioni pubbliche
  - [ ] Video tutorial (3-4 min) creato
- [ ] **Performance**: Metrics entro target
  - [ ] Question generation < 5s (p95)
  - [ ] Preset generation < 12s (p95)
  - [ ] End-to-end wizard < 3 min (avg)
- [ ] **Security**: Audit passed
  - [ ] Prompt injection tests passed
  - [ ] Rate limiting configurato e testato
  - [ ] Input sanitization verificata (4 levels)
  - [ ] No API keys exposed al client
- [ ] **Accessibility**: WCAG 2.1 AA compliance
  - [ ] Keyboard navigation completa
  - [ ] Screen reader labels corretti
  - [ ] Focus management tra steps
- [ ] **Deployment**: Staging + production ready
  - [ ] Deployed to staging con feature flag `ai_interview_wizard_enabled`
  - [ ] Smoke tests su staging passati
  - [ ] Rollback plan documentato
- [ ] **User Testing**: Validazione con utenti reali
  - [ ] Beta testing con 5+ utenti
  - [ ] Feedback raccolto e analizzato
  - [ ] NPS score > 4.5/5
- [ ] **Monitoring**: Observability configurata
  - [ ] Sentry error tracking con custom tags
  - [ ] CloudWatch metrics dashboard
  - [ ] Analytics events configurati
  - [ ] Alerting thresholds definiti

---

## 📞 Stakeholders & Responsibilities (Aggiornati)

| Ruolo | Persona | Responsabilità |
|-------|---------|----------------|
| **Product Owner** | TBD | Definizione requisiti, prioritizzazione, user acceptance |
| **Tech Lead** | TBD | Architettura two-stage, code review, deployment strategy |
| **Backend Dev #1** | TBD | Implementazione `/ai-generate-questions` endpoint |
| **Backend Dev #2** | TBD | Implementazione `/ai-generate-preset` endpoint |
| **Frontend Dev #1** | TBD | Wizard steps + state machine |
| **Frontend Dev #2** | TBD | Dynamic questionnaire + review components |
| **QA Engineer** | TBD | Test plan, E2E tests, AI variance testing, bug tracking |
| **UX Designer** | TBD | Wireframes wizard, user flow validation, interview design |
| **DevOps** | TBD | Netlify Functions monitoring, caching strategy, CloudWatch setup |
| **AI/ML Engineer** (Optional) | TBD | Prompt engineering optimization, confidence scoring tuning |

---

## 📅 Milestones & Timeline (Aggiornati per Two-Stage)

```
Week 1: Backend Two-Stage Foundation
├─ Day 1-3: Stage 1 - Question Generation
│  ├─ Setup endpoint + prompt engineering
│  ├─ Question schema + validation
│  └─ Test con 20+ scenari diversi
│
└─ Day 4-7: Stage 2 - Preset Generation
   ├─ Setup endpoint + enriched context building
   ├─ Preset schema + enum enforcement
   ├─ Priority tagging + confidence scoring
   └─ Integration tests (Stage 1 → Stage 2)

Week 2: Frontend Core Components
├─ Day 8-9: Type system + Dynamic Questionnaire
│  ├─ ai-interview.ts types + schemas
│  ├─ Question components (4 types)
│  └─ DynamicQuestionnaire container
│
├─ Day 10-11: State Machine + API Clients
│  ├─ useAiWizardState reducer + actions
│  ├─ ai-interview-api.ts client
│  └─ ai-preset-api.ts client (updated)
│
└─ Day 12: Review Components
   ├─ ReviewIdentitySection
   ├─ ReviewActivitiesTable
   └─ ReviewSummaryCard

Week 3: Wizard Integration + Polish
├─ Day 13-15: Wizard Assembly
│  ├─ AiTechnologyWizard container
│  ├─ All step components
│  ├─ WizardProgress stepper
│  └─ Real API integration
│
├─ Day 16-17: UX Refinements
│  ├─ Loading states + animations
│  ├─ Error handling + retry logic
│  ├─ Tooltips + reasoning displays
│  └─ Keyboard navigation + a11y
│
└─ Day 18-19: UI Entry Point
   ├─ Update ConfigurationPresets.tsx
   ├─ PresetCreationMenu dropdown
   └─ E2E testing

Week 4: Testing, Documentation & Launch
├─ Day 20-22: Comprehensive Testing
│  ├─ Unit tests (backend + frontend)
│  ├─ Integration tests (E2E flow)
│  ├─ AI variance tests (consistency)
│  └─ Performance optimization
│
├─ Day 23-25: Documentation
│  ├─ Update ai-system-overview.md
│  ├─ Create ai-interview-wizard-user-guide.md
│  ├─ Video tutorial creation
│  └─ JSDoc completion
│
├─ Day 26: Monitoring Setup
│  ├─ CloudWatch dashboards
│  ├─ Sentry configuration
│  └─ Analytics events
│
└─ Day 27-28: Staging + Production Launch
   ├─ Staging deployment + smoke tests
   ├─ Beta user testing (5+ users)
   ├─ Production deploy (feature flag)
   └─ Post-launch monitoring
```

**Checkpoint Reviews**: 
- End of Week 1 (Backend completeness)
- End of Week 2 (Frontend components readiness)
- End of Week 3 (Integration quality)
- Day 26 (Go/No-Go decision pre-production)

---
├─ Day 8-9: Wizard container + navigation
└─ Day 10: Mock data testing

Week 3: Integration
├─ Day 11-12: UI entry point + routing
├─ Day 13-14: E2E integration + UX polish
└─ Day 15: A11y + responsive

Week 4: Testing & Launch
├─ Day 16-17: Unit + integration tests
├─ Day 18-19: AI variance tests + E2E
├─ Day 20: Documentation + staging deploy
└─ Day 21: Production deploy + monitoring
```

**Checkpoint Reviews**: Fine Week 2, Fine Week 3  
**Go/No-Go Decision**: Day 20 (pre-production)

---

## ✅ Pre-Launch Checklist

- [ ] Feature flag `ai_preset_wizard_enabled` configurato
- [ ] Rollout graduale: 10% → 50% → 100% utenti
- [ ] Fallback a form manuale testato
- [ ] OpenAI API quota verificata (rate limits enterprise)
- [ ] Caching layer (Redis/Netlify) configurato
- [ ] Sentry error tracking con tag `ai-preset-wizard`
- [ ] Analytics events configurati (Mixpanel/GA4):
  - `ai_wizard_started`
  - `ai_wizard_step_completed`
  - `ai_wizard_preset_saved`
  - `ai_wizard_failed`
- [ ] Customer support training (FAQ AI wizard)
- [ ] Rollback runbook documentato

---

## 🚀 Launch Day Plan

### T-1 Hour
- [ ] Smoke test su staging
- [ ] Verify OpenAI API status (status.openai.com)
- [ ] Pre-warm Netlify Functions (trigger cold start)

### T0 (Launch)
- [ ] Enable feature flag per 10% utenti
- [ ] Monitor dashboard (latency, errors, success rate)
- [ ] Slack channel #ai-wizard-launch attivo

### T+2 Hours
- [ ] Review metrics: AI success rate > 90%?
- [ ] Check error logs: nessun 500?
- [ ] User feedback: nessun report critico?
- [ ] Go/No-Go: Aumentare a 50%

### T+24 Hours
- [ ] Full rollout 100% utenti
- [ ] Post-launch retro meeting
- [ ] Identify quick wins e bugs

---

**Document Version**: 2.0 - Two-Stage AI Interview Architecture  
**Last Updated**: 2025-12-07  
**Author**: AI Senior Frontend Architect & Product Engineer  
**Status**: ✅ Ready for Implementation  
**Key Changes from V1.0**:
- Evolved from single-stage to **two-stage AI interaction** (Question Generation → Preset Generation)
- Added interactive interview flow con domande dinamiche
- Enhanced confidence scoring e priority tagging per activities
- Improved user journey con structured answer collection
- Updated file structure per nuovi componenti (DynamicQuestionnaire, interview steps)
- Refined success metrics e KPIs per two-stage approach
