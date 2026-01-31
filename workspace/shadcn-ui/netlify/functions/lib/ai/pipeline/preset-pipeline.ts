/**
 * AI Preset Generation Pipeline
 * 
 * Implements skeleton → expand → validate workflow:
 * 1. Skeleton pass (temp=0.0): Generate minimal activity structure
 * 2. Expand pass (temp=0.6): Add detailed descriptions and technical details
 * 3. Post-process: Score completeness, split oversized tasks, validate
 * 4. Cache results in Redis for idempotency
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';
import {
    PipelineActivity,
    postProcessAndScore,
    splitTask,
    sanitizePromptInput
} from '../../../../../src/types/ai-validation';
import {
    PresetOutput,
    validatePreset,
    FALLBACK_PRESET
} from '../validation/preset-schema';

// Feature flags from environment
const AI_ENABLED = process.env.AI_ENABLED !== 'false';
const AI_ENSEMBLE = process.env.AI_ENSEMBLE !== 'false';
const AI_MAX_HOURS = Number(process.env.AI_MAX_HOURS || 8);
const AI_COMPLETENESS_THRESHOLD = Number(process.env.AI_COMPLETENESS_THRESHOLD || 0.65);
const AI_MIN_ACTIVITIES = Number(process.env.AI_MIN_ACTIVITIES || 5);
const AI_MAX_ACTIVITIES = Number(process.env.AI_MAX_ACTIVITIES || 20);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL_DAYS = 7;

// Redis client
let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
async function getRedisClient(): Promise<RedisClientType> {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    redisClient = createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => {
                if (retries > 3) return new Error('Redis connection failed');
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on('error', (err) => {
        console.error('[pipeline] Redis error:', err);
    });

    await redisClient.connect();
    return redisClient;
}

/**
 * Embedded system prompts (instead of loading from files for serverless compatibility)
 */
const SKELETON_PROMPT = `You are a Technical Estimator generating a skeleton structure for a software project estimation preset.

Your task: Generate ONLY the minimal activity structure (skeleton) without detailed descriptions.

**IMPORTANT**: Respond with valid JSON only.

**OUTPUT REQUIREMENTS**:
1. Generate 8-15 activities
2. Each activity must have ONLY:
   - title: Short descriptive name (40-80 chars)
   - group: One of [ANALYSIS, DEV, TEST, OPS, GOVERNANCE]
   - estimatedHours: Integer between 2-8 hours
   - priority: One of [core, recommended, optional]

**ACTIVITY GRANULARITY**:
- Each activity must be atomic (completable in one work session)
- Break large tasks into smaller implementation units
- Estimations must be realistic (include testing, debugging, code review)

**DO NOT INCLUDE**:
- Detailed descriptions
- Acceptance criteria
- Technical implementation details
- Dependencies
- Files/commands/tests

**ESTIMATION GUIDELINES**:
- Simple tasks (configuration, basic setup): 2-3h
- Medium tasks (single component, endpoint): 4-6h
- Complex tasks (integration, advanced logic): 7-8h
- NEVER exceed 8 hours per activity

**EXAMPLE OUTPUT**:
{
  "success": true,
  "activities": [
    {
      "title": "Set up PostgreSQL database schema",
      "group": "DEV",
      "estimatedHours": 4,
      "priority": "core"
    },
    {
      "title": "Create REST API endpoints for CRUD operations",
      "group": "DEV",
      "estimatedHours": 6,
      "priority": "core"
    }
  ]
}`;

const EXPAND_PROMPT = `You are a Technical Architect expanding skeleton activities into detailed, actionable implementation tasks.

Your task: Take the skeleton activities and enrich them with comprehensive technical details.

**IMPORTANT**: Respond with valid JSON only.

**INPUT**: You will receive:
1. Skeleton activities (title, group, estimatedHours, priority)
2. Project description and user answers
3. Technology context

**OUTPUT REQUIREMENTS**:
For each skeleton activity, add:
1. **description**: Detailed technical implementation (150-300 words)
   - Specific libraries, frameworks, tools to use
   - Architecture patterns and design decisions
   - Integration points and data flow
   - Error handling and edge cases
   
2. **acceptanceCriteria**: 3-5 bullet points defining "done"
   - Measurable outcomes
   - Quality gates
   - Test coverage expectations
   
3. **technicalDetails**: 
   - suggestedFiles: Array of file paths to create/modify
   - suggestedCommands: Array of CLI commands to run
   - suggestedTests: Array of test descriptions
   - dependencies: Array of package/library names

4. **estimatedHoursJustification**: Brief explanation of time estimate

**QUALITY REQUIREMENTS**:
- Description must be actionable (developer can start immediately)
- Include at least 3 specific technical details (library names, patterns, tools)
- Acceptance criteria must be verifiable
- Technical details must be project-specific (not generic)

**DEPTH GUIDELINES**:
- Minimum 3 bullet points in acceptanceCriteria
- Minimum 2 suggestedFiles per activity
- Minimum 2 suggestedCommands per activity
- Minimum 2 dependencies per activity
- Description should reference specific versions when critical (e.g., "PostgreSQL 15", "React 18")`;

/**
 * Load system prompts (now returns embedded prompts)
 */
function loadPrompt(filename: string): string {
    if (filename === 'skeleton.system') {
        return SKELETON_PROMPT;
    }
    if (filename === 'expand.system') {
        return EXPAND_PROMPT;
    }
    throw new Error(`Unknown prompt: ${filename}`);
}

/**
 * Calculate SHA256 hash for caching
 */
function calculateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * Structured logging helper
 */
function logStructured(level: 'info' | 'warn' | 'error', event: string, data: Record<string, any>) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        ...data
    }));
}

/**
 * Metrics counters (simple in-memory, replace with proper metrics service)
 */
const metrics = {
    preset_generation_attempts_total: 0,
    preset_generation_success_total: 0,
    preset_generation_fallback_total: 0,
    preset_cache_hits_total: 0
};

export function getMetrics() {
    return { ...metrics };
}

/**
 * Input for preset generation pipeline
 */
export interface PipelineInput {
    userId: string;
    description: string;
    answers: Record<string, any>;
    category?: 'FRONTEND' | 'BACKEND' | 'MULTI';
    requestId: string;
}

/**
 * Output from preset generation pipeline
 */
export interface PipelineOutput {
    success: boolean;
    preset?: PresetOutput;
    error?: string;
    metadata: {
        requestId: string;
        userId: string;
        generationTimeMs: number;
        cached: boolean;
        attempts: number;
        modelPasses: string[];
        promptHashes: string[];
        averageCompleteness?: number;
        validationErrors?: string[];
    };
}

/**
 * Skeleton generation (minimal structure)
 */
async function generateSkeleton(
    openaiClient: OpenAI,
    enrichedPrompt: string
): Promise<{ activities: PipelineActivity[] }> {
    const systemPrompt = loadPrompt('skeleton.system');

    const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.0, // Maximum determinism
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: enrichedPrompt }
        ],
        response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No skeleton response from OpenAI');
    }

    const parsed = JSON.parse(content);
    if (!parsed.success || !parsed.activities) {
        throw new Error('Invalid skeleton response structure');
    }

    return { activities: parsed.activities };
}

/**
 * Expand skeleton into full preset
 */
async function expandSkeleton(
    openaiClient: OpenAI,
    skeleton: { activities: PipelineActivity[] },
    enrichedPrompt: string,
    temperature: number = 0.6
): Promise<PresetOutput> {
    const systemPrompt = loadPrompt('expand.system');

    const userPrompt = `
PROJECT CONTEXT:
${enrichedPrompt}

SKELETON ACTIVITIES TO EXPAND:
${JSON.stringify(skeleton.activities, null, 2)}

Expand each skeleton activity with detailed descriptions, acceptance criteria, and technical details.
`;

    const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No expand response from OpenAI');
    }

    const parsed = JSON.parse(content);
    if (!parsed.success || !parsed.activities) {
        throw new Error('Invalid expand response structure');
    }

    // Convert to full preset structure
    return {
        name: parsed.name || 'Generated Preset',
        description: parsed.description || 'AI-generated technology preset',
        detailedDescription: parsed.detailedDescription || parsed.description || 'Generated preset',
        techCategory: parsed.techCategory || 'MULTI',
        activities: parsed.activities,
        driverValues: parsed.driverValues || { complexity: 5, quality: 6, team: 5 },
        riskCodes: parsed.riskCodes || [],
        reasoning: parsed.reasoning || 'AI-generated preset based on project description',
        confidence: parsed.confidence || 0.75
    };
}

/**
 * Post-process preset: score, split, validate
 */
function postProcessPreset(
    preset: PresetOutput,
    projectDescription: string
): { preset: PresetOutput; averageCompleteness: number } {
    // 1. Score completeness
    const scored = postProcessAndScore({ activities: preset.activities }, projectDescription);

    // 2. Split oversized tasks
    const splitActivities: PipelineActivity[] = [];
    for (const activity of scored.activities) {
        if (activity.estimatedHours > AI_MAX_HOURS) {
            const splits = splitTask(activity, AI_MAX_HOURS);
            splitActivities.push(...splits);
        } else {
            splitActivities.push(activity);
        }
    }

    // 3. Remove score metadata for final output (if present)
    const cleanActivities = splitActivities.map((activity: any) => {
        const { score, ...cleanActivity } = activity;
        return cleanActivity as PipelineActivity;
    });

    return {
        preset: {
            ...preset,
            activities: cleanActivities
        },
        averageCompleteness: scored.averageCompleteness
    };
}

/**
 * Main preset generation pipeline
 */
export async function generatePresetPipeline(
    input: PipelineInput,
    openaiClient: OpenAI
): Promise<PipelineOutput> {
    const startTime = Date.now();
    metrics.preset_generation_attempts_total++;

    const metadata: PipelineOutput['metadata'] = {
        requestId: input.requestId,
        userId: input.userId,
        generationTimeMs: 0,
        cached: false,
        attempts: 0,
        modelPasses: [] as string[],
        promptHashes: [] as string[],
        averageCompleteness: undefined,
        validationErrors: undefined
    };

    try {
        // 1. Sanitize inputs
        const sanitizedDescription = sanitizePromptInput(input.description);
        const enrichedPrompt = `
PROJECT DESCRIPTION:
${sanitizedDescription}

USER ANSWERS:
${JSON.stringify(input.answers, null, 2)}

TECHNOLOGY CATEGORY: ${input.category || 'MULTI'}
`;

        // 2. Calculate cache key
        const promptHash = calculateHash(enrichedPrompt);
        const cacheKey = `processed:preset:${promptHash}`;
        metadata.promptHashes.push(promptHash);

        logStructured('info', 'pipeline_start', {
            requestId: input.requestId,
            userId: input.userId,
            promptHash,
            aiEnabled: AI_ENABLED,
            ensembleEnabled: AI_ENSEMBLE
        });

        // 3. Check cache (Redis)
        try {
            const redis = await getRedisClient();
            const cached = await redis.get(cacheKey);
            if (cached) {
                metrics.preset_cache_hits_total++;
                metadata.cached = true;
                metadata.generationTimeMs = Date.now() - startTime;

                logStructured('info', 'cache_hit', { requestId: input.requestId, promptHash });

                return {
                    success: true,
                    preset: JSON.parse(cached),
                    metadata
                };
            }
        } catch (err) {
            logStructured('warn', 'cache_check_failed', { requestId: input.requestId, error: String(err) });
        }

        // 4. If AI disabled, return fallback
        if (!AI_ENABLED) {
            logStructured('info', 'ai_disabled_fallback', { requestId: input.requestId });
            metrics.preset_generation_fallback_total++;
            metadata.generationTimeMs = Date.now() - startTime;

            return {
                success: true,
                preset: FALLBACK_PRESET,
                metadata
            };
        }

        let preset: PresetOutput | undefined;
        let averageCompleteness = 0;

        // 5. Generate preset (ensemble or direct)
        if (AI_ENSEMBLE) {
            // Two-stage pipeline
            metadata.modelPasses.push('skeleton');
            const skeleton = await generateSkeleton(openaiClient, enrichedPrompt);

            logStructured('info', 'skeleton_generated', {
                requestId: input.requestId,
                activityCount: skeleton.activities.length
            });

            // Expand with retries for low completeness
            let expandAttempts = 0;
            let temperature = 0.6;

            while (expandAttempts < 2) {
                expandAttempts++;
                metadata.attempts = expandAttempts;
                metadata.modelPasses.push(`expand_temp${temperature}`);

                preset = await expandSkeleton(openaiClient, skeleton, enrichedPrompt, temperature);

                // Post-process and score
                const processed = postProcessPreset(preset, sanitizedDescription);
                preset = processed.preset;
                averageCompleteness = processed.averageCompleteness;

                logStructured('info', 'expand_completed', {
                    requestId: input.requestId,
                    attempt: expandAttempts,
                    averageCompleteness,
                    threshold: AI_COMPLETENESS_THRESHOLD
                });

                if (averageCompleteness >= AI_COMPLETENESS_THRESHOLD) {
                    break;
                }

                // Retry with higher temperature for more detail
                temperature = 0.8;
            }

            // If still below threshold, use fallback
            if (averageCompleteness < AI_COMPLETENESS_THRESHOLD) {
                logStructured('warn', 'completeness_threshold_failed', {
                    requestId: input.requestId,
                    averageCompleteness,
                    threshold: AI_COMPLETENESS_THRESHOLD
                });
                preset = FALLBACK_PRESET;
                metrics.preset_generation_fallback_total++;
            }
        } else {
            // Direct generation (legacy mode)
            metadata.modelPasses.push('direct');
            preset = await expandSkeleton(
                openaiClient,
                { activities: [] },
                enrichedPrompt,
                0.6
            );

            const processed = postProcessPreset(preset, sanitizedDescription);
            preset = processed.preset;
            averageCompleteness = processed.averageCompleteness;
        }

        // 6. Validate with AJV (ensure preset is defined)
        if (!preset) {
            throw new Error('Preset generation failed: no preset generated');
        }

        const valid = validatePreset(preset);
        if (!valid) {
            const errors = validatePreset.errors?.map(e => `${e.instancePath}: ${e.message}`) || [];
            logStructured('error', 'validation_failed', {
                requestId: input.requestId,
                errors
            });

            metadata.validationErrors = errors;
            preset = FALLBACK_PRESET;
            metrics.preset_generation_fallback_total++;
        }

        // 7. Final validation checks
        if (preset.activities.length < AI_MIN_ACTIVITIES || preset.activities.length > AI_MAX_ACTIVITIES) {
            logStructured('warn', 'activity_count_out_of_range', {
                requestId: input.requestId,
                count: preset.activities.length,
                range: [AI_MIN_ACTIVITIES, AI_MAX_ACTIVITIES]
            });
        }

        const oversizedActivities = preset.activities.filter(a => a.estimatedHours > AI_MAX_HOURS);
        if (oversizedActivities.length > 0) {
            logStructured('warn', 'oversized_activities_detected', {
                requestId: input.requestId,
                oversizedCount: oversizedActivities.length,
                activities: oversizedActivities.map(a => ({ title: a.title, hours: a.estimatedHours }))
            });
        }

        // 8. Cache result
        try {
            const redis = await getRedisClient();
            await redis.setEx(cacheKey, CACHE_TTL_DAYS * 24 * 60 * 60, JSON.stringify(preset));
            logStructured('info', 'cache_set', { requestId: input.requestId, promptHash, ttlDays: CACHE_TTL_DAYS });
        } catch (err) {
            logStructured('warn', 'cache_set_failed', { requestId: input.requestId, error: String(err) });
        }

        metadata.generationTimeMs = Date.now() - startTime;
        metadata.averageCompleteness = averageCompleteness;
        metrics.preset_generation_success_total++;

        logStructured('info', 'pipeline_success', {
            requestId: input.requestId,
            generationTimeMs: metadata.generationTimeMs,
            activityCount: preset.activities.length,
            averageCompleteness
        });

        return {
            success: true,
            preset,
            metadata
        };

    } catch (error) {
        metadata.generationTimeMs = Date.now() - startTime;

        logStructured('error', 'pipeline_failed', {
            requestId: input.requestId,
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined
        });

        metrics.preset_generation_fallback_total++;

        return {
            success: false,
            preset: FALLBACK_PRESET,
            error: error instanceof Error ? error.message : String(error),
            metadata
        };
    }
}
