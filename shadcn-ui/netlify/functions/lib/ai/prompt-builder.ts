export interface Activity {
    code: string;
    name: string;
    description: string;
    base_days: number;
    group: string;
    tech_category: string;
}

export interface Driver {
    code: string;
    options?: Array<{ multiplier: number }>;
}

export interface Risk {
    code: string;
    weight: number;
}

/**
 * Create descriptive prompt with full activity details
 * This provides GPT with complete context to make accurate suggestions
 * @param activities - Array of activities
 * @returns Formatted string with activity details
 */
export function createDescriptivePrompt(activities: Activity[]): string {
    // Format: CODE: Name | Description | Effort | Group
    const activitiesStr = activities.map(a =>
        `CODE: ${a.code}\n` +
        `NAME: ${a.name}\n` +
        `DESCRIPTION: ${a.description}\n` +
        `EFFORT: ${a.base_days} days | GROUP: ${a.group}\n` +
        `---`
    ).join('\n\n');

    return `AVAILABLE ACTIVITIES:\n\n${activitiesStr}`;
}

/**
 * Create JSON schema with strict validation for structured outputs
 * This ensures GPT can ONLY return valid activity codes (no invented codes possible)
 * @param validActivityCodes - Array of valid activity codes
 * @returns JSON schema object for OpenAI structured outputs
 */
export function createActivitySchema(validActivityCodes: string[]) {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "activity_suggestion_response",
            strict: true,  // CRITICAL: Enforces strict schema adherence by OpenAI
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: {
                        type: "boolean",
                        description: "Whether the requirement description is valid and estimable"
                    },
                    activityCodes: {
                        type: "array",
                        description: "Array of relevant activity codes for this requirement",
                        items: {
                            type: "string",
                            enum: validActivityCodes  //  GPT can ONLY return codes from this list
                        }
                    },
                    reasoning: {
                        type: "string",
                        description: "Brief explanation of the activity selection (max 500 characters)"
                    }
                },
                required: ["isValidRequirement", "activityCodes", "reasoning"],
                additionalProperties: false  //  No extra fields allowed
            }
        }
    };
}

/**
 * Create normalization JSON schema for structured outputs
 * @returns JSON schema object for requirement normalization
 */
export function createNormalizationSchema() {
    return {
        type: "json_schema" as const,
        json_schema: {
            name: "normalization_response",
            strict: true,
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: { type: "boolean" },
                    confidence: { type: "number" },
                    originalDescription: { type: "string" },
                    normalizedDescription: { type: "string" },
                    validationIssues: {
                        type: "array",
                        items: { type: "string" }
                    },
                    transformNotes: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["isValidRequirement", "confidence", "originalDescription", "normalizedDescription", "validationIssues", "transformNotes"],
                additionalProperties: false
            }
        }
    };
}

/**
 * Create system prompt for activity suggestions
 * @param presetName - Preset name
 * @param techCategory - Technology category
 * @param descriptiveData - Formatted activity data
 * @returns System prompt string
 */
export function createActivitySuggestionSystemPrompt(
    presetName: string,
    techCategory: string,
    descriptiveData: string
): string {
    return `You are an expert software estimation assistant for ${presetName} (${techCategory}).

DESCRIPTION FORMAT (READ CAREFULLY):
- The requirement description may include bullet lines formatted as "- ColumnName: value" coming from Excel column names selected by the user.
- Treat the column names as signals of the data type/context (e.g., "Feature", "Problem", "Goal", "AcceptanceCriteria").
- Consider every labeled line; do NOT drop or ignore any labeled segment when evaluating scope.

STEP 1: Validate the requirement description.
- If it is invalid or unclear, set isValidRequirement to false, return activityCodes as an empty array, and explain why in reasoning.
- Invalid means: too vague, placeholder/test text, no action verb, no clear technical target (API, form, table, workflow, report, page, endpoint, etc.), gibberish.
- SPECIAL CASE: If the description is a QUESTION or a DOUBT (e.g., ends with "?", "Check if...", "Verify..."), treat it as a VALID requirement that needs ANALYSIS. Do NOT reject it. Instead, suggest ANALYSIS activities to resolve the doubt.

STEP 2: When valid, suggest ONLY the relevant activity codes needed to implement it.

IMPORTANT CONSTRAINTS:
- You suggest ONLY activity codes (you NEVER suggest drivers or risks)
- Drivers and risks will be selected manually by the user
- Return JSON with: isValidRequirement (boolean), activityCodes (array of strings), reasoning (string)
- Activity codes MUST be from the available list below

VALIDATION RULES:

ACCEPT if requirement describes:
- Feature additions or modifications (even if brief)
- UI/UX changes or updates
- Data model changes, field additions
- Workflow or process modifications
- Bug fixes or improvements
- Integration or API work
- Documentation or configuration changes
- ANY action verb + technical context (update, add, modify, create, fix, change, implement)
- Questions, doubts, or requests for verification (Treat as ANALYSIS tasks)

REJECT only if:
- Extremely vague with no technical context (e.g., "make it better", "fix things")
- Pure test input (e.g., "test", "aaa", "123", "qwerty")
- No action or technical element
- Random characters or gibberish

EXAMPLES:
"Aggiornare la lettera con aggiunta frase" -> accept (action: aggiornare, target: lettera)
"Add field to profile" -> accept (action: add, target: field)
"Is this feasible?" -> accept (needs analysis)
"Check if API exists" -> accept (needs analysis)
"Make better" -> reject (no specific target or action)
"test" -> reject (test input)

${descriptiveData}

SELECTION GUIDELINES:
- Read the activity DESCRIPTION carefully to understand when to use it
- Consider the EFFORT (base days) to ensure realistic coverage
- Select activities from appropriate GROUP (ANALYSIS, DEV, TEST, OPS, GOVERNANCE)
- Choose activities that match the requirement's scope and complexity
- Include typical SDLC activities: analysis -> development -> testing -> deployment

RETURN FORMAT:
{"isValidRequirement": true/false, "activityCodes": ["CODE1", "CODE2", ...], "reasoning": "brief explanation of your selection"}`;
}

/**
 * Create system prompt for requirement normalization
 * @returns System prompt string
 */
export function createNormalizationSystemPrompt(): string {
    return `You are an expert Business Analyst. Your goal is to normalize and validate a requirement description.

INPUT: A raw requirement description (which may be messy, vague, or structured as key-value pairs from Excel).

OUTPUT: A structured JSON object with the following fields:
- isValidRequirement: boolean (true if it's a valid technical requirement, false if gibberish/test/question)
- confidence: number (0.0 to 1.0, how confident you are in the interpretation)
- originalDescription: string (the input text)
- normalizedDescription: string (a clear, professional, concise rewrite of the requirement. CRITICAL: Keep the SAME LANGUAGE as the input. DO NOT translate to English or other languages. DO NOT invent new details. DO NOT add systems/APIs not mentioned. Merge scattered info into a cohesive paragraph.)
- validationIssues: array of strings (list of missing info, ambiguities, or contradictions. If none, empty array.)
- transformNotes: array of strings (brief notes on what you changed/interpreted, e.g., "Merged 'Notes' column into description", "Clarified user role")

RULES:
1. DO NOT translate the text. Keep the original language (Italian, English, etc.).
2. DO NOT invent new constraints, numbers, or systems.
3. If the input is vague, mark it in validationIssues, don't guess.
4. Keep the normalizedDescription technical but readable.
5. If the input is just a title, expand it slightly into a sentence if possible, but don't hallucinate.`;
}

/**
 * Legacy compact function (kept for reference - can be removed later)
 * @param activities - Array of activities
 * @param drivers - Array of drivers
 * @param risks - Array of risks
 * @returns Compact prompt string
 */
export function createCompactPrompt(activities: Activity[], drivers: Driver[], risks: Risk[]): string {
    const activitiesStr = activities.map(a => `${a.code}(${a.base_days}d,${a.group})`).join(', ');
    const driversStr = drivers.map(d => {
        if (!d.options || !Array.isArray(d.options) || d.options.length === 0) {
            return `${d.code}(1.0)`;
        }
        const multipliers = d.options.map((o: any) => o.multiplier).filter((m: any) => typeof m === 'number');
        if (multipliers.length === 0) {
            return `${d.code}(1.0)`;
        }
        const minMax = `${Math.min(...multipliers)}-${Math.max(...multipliers)}`;
        return `${d.code}(${minMax})`;
    }).join(', ');
    const risksStr = risks.map(r => `${r.code}(${r.weight})`).join(', ');

    return `Activities: ${activitiesStr}\nDrivers: ${driversStr}\nRisks: ${risksStr}`;
}
