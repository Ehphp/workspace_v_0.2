/**
 * Preset Generation Prompt Configuration
 * 
 * System prompt and schema for AI-powered preset generation based on user answers.
 */

/**
 * System prompt for preset generation with REUSABLE ACTIVITY TEMPLATES
 * GPT generates GENERIC activities that can be reused across multiple projects
 * IMPORTANT: Must contain "JSON" keyword for OpenAI response_format compatibility
 */
export const PRESET_GENERATION_SYSTEM_PROMPT = `You are an expert Technical Estimator creating REUSABLE ACTIVITY TEMPLATES for a technology preset. Respond ONLY with valid JSON.

## 🎯 CRITICAL UNDERSTANDING

1. You are NOT describing THIS specific project - you are creating GENERIC BUILDING BLOCKS reusable for MANY projects
2. Write ALL content (name, descriptions, activities) in the SAME LANGUAGE as the user input
3. Preset description must describe the TECHNOLOGY/PROJECT capabilities, NOT meta information about reusability

**THE GOLDEN TEST**: "Can this activity be used for 10+ different projects?"
- If answer is NO → Make it more generic
- If it contains specific business terms (Employee, Product, Login) → Too specific, rewrite it

## ❌ FORBIDDEN: Project-Specific Content

**Never use these in activity titles or descriptions:**

### Business Entity Names
- ❌ Employee, Dipendente, User, Utente, Customer, Cliente
- ❌ Product, Prodotto, Order, Ordine, Invoice, Fattura
- ❌ Department, Project, Task, Contract, Document

### Specific Features/Screens
- ❌ Login, Registration, Checkout, Payment, Onboarding
- ❌ Dashboard, Profile, Settings, Homepage, Admin Panel

### Specific Fields/Attributes
- ❌ Nome, Cognome, Email, Telefono, Indirizzo
- ❌ Prezzo, Quantità, Data, Codice, Matricola

### Specific Endpoints/Paths
- ❌ /auth/login, /api/users, /products/list
- ❌ /checkout, /payment, /admin

**Why forbidden?** These tie the activity to ONE specific use case. We need REUSABLE templates!

## ✅ CORRECT: Generic Technical Patterns

Use these generic terms instead:

### Data Layer
- ✅ "entità custom", "master data", "transactional data"
- ✅ "relazioni 1:N", "lookup multipli", "campi standard"
- ✅ "security roles", "business rules", "validation logic"

### UI Layer
- ✅ "form con validation", "interfaccia multi-step", "componente riusabile"
- ✅ "layout responsivo", "navigation pattern", "state management"

### Integration Layer
- ✅ "endpoint CRUD", "API con autenticazione", "servizio integrazione"
- ✅ "background job", "data sync", "webhook handler"

## 📋 Activity Structure by Technology

### Power Platform Templates
✅ "Setup entità Dataverse con campi custom e relazioni"
✅ "Configurazione form multi-tab con business rules"
✅ "Power Automate flow con approval workflow multi-stage"
✅ "Canvas App con offline sync e geolocalizzazione"
✅ "Model-driven App con dashboard e report personalizzati"
✅ "Configurazione security roles e team permissions"
✅ "Deploy soluzione tra ambienti con connection references"

### React/Frontend Templates
✅ "Componente React riusabile con state management"
✅ "Form complesso con validation schema (Yup/Zod)"
✅ "Integrazione API REST con error handling e retry"
✅ "Sistema routing protetto con autenticazione"
✅ "Layout responsivo con grid system e breakpoints"
✅ "State management globale (Context/Redux/Zustand)"

### Backend/API Templates
✅ "Endpoint REST CRUD con pagination e filtering"
✅ "Middleware autenticazione e autorizzazione"
✅ "Servizio integrazione con API esterna"
✅ "Background job processing con queue management"
✅ "Database migration e data seeding"
✅ "API documentation con OpenAPI/Swagger"

### Testing Templates
✅ "Setup test environment con mock data"
✅ "Unit test per business logic core"
✅ "Integration test per API endpoints"
✅ "E2E test per user flows critici"

## 🔍 Self-Check Before Responding

For EACH activity you generate, ask yourself:

1. **Reusability Test**: "Could I use this exact activity for 10+ different projects?"
   - If NO → Rewrite to be more generic

2. **Specificity Check**: "Does this contain ANY business entity, feature name, or specific field?"
   - If YES → Remove it, use generic terms

3. **Pattern vs Requirement**: "Am I describing a technical PATTERN or a business REQUIREMENT?"
   - Must be technical pattern, not business requirement

4. **Length Check**: "Is the title short and focused on ONE technical pattern?"
   - Should be 40-80 chars, focus on one thing

## 📤 OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no code blocks):
{
  "success": true,
  "preset": {
    "name": "Brief technology name (40-60 chars)",
    "description": "Generic summary of technology capabilities (80-150 chars)",
    "detailedDescription": "Technical context: when to use, key patterns, tech stack (150-250 words MAX)",
    "techCategory": "FRONTEND" | "BACKEND" | "MULTI",
    "activities": [
      {
        "title": "GENERIC technical pattern (40-80 chars, NO specific names!)",
        "description": "Implementation approach focusing on HOW, not WHAT specific content (50-120 words MAX)",
        "estimatedHours": 8,
        "group": "ANALYSIS" | "DEV" | "TEST" | "OPS" | "GOVERNANCE",
        "priority": "core" | "recommended" | "optional",
        "confidence": 0.7
      }
    ],
    "driverValues": {
      "COMPLEXITY": "LOW" | "MEDIUM" | "HIGH",
      "TEAM_EXPERIENCE": "LOW" | "MEDIUM" | "HIGH",
      "QUALITY_REQUIREMENTS": "LOW" | "MEDIUM" | "HIGH"
    },
    "riskCodes": ["INTEGRATION_RISK", "TECH_STACK_RISK", "COMPLIANCE_RISK"],
    "reasoning": "Why these generic activities fit this technology type (80-150 words MAX)",
    "confidence": 0.8
  }
}

This is a JSON response. Always return pure JSON without any formatting.

## 💡 Example Good vs Bad

### Activities
❌ BAD (project-specific):
{
  "title": "Creazione entità Employee con campi Nome, Email, Matricola",
  "description": "Implementare la tabella dipendenti nel modulo HR con campi anagrafica e lookup al reparto"
}

✅ GOOD (generic template):
{
  "title": "Setup entità Dataverse con campi custom e relazioni",
  "description": "Configurazione entità master data con campi standard, relazioni 1:N, security roles e business rules per validation"
}

### Preset Descriptions
❌ BAD (meta information):
"This preset focuses on creating reusable activities for integrating various components within the Power Platform."

✅ GOOD (technology description):
"Soluzione Power Platform per integrazione componenti enterprise con autenticazione OAuth, gestione dati Dataverse e API RESTful."

Remember: GENERIC = REUSABLE = VALUABLE for many future projects!`;

/**
 * JSON Schema for preset generation response validation
 * Schema for GPT-generated custom activities (no catalog codes)
 */
export function createPresetGenerationSchema() {
    return {
        type: "object",
        properties: {
            success: {
                type: "boolean",
                description: "Whether preset generation was successful"
            },
            preset: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        minLength: 3,
                        maxLength: 255
                    },
                    description: {
                        type: "string",
                        minLength: 10,
                        maxLength: 1000
                    },
                    detailedDescription: {
                        type: "string",
                        minLength: 50,
                        maxLength: 2000
                    },
                    techCategory: {
                        type: "string",
                        enum: ["FRONTEND", "BACKEND", "MULTI"]
                    },
                    activities: {
                        type: "array",
                        minItems: 8,
                        maxItems: 15,
                        items: {
                            type: "object",
                            properties: {
                                title: {
                                    type: "string",
                                    minLength: 10,
                                    maxLength: 150
                                },
                                description: {
                                    type: "string",
                                    minLength: 20,
                                    maxLength: 500
                                },
                                group: {
                                    type: "string",
                                    enum: ["ANALYSIS", "DEV", "TEST", "OPS", "GOVERNANCE"]
                                },
                                estimatedHours: {
                                    type: "number",
                                    minimum: 1,
                                    maximum: 320
                                },
                                confidence: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 1
                                },
                                priority: {
                                    type: "string",
                                    enum: ["core", "recommended", "optional"]
                                }
                            },
                            required: ["title", "description", "group", "estimatedHours", "confidence", "priority"],
                            additionalProperties: false
                        }
                    },
                    driverValues: {
                        type: "object",
                        additionalProperties: { type: "string" }
                    },
                    riskCodes: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 0,
                        maxItems: 10
                    },
                    suggestedDrivers: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                code: { type: "string" },
                                value: { type: "string" },
                                reasoning: { type: "string" }
                            },
                            required: ["code", "value"],
                            additionalProperties: false
                        }
                    },
                    suggestedRisks: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                code: { type: "string" },
                                reasoning: { type: "string" }
                            },
                            required: ["code"],
                            additionalProperties: false
                        }
                    },
                    reasoning: {
                        type: "string",
                        minLength: 20,
                        maxLength: 1000
                    },
                    confidence: {
                        type: "number",
                        minimum: 0,
                        maximum: 1
                    }
                },
                required: ["name", "description", "techCategory", "activities", "driverValues", "riskCodes", "reasoning", "confidence"],
                additionalProperties: false
            },
            error: {
                type: "string"
            },
            metadata: {
                type: "object",
                properties: {
                    totalActivities: { type: "number" },
                    coreActivities: { type: "number" },
                    recommendedActivities: { type: "number" },
                    optionalActivities: { type: "number" },
                    estimatedDays: { type: "number" },
                    generationTimeMs: { type: "number" }
                },
                additionalProperties: false
            }
        },
        required: ["success"],
        additionalProperties: false
    };
}

/**
 * Build enriched user prompt with context
 * No activities catalog needed - GPT generates custom activities
 */
export function buildPresetGenerationPrompt(
    description: string,
    answers: Record<string, any>,
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI'
): string {
    // Format answers for readability
    const formattedAnswers = Object.entries(answers)
        .map(([key, value]) => {
            const formattedValue = Array.isArray(value) ? value.join(', ') : value;
            return `- ${key}: ${formattedValue} `;
        })
        .join('\n');

    const categoryHint = suggestedTechCategory
        ? `\n ** SUGGESTED CATEGORY **: ${suggestedTechCategory} `
        : '';

    return `
## PROJECT DESCRIPTION
${description}

## WIZARD ANSWERS
${formattedAnswers}${categoryHint}

---

    Generate a complete estimation preset with custom activities tailored to this specific project.
`.trim();
}

