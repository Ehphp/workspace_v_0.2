import { z } from 'zod';
import { getDefaultProvider, LLM_PRESETS } from '../openai-client';
import { sanitizePromptInput } from '../../../../../src/types/ai-validation';

/**
 * Activity information for consultant analysis
 */
export interface AnalysisActivity {
    code: string;
    name: string;
    description: string;
    base_hours: number;
    group: string;
}

/**
 * Driver information for consultant analysis
 */
export interface AnalysisDriver {
    code: string;
    name: string;
    selectedValue: string;
    multiplier: number;
}

/**
 * Project context for consultant analysis
 */
export interface ProjectContext {
    name: string;
    description: string;
    owner?: string;
}

/**
 * Input request for consultant analysis
 */
export interface ConsultantAnalysisRequest {
    requirementTitle: string;
    requirementDescription: string;
    activities: AnalysisActivity[];
    drivers: AnalysisDriver[];
    projectContext: ProjectContext;
    technologyName: string;
    technologyCategory: string;
}

/**
 * Discrepancy item identified by the consultant
 */
export interface DiscrepancyItem {
    type: 'missing_coverage' | 'over_engineering' | 'activity_mismatch' | 'driver_issue';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
}

/**
 * Risk analysis item
 */
export interface RiskAnalysisItem {
    category: 'technical' | 'integration' | 'resource' | 'timeline' | 'requirement_clarity';
    level: 'low' | 'medium' | 'high';
    description: string;
    mitigation: string;
}

/**
 * Senior Consultant Analysis result
 */
export interface SeniorConsultantAnalysis {
    implementationTips: string; // Markdown formatted
    discrepancies: DiscrepancyItem[];
    riskAnalysis: RiskAnalysisItem[];
    overallAssessment: 'approved' | 'needs_review' | 'concerns';
    estimatedConfidence: number; // 0-100
    generatedAt: string;
}

/**
 * Zod schema for validating AI response
 */
const ConsultantResponseSchema = z.object({
    implementationTips: z.string().max(5000),
    discrepancies: z.array(z.object({
        type: z.enum(['missing_coverage', 'over_engineering', 'activity_mismatch', 'driver_issue']),
        severity: z.enum(['low', 'medium', 'high']),
        description: z.string().max(500),
        recommendation: z.string().max(500),
    })).max(10),
    riskAnalysis: z.array(z.object({
        category: z.enum(['technical', 'integration', 'resource', 'timeline', 'requirement_clarity']),
        level: z.enum(['low', 'medium', 'high']),
        description: z.string().max(500),
        mitigation: z.string().max(500),
    })).max(10),
    overallAssessment: z.enum(['approved', 'needs_review', 'concerns']),
    estimatedConfidence: z.number().min(0).max(100),
});

/**
 * Create JSON schema for structured outputs
 */
function createConsultantSchema() {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "senior_consultant_analysis",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    implementationTips: {
                        type: "string",
                        description: "Detailed implementation tips and architectural recommendations in Markdown format. Include sections for: Architecture Overview, Key Implementation Steps, Best Practices, and Integration Points."
                    },
                    discrepancies: {
                        type: "array",
                        description: "List of identified discrepancies between requirement and selected activities",
                        items: {
                            type: "object",
                            properties: {
                                type: {
                                    type: "string",
                                    enum: ["missing_coverage", "over_engineering", "activity_mismatch", "driver_issue"],
                                    description: "Type of discrepancy"
                                },
                                severity: {
                                    type: "string",
                                    enum: ["low", "medium", "high"],
                                    description: "Severity level of the discrepancy"
                                },
                                description: {
                                    type: "string",
                                    description: "Clear description of the discrepancy"
                                },
                                recommendation: {
                                    type: "string",
                                    description: "Actionable recommendation to address the discrepancy"
                                }
                            },
                            required: ["type", "severity", "description", "recommendation"],
                            additionalProperties: false
                        }
                    },
                    riskAnalysis: {
                        type: "array",
                        description: "Risk analysis for the estimation",
                        items: {
                            type: "object",
                            properties: {
                                category: {
                                    type: "string",
                                    enum: ["technical", "integration", "resource", "timeline", "requirement_clarity"],
                                    description: "Risk category"
                                },
                                level: {
                                    type: "string",
                                    enum: ["low", "medium", "high"],
                                    description: "Risk level"
                                },
                                description: {
                                    type: "string",
                                    description: "Description of the risk"
                                },
                                mitigation: {
                                    type: "string",
                                    description: "Suggested mitigation strategy"
                                }
                            },
                            required: ["category", "level", "description", "mitigation"],
                            additionalProperties: false
                        }
                    },
                    overallAssessment: {
                        type: "string",
                        enum: ["approved", "needs_review", "concerns"],
                        description: "Overall assessment of the estimation quality"
                    },
                    estimatedConfidence: {
                        type: "number",
                        description: "Confidence score 0-100 for the estimation accuracy"
                    }
                },
                required: ["implementationTips", "discrepancies", "riskAnalysis", "overallAssessment", "estimatedConfidence"],
                additionalProperties: false
            }
        }
    };
}

/**
 * Build system prompt for senior consultant
 */
function buildSystemPrompt(): string {
    return `You are an experienced Senior Technical Consultant with 20+ years of enterprise software development experience. Your role is to review requirement estimations and provide critical, actionable feedback.

EXPERTISE AREAS:
- Enterprise architecture patterns
- Agile estimation best practices
- Risk identification and mitigation
- Technical debt prevention
- Integration complexity assessment

OUTPUT REQUIREMENTS:

1. IMPLEMENTATION TIPS (Markdown):
   - Provide a structured overview with clear headers
   - Include specific technical recommendations
   - Reference relevant patterns or best practices
   - Suggest integration approaches
   - Use Italian language for the content

2. DISCREPANCIES:
   - Identify gaps between requirement description and selected activities
   - Flag over-engineering concerns
   - Highlight missing test or operational activities
   - Note driver configuration issues

3. RISK ANALYSIS:
   - Assess technical complexity risks
   - Evaluate integration challenges
   - Consider resource availability
   - Analyze timeline feasibility
   - Rate requirement clarity

4. OVERALL ASSESSMENT:
   - "approved": Estimation is solid, proceed with confidence
   - "needs_review": Some concerns that should be addressed
   - "concerns": Significant issues that require attention before proceeding

5. CONFIDENCE SCORE:
   - 80-100: High confidence, well-defined requirement
   - 60-79: Moderate confidence, some ambiguity
   - 40-59: Low confidence, needs clarification
   - 0-39: Very low confidence, requirement too vague

Be critical but constructive. Focus on actionable insights.
Respond in Italian for all text fields.`;
}

/**
 * Build user prompt with requirement context
 */
function buildUserPrompt(request: ConsultantAnalysisRequest): string {
    const activitiesStr = request.activities.map(a =>
        `- ${a.code}: ${a.name} (${a.base_hours}h, ${a.group})\n  ${a.description}`
    ).join('\n');

    const driversStr = request.drivers.map(d =>
        `- ${d.name}: ${d.selectedValue} (×${d.multiplier})`
    ).join('\n');

    return `CONTESTO PROGETTO:
Nome: ${request.projectContext.name}
Descrizione: ${request.projectContext.description}
${request.projectContext.owner ? `Responsabile: ${request.projectContext.owner}` : ''}

TECNOLOGIA: ${request.technologyName} (${request.technologyCategory})

REQUISITO DA ANALIZZARE:
Titolo: ${request.requirementTitle}
Descrizione:
${request.requirementDescription}

ATTIVITÀ SELEZIONATE (${request.activities.length}):
${activitiesStr}

DRIVER CONFIGURATI:
${driversStr}

Analizza questa stima come un Senior Consultant critico. Identifica:
1. Se le attività coprono adeguatamente il requisito
2. Se ci sono lacune o sovrastime
3. Rischi tecnici e di implementazione
4. Suggerimenti architetturali specifici`;
}

/**
 * Analyze estimation as a Senior Consultant
 */
export async function analyzeEstimation(
    request: ConsultantAnalysisRequest
): Promise<SeniorConsultantAnalysis> {
    // Sanitize all text inputs
    const sanitizedRequest: ConsultantAnalysisRequest = {
        ...request,
        requirementTitle: sanitizePromptInput(request.requirementTitle),
        requirementDescription: sanitizePromptInput(request.requirementDescription),
        projectContext: {
            ...request.projectContext,
            name: sanitizePromptInput(request.projectContext.name),
            description: sanitizePromptInput(request.projectContext.description),
            owner: request.projectContext.owner ? sanitizePromptInput(request.projectContext.owner) : undefined,
        },
        activities: request.activities.map(a => ({
            ...a,
            name: sanitizePromptInput(a.name),
            description: sanitizePromptInput(a.description || ''),
        })),
        drivers: request.drivers.map(d => ({
            ...d,
            name: sanitizePromptInput(d.name),
        })),
    };

    console.log('[consultant-analysis] Starting analysis for:', sanitizedRequest.requirementTitle);
    console.log('[consultant-analysis] Activities:', sanitizedRequest.activities.length);
    console.log('[consultant-analysis] Drivers:', sanitizedRequest.drivers.length);

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(sanitizedRequest);
    const responseSchema = createConsultantSchema();

    const provider = getDefaultProvider();
    const responseFormatItem = createConsultantSchema();

    let parsedContent: string;
    try {
        parsedContent = await provider.generateContent({
            model: 'gpt-4o',
            systemPrompt: systemPrompt,
            userPrompt: userPrompt,
            temperature: 0.0,
            maxTokens: 4000,
            options: LLM_PRESETS.complex,
            responseFormat: responseFormatItem as any
        });
    } catch (error) {
        console.error('[consultant-analysis] Generation error:', error);
        throw new Error('Failed to generate response from LLM');
    }

    console.log('[consultant-analysis] AI response received');

    // Parse and validate response
    let rawResponse: unknown;
    try {
        rawResponse = JSON.parse(parsedContent);
    } catch (parseError) {
        console.error('[consultant-analysis] JSON parse error:', parseError);
        throw new Error('Invalid JSON response from AI');
    }

    // Validate with Zod
    const validated = ConsultantResponseSchema.parse(rawResponse);

    console.log('[consultant-analysis] Analysis complete, confidence:', validated.estimatedConfidence);

    return {
        implementationTips: validated.implementationTips,
        discrepancies: validated.discrepancies,
        riskAnalysis: validated.riskAnalysis,
        overallAssessment: validated.overallAssessment,
        estimatedConfidence: validated.estimatedConfidence,
        generatedAt: new Date().toISOString(),
    };
}
