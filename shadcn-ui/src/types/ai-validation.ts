import { z } from 'zod';

// Re-export PipelineActivity from the canonical shared schema
// This ensures a single source of truth for both frontend and backend
export type { PipelineActivity } from '@/shared/validation/pipeline-activity.schema';
export { PipelineActivitySchema } from '@/shared/validation/pipeline-activity.schema';
import type { PipelineActivity } from '@/shared/validation/pipeline-activity.schema';

/**
 * Schema di validazione per le risposte AI
 * Protegge da injection attacks e dati malformati
 */
export const AIActivitySuggestionSchema = z.object({
    isValidRequirement: z
        .boolean()
        .describe('Whether the requirement description is valid and makes sense'),

    activityCodes: z
        .array(z.string().regex(/^[A-Z0-9_]{3,50}$/, 'Invalid activity code format'))
        .max(50, 'Too many activities suggested'),
    // Allow empty array when GPT can't suggest activities (e.g., description too short)

    reasoning: z
        .string()
        .max(2000, 'Reasoning too long')
        .optional()
});

export type ValidatedAISuggestion = z.infer<typeof AIActivitySuggestionSchema>;

/**
 * Valida e sanitizza una suggestion AI contro i dati master disponibili
 */
export function validateAISuggestion(
    rawData: unknown,
    availableActivityCodes: string[],
    availableDriverCodes: string[],
    availableRiskCodes: string[]
): ValidatedAISuggestion {
    // Step 1: Validate schema structure
    const parsed = AIActivitySuggestionSchema.parse(rawData);

    // Step 2: Cross-validate against available master data
    const validActivityCodes = parsed.activityCodes.filter(code =>
        availableActivityCodes.includes(code)
    );

    // Allow empty array - GPT may legitimately suggest no activities
    // for invalid/insufficient requirements

    // Step 3: Return validated and sanitized data (only activity codes)
    return {
        isValidRequirement: parsed.isValidRequirement,
        activityCodes: validActivityCodes,
        reasoning: parsed.reasoning?.trim()
    };
}

/**
 * Sanitizza input per prevenire injection attacks
 */
export function sanitizePromptInput(text: string): string {
    return text
        .replace(/[<>]/g, '')           // Remove HTML-like tags
        .replace(/[{}]/g, '')            // Remove JSON delimiters
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
        .slice(0, 5000)                  // Limit length
        .trim();
}

/**
 * Schema per validazione generazione titolo
 */
export const AITitleGenerationSchema = z.object({
    title: z
        .string()
        .min(5, 'Title too short')
        .max(200, 'Title too long')
        .refine(
            (title) => title.split(' ').length <= 20,
            'Title should not exceed 20 words'
        )
});

export type ValidatedAITitle = z.infer<typeof AITitleGenerationSchema>;

/**
 * Valida titolo generato da AI
 */
export function validateAITitle(rawData: unknown): ValidatedAITitle {
    return AITitleGenerationSchema.parse(rawData);
}

// ─────────────────────────────────────────────────────────────────────────────
// Requirement Validation Gate
// ─────────────────────────────────────────────────────────────────────────────

export type RequirementValidationCategory =
    | 'valid'
    | 'nonsense'
    | 'too_vague'
    | 'not_software'
    | 'off_topic';

export const RequirementValidationSchema = z.object({
    isValid: z.boolean(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(500),
    category: z.enum(['valid', 'nonsense', 'too_vague', 'not_software', 'off_topic']),
    suggestions: z.array(z.string().max(200)).max(3).optional(),
});

export type RequirementValidationResult = z.infer<typeof RequirementValidationSchema>;

/**
 * Client-side heuristic pre-check (Layer 1, zero cost).
 * Returns a validation result if the input clearly fails, or null if it passes.
 */
export function heuristicRequirementCheck(text: string): RequirementValidationResult | null {
    const trimmed = text.trim();

    if (trimmed.length < 30) {
        return {
            isValid: false,
            confidence: 1.0,
            reason: 'La descrizione è troppo breve per essere un requisito software (minimo 30 caratteri).',
            category: 'too_vague',
            suggestions: ['Descrivi cosa deve fare il sistema, per chi, e quali vincoli ha.'],
        };
    }

    const words = trimmed.split(/\s+/).filter(w => w.length > 1);
    if (words.length < 3) {
        return {
            isValid: false,
            confidence: 1.0,
            reason: 'Il testo contiene troppo poche parole per descrivere un requisito.',
            category: 'too_vague',
            suggestions: ['Scrivi almeno una frase completa che descriva la funzionalità desiderata.'],
        };
    }

    // Check if all words are the same (e.g. "test test test test test")
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1) {
        return {
            isValid: false,
            confidence: 1.0,
            reason: 'Il testo sembra un test — contiene solo la stessa parola ripetuta.',
            category: 'nonsense',
        };
    }

    // Check if only numbers/symbols
    if (/^[\d\s\W]+$/.test(trimmed)) {
        return {
            isValid: false,
            confidence: 1.0,
            reason: 'Il testo contiene solo numeri o simboli, non un requisito software.',
            category: 'nonsense',
        };
    }

    return null; // passes heuristic — proceed to AI check
}

/**
 * Completeness score for an activity
 */
export interface CompletenessScore {
    coherence: number;    // 0.0-1.0: alignment with project
    depth: number;        // 0.0-1.0: detail level
    actionable: number;   // 0.0-1.0: has acceptance criteria
    completeness: number; // 0.0-1.0: weighted average
}

/**
 * Split a task that exceeds MAX_HOURS into smaller atomic subtasks
 * 
 * @param activity - Activity to split
 * @param maxHours - Maximum hours per activity (default 8)
 * @returns Array of split activities with distributed hours
 */
export function splitTask(
    activity: PipelineActivity,
    maxHours: number = 8
): PipelineActivity[] {
    // If activity is within limits, return as-is
    if (activity.estimatedHours <= maxHours) {
        return [activity];
    }

    // Calculate number of splits needed
    const numSplits = Math.ceil(activity.estimatedHours / maxHours);

    // Subtask templates based on group
    const templates: Record<string, string[]> = {
        DEV: [
            'Database schema and models',
            'API endpoint implementation',
            'Service layer logic',
            'UI component development',
            'Integration and testing'
        ],
        TEST: [
            'Unit test setup',
            'Integration test implementation',
            'E2E test scenarios',
            'Test data fixtures'
        ],
        ANALYSIS: [
            'Requirements gathering',
            'Technical specification',
            'Architecture design',
            'Risk assessment'
        ],
        OPS: [
            'Infrastructure setup',
            'CI/CD configuration',
            'Monitoring and logging',
            'Deployment automation'
        ],
        GOVERNANCE: [
            'Documentation creation',
            'Code review process',
            'Compliance checks',
            'Security audit'
        ]
    };

    const subtaskTemplates = templates[activity.group] || templates.DEV;

    // Distribute hours evenly across splits
    const baseHours = Math.floor(activity.estimatedHours / numSplits);
    const remainder = activity.estimatedHours % numSplits;

    const result: PipelineActivity[] = [];

    for (let i = 0; i < numSplits; i++) {
        const hours = baseHours + (i === numSplits - 1 ? remainder : 0);

        // Use template if available, otherwise append "Part N"
        const subtitle = i < subtaskTemplates.length
            ? subtaskTemplates[i]
            : `Part ${i + 1}`;

        result.push({
            ...activity,
            title: `${activity.title} - ${subtitle}`,
            estimatedHours: Math.min(hours, maxHours),
            description: activity.description
                ? `${activity.description} (Split ${i + 1}/${numSplits})`
                : undefined,
            confidence: activity.confidence ? activity.confidence * 0.9 : undefined // Reduce confidence for splits
        });
    }

    return result;
}

/**
 * Simple text embedding placeholder (cosine similarity of word vectors)
 * Replace with proper embedding model (OpenAI, Cohere, local) in production
 * 
 * @param text - Text to encode
 * @returns Simple word frequency vector (normalized)
 */
export function encodeText(text: string): number[] {
    // Tokenize and normalize
    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);

    // Create frequency map
    const freq: Record<string, number> = {};
    words.forEach(word => {
        freq[word] = (freq[word] || 0) + 1;
    });

    // Get top 100 words as features
    const sortedWords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    const vector = sortedWords.map(([, count]) => count);

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const minLen = Math.min(vecA.length, vecB.length);
    if (minLen === 0) return 0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < minLen; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Calculate completeness score for a preset activity
 * 
 * @param activity - Activity to score
 * @param projectDescription - Overall project description for coherence check
 * @returns Completeness score breakdown
 */
export function calculateCompletenessScore(
    activity: PipelineActivity,
    projectDescription: string
): CompletenessScore {
    // 1. Coherence: How well activity aligns with project
    const projectVec = encodeText(projectDescription);
    const activityVec = encodeText(activity.description || activity.title);
    const coherence = cosineSimilarity(activityVec, projectVec);

    // 2. Depth: Level of detail in description
    let depth = 0;
    if (activity.description) {
        const bulletPoints = (activity.description.match(/[-•]/g) || []).length;
        depth = Math.min(bulletPoints / 5, 1); // 5+ bullets = max depth
    }

    // Boost depth if technical details present
    if (activity.technicalDetails) {
        const hasFiles = (activity.technicalDetails.suggestedFiles?.length || 0) > 0;
        const hasCommands = (activity.technicalDetails.suggestedCommands?.length || 0) > 0;
        const hasDeps = (activity.technicalDetails.dependencies?.length || 0) > 0;
        depth = Math.min(depth + (hasFiles ? 0.2 : 0) + (hasCommands ? 0.2 : 0) + (hasDeps ? 0.1 : 0), 1);
    }

    // 3. Actionable: Has clear acceptance criteria
    const actionable = (activity.acceptanceCriteria && activity.acceptanceCriteria.length >= 3) ? 1 : 0;

    // 4. Completeness: Weighted formula
    const completeness = 0.5 * coherence + 0.3 * depth + 0.2 * actionable;

    return {
        coherence,
        depth,
        actionable,
        completeness
    };
}

/**
 * Post-process and score a preset with multiple activities
 * 
 * @param preset - Preset with activities to score
 * @param projectDescription - Project description for coherence
 * @returns Preset with scores and average completeness
 */
export function postProcessAndScore(
    preset: { activities: PipelineActivity[] },
    projectDescription: string
): {
    activities: (PipelineActivity & { score: CompletenessScore })[];
    averageCompleteness: number;
} {
    const scoredActivities = preset.activities.map(activity => ({
        ...activity,
        score: calculateCompletenessScore(activity, projectDescription)
    }));

    const averageCompleteness =
        scoredActivities.reduce((sum, a) => sum + a.score.completeness, 0) /
        (scoredActivities.length || 1);

    return {
        activities: scoredActivities,
        averageCompleteness
    };
}
