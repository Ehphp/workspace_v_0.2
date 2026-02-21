/**
 * Netlify Function: AI Requirement Interview - Question Generation
 * 
 * Generates technical interview questions based on:
 * - Requirement description
 * - Selected technology preset
 * 
 * Questions are designed for technical-to-technical dialogue.
 * If the developer doesn't know an answer, they should ask the functional analyst.
 * 
 * POST /.netlify/functions/ai-requirement-interview
 */

import { createAIHandler } from './lib/handler';
import { getOpenAIClient } from './lib/ai/openai-client';

interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
}

interface RequestBody {
    description: string;
    techPresetId: string;
    techCategory: string;
    projectContext?: ProjectContext;
}

/**
 * System prompt for generating technical interview questions
 */
const SYSTEM_PROMPT = `Sei un Tech Lead esperto specializzato in {TECH_CATEGORY}.
Genera 4-6 domande TECNICHE SPECIFICHE per questa tecnologia per stimare correttamente il requisito.

STACK TECNOLOGICO SELEZIONATO: {TECH_CATEGORY}
Le tue domande DEVONO essere specifiche per questa tecnologia, non generiche!

{TECH_SPECIFIC_QUESTIONS}

REGOLE FONDAMENTALI:
1. Domande DA TECNICO A TECNICO - usa terminologia specifica di {TECH_CATEGORY}
2. Se lo sviluppatore non sa rispondere, significa che deve chiedere chiarimenti al funzionale
3. Ogni domanda deve avere impatto MISURABILE e DIRETTO sulla stima
4. Sii SPECIFICO per questo requisito e questa tecnologia
5. Genera tra 4 e 6 domande (non di più per non rallentare il processo)
6. NON fare domande generiche - ogni domanda deve menzionare componenti/tool specifici di {TECH_CATEGORY}

⚠️ REGOLA CRITICA: EVITA DOMANDE APERTE!
- NON usare type "text" - le domande aperte rallentano l'utente e sono vaghe
- Usa SEMPRE scelte predefinite: single-choice, multiple-choice, range
- Se pensi serva una domanda aperta, trasformala in multiple-choice con opzioni comuni

FORMATO OUTPUT (JSON):
{
  "questions": [
    {
      "id": "q1_specifico_tecnologia",
      "type": "single-choice" | "multiple-choice" | "range",
      "category": "INTEGRATION" | "DATA" | "SECURITY" | "PERFORMANCE" | "UI_UX" | "ARCHITECTURE" | "TESTING" | "DEPLOYMENT",
      "question": "Domanda SPECIFICA per {TECH_CATEGORY}",
      "technicalContext": "Perché questo impatta {TECH_CATEGORY} specificamente",
      "impactOnEstimate": "Come cambia la stima in termini di attività {TECH_CATEGORY}",
      "options": [{"id": "opt1", "label": "Opzione tecnica", "description": "Impatto specifico"}],
      "required": true,
      "min": null, "max": null, "step": null, "unit": null
    }
  ],
  "reasoning": "Spiegazione di perché queste domande sono rilevanti per {TECH_CATEGORY}",
  "estimatedComplexity": "LOW" | "MEDIUM" | "HIGH",
  "suggestedActivities": []
}

TIPI DI DOMANDA CONSENTITI (⛔ NO "text"):
- single-choice: Per decisioni tecniche binarie o con poche opzioni (2-5 opzioni)
- multiple-choice: Per selezione multipla di componenti/pattern/requisiti (3+ opzioni)
- range: Per quantità numeriche (con min, max, step, unit)

IMPORTANTE:
- Ogni opzione deve riflettere scelte implementative reali in {TECH_CATEGORY}
- Per campi non usati (es. min/max per single-choice), metti null
- Il campo "required" deve essere true per domande critiche
- Fornisci SEMPRE almeno 2 opzioni per single-choice e 3+ per multiple-choice`;

/**
 * Technology-specific question templates
 */
const TECH_SPECIFIC_PROMPTS: Record<string, string> = {
    'POWER_PLATFORM': `
DOMANDE SPECIFICHE POWER PLATFORM:

DATAVERSE (DATA):
- Quante nuove tabelle/entità Dataverse servono?
- Quanti campi custom per tabella? (few: 1-5, medium: 6-15, many: 15+)
- Servono lookup/relazioni tra tabelle? Quante?
- È necessaria migrazione dati da Excel/sistemi legacy?
- Ci sono requisiti di row-level security (business units)?

POWER APPS - CANVAS/MODEL-DRIVEN (UI_UX):
- Canvas App o Model-Driven App?
- Quante schermate/form sono necessarie?
- Complessità form: campi semplici, validazioni condizionali, tab multipli?
- Servono componenti custom (PCF)?
- Integrazione con altri sistemi dalla UI (API calls)?

POWER AUTOMATE (INTEGRATION):
- Quanti flussi sono necessari?
- Flussi trigger-based o scheduled?
- Integrazioni con altri sistemi? Quali connettori?
- Servono approval workflow?
- Gestione errori/retry necessaria?

BUSINESS RULES & LOGIC:
- Quante Business Rules Dataverse?
- Servono Plugin/Custom Actions?
- JavaScript/TypeScript form scripting necessario?
- Calculated/Rollup fields?

TESTING & DEPLOY (TESTING/DEPLOYMENT):
- Quanti ambienti (Dev/Test/UAT/Prod)?
- Solution managed o unmanaged?
- Test automation possibile? Test manuale richiesto?
- Rollback strategy necessaria?`,

    'BACKEND': `
DOMANDE SPECIFICHE BACKEND (.NET/API):

API DESIGN (ARCHITECTURE):
- Quanti nuovi endpoint API?
- REST, GraphQL, gRPC?
- Autenticazione: JWT, OAuth2, API Key?
- Versionamento API necessario?

DATABASE (DATA):
- Nuove tabelle/migrazioni EF Core?
- Query complesse? Stored procedures?
- Caching strategy (Redis, Memory Cache)?
- Read replica necessaria?

INTEGRATION (INTEGRATION):
- Servizi esterni da chiamare?
- Message queue (RabbitMQ, Azure Service Bus)?
- Event-driven architecture?
- Retry/Circuit breaker pattern?

BUSINESS LOGIC:
- Complessità logica di business (semplice CRUD vs. orchestrazione)?
- Validazioni complesse?
- Background jobs/workers?

TESTING (TESTING):
- Unit test coverage target?
- Integration tests necessari?
- Load/performance testing?

DEPLOY (DEPLOYMENT):
- Azure, AWS, on-premise?
- Containerizzato (Docker/K8s)?
- CI/CD pipeline da configurare?`,

    'FRONTEND': `
DOMANDE SPECIFICHE FRONTEND (React/Vue/Angular):

UI COMPONENTS (UI_UX):
- Quante nuove pagine/viste?
- Complessità form (campi, validazioni, stepper)?
- Design system esistente o da creare?
- Responsive/mobile-first?
- Accessibilità (WCAG) richiesta?

STATE MANAGEMENT (ARCHITECTURE):
- Store globale necessario (Redux, Zustand)?
- Complessità stato locale vs globale?
- Caching client-side?
- Ottimistic updates?

API INTEGRATION (INTEGRATION):
- Quante API da integrare?
- Real-time updates (WebSocket, SSE)?
- Error handling/retry?
- Loading states complessi?

TESTING (TESTING):
- Unit test componenti?
- E2E testing (Cypress, Playwright)?
- Visual regression testing?

BUILD & DEPLOY (DEPLOYMENT):
- SSR necessario?
- CDN/hosting?
- Bundle optimization?`,

    'MULTI': `
DOMANDE PER PROGETTI MULTI-STACK:

ARCHITETTURA GENERALE (ARCHITECTURE):
- Quanti layer/componenti coinvolti?
- Comunicazione sync o async tra componenti?
- API gateway necessario?

COORDINAMENTO (INTEGRATION):
- Quanti team coinvolti?
- Contratti API da definire?
- Dipendenze tra componenti?

TESTING (TESTING):
- Test E2E cross-system?
- Environment di integrazione?
- Test data management?`,
};

/**
 * Get tech-specific prompt section
 */
function getTechSpecificPrompt(techCategory: string): string {
    return TECH_SPECIFIC_PROMPTS[techCategory] || TECH_SPECIFIC_PROMPTS['MULTI'];
}

/**
 * JSON Schema for structured output
 */
const RESPONSE_SCHEMA = {
    type: 'json_schema' as const,
    json_schema: {
        name: 'technical_interview_response',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                questions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            type: {
                                type: 'string',
                                enum: ['single-choice', 'multiple-choice', 'range']
                            },
                            category: {
                                type: 'string',
                                enum: ['INTEGRATION', 'DATA', 'SECURITY', 'PERFORMANCE', 'UI_UX', 'ARCHITECTURE', 'TESTING', 'DEPLOYMENT']
                            },
                            question: { type: 'string' },
                            technicalContext: { type: 'string' },
                            impactOnEstimate: { type: 'string' },
                            options: {
                                type: ['array', 'null'],
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        label: { type: 'string' },
                                        description: { type: 'string' }
                                    },
                                    required: ['id', 'label', 'description'],
                                    additionalProperties: false
                                }
                            },
                            required: { type: 'boolean' },
                            min: { type: ['number', 'null'] },
                            max: { type: ['number', 'null'] },
                            step: { type: ['number', 'null'] },
                            unit: { type: ['string', 'null'] }
                        },
                        required: ['id', 'type', 'category', 'question', 'technicalContext', 'impactOnEstimate', 'required', 'options', 'min', 'max', 'step', 'unit'],
                        additionalProperties: false
                    }
                },
                reasoning: { type: 'string' },
                estimatedComplexity: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH']
                },
                suggestedActivities: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['questions', 'reasoning', 'estimatedComplexity', 'suggestedActivities'],
            additionalProperties: false
        }
    }
};

/**
 * Map tech category to human-readable description
 */
function getTechCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
        'BACKEND': 'Backend .NET/API (C#, ASP.NET Core, Entity Framework)',
        'BACKEND_API': 'Backend API (REST/GraphQL services)',
        'FRONTEND': 'Frontend Web (React, TypeScript, CSS)',
        'FRONTEND_WEB': 'Frontend Web (React, Vue, Angular)',
        'FRONTEND_MOBILE': 'Mobile App (React Native, Flutter, Native)',
        'FULLSTACK': 'Full Stack (Frontend + Backend)',
        'DATA_PIPELINE': 'Data Pipeline (ETL, Data Processing)',
        'INFRASTRUCTURE': 'Infrastructure (DevOps, Cloud)',
        'POWER_PLATFORM': 'Microsoft Power Platform (Power Apps, Power Automate, Dataverse)',
        'POWERPLATFORM': 'Microsoft Power Platform (Power Apps, Power Automate, Dataverse)',
        'DYNAMICS365': 'Microsoft Dynamics 365',
        'SHAREPOINT': 'SharePoint / Microsoft 365',
        'MULTI': 'Multi-technology / Cross-platform',
    };

    return descriptions[category] || category;
}

export const handler = createAIHandler<RequestBody>({
    name: 'ai-requirement-interview',
    requireAuth: false, // Allow unauthenticated for Quick Estimate demo
    requireOpenAI: true,

    validateBody: (body) => {
        if (!body.description || typeof body.description !== 'string') {
            return 'Missing or invalid description field';
        }
        if (!body.techCategory || typeof body.techCategory !== 'string') {
            return 'Missing or invalid techCategory field';
        }
        return null;
    },

    handler: async (body, ctx) => {
        const sanitizedDescription = ctx.sanitize(body.description);

        if (sanitizedDescription.length < 15) {
            throw new Error('La descrizione deve contenere almeno 15 caratteri.');
        }

        if (sanitizedDescription.length > 2000) {
            throw new Error('La descrizione è troppo lunga (max 2000 caratteri).');
        }

        // Initialize OpenAI client with 'extended' preset (55s timeout)
        const openai = getOpenAIClient('extended');
        const techCategoryDescription = getTechCategoryDescription(body.techCategory);
        const techSpecificPrompt = getTechSpecificPrompt(body.techCategory);

        // Build project context section for the prompt
        let projectContextSection = '';
        if (body.projectContext) {
            projectContextSection = `
CONTESTO PROGETTO (informazioni già note, NON chiedere domande su questi aspetti):
- Nome progetto: ${body.projectContext.name}
- Descrizione progetto: ${body.projectContext.description}
${body.projectContext.owner ? `- Responsabile: ${body.projectContext.owner}` : ''}

IMPORTANTE: Non fare domande su informazioni già presenti nel contesto del progetto.
Le tue domande devono concentrarsi SOLO sugli aspetti specifici di QUESTO requisito
che non sono già chiari dalla descrizione del progetto.
`;
        }

        console.log('[ai-requirement-interview] Generating questions for:', {
            descriptionLength: sanitizedDescription.length,
            techCategory: body.techCategory,
            techPresetId: body.techPresetId,
            hasProjectContext: !!body.projectContext,
        });

        // Build system prompt with tech category and specific questions
        const systemPromptWithCategory = SYSTEM_PROMPT
            .replace(/{TECH_CATEGORY}/g, techCategoryDescription)
            .replace('{TECH_SPECIFIC_QUESTIONS}', techSpecificPrompt);

        // Build user prompt with optional project context
        const userPrompt = body.projectContext
            ? `${projectContextSection}
STACK: ${techCategoryDescription}

Requisito da stimare:
${sanitizedDescription}

Genera domande tecniche SPECIFICHE per ${techCategoryDescription} che chiariscono SOLO gli aspetti implementativi NON già coperti dal contesto del progetto.`
            : `STACK: ${techCategoryDescription}

Requisito da stimare:
${sanitizedDescription}

Genera domande tecniche SPECIFICHE per ${techCategoryDescription} che chiariscono gli aspetti implementativi.`;

        console.log('[ai-requirement-interview] Calling OpenAI API...');
        const startTime = Date.now();

        // Call OpenAI with deterministic settings
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0,
            seed: 42,
            max_tokens: 2000,
            messages: [
                { role: 'system', content: systemPromptWithCategory },
                { role: 'user', content: userPrompt }
            ],
            response_format: RESPONSE_SCHEMA,
        });

        console.log(`[ai-requirement-interview] OpenAI responded in ${Date.now() - startTime}ms`);

        // Parse response
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const result = JSON.parse(content);

        // Validate we got questions
        if (!result.questions || result.questions.length === 0) {
            throw new Error('No questions generated');
        }

        // Log success
        console.log('[ai-requirement-interview] Generated:', {
            questionCount: result.questions.length,
            categories: [...new Set(result.questions.map((q: any) => q.category))],
            complexity: result.estimatedComplexity,
            suggestedActivities: result.suggestedActivities?.length || 0,
        });

        return {
            success: true,
            questions: result.questions,
            reasoning: result.reasoning,
            estimatedComplexity: result.estimatedComplexity,
            suggestedActivities: result.suggestedActivities || [],
        };
    }
});
