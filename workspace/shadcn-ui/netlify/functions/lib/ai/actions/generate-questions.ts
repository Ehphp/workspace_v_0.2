/**
 * Question Generation Action
 * 
 * This module handles the logic for generating interview questions
 * based on user's technology description.
 */

import OpenAI from 'openai';
import { QUESTION_GENERATION_SYSTEM_PROMPT, FALLBACK_QUESTIONS } from '../prompts/question-generation';
import { sanitizePromptInput } from '../../../../../src/types/ai-validation';

interface GenerateQuestionsInput {
    description: string;
    userId: string;
}

interface QuestionOption {
    id: string;
    label: string;
    description?: string;
    icon?: string;
}

interface AiQuestion {
    id: string;
    type: 'single-choice' | 'multiple-choice' | 'text' | 'range';
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

interface QuestionGenerationResponse {
    success: boolean;
    questions: AiQuestion[];
    reasoning?: string;
    suggestedTechCategory?: string; // Can be: React, Node.js, PowerPlatform, Java, Python, .NET, Mobile, Web, Backend, General, etc.
    error?: string;
}

/**
 * Deterministic validation: Check if description is valid for question generation
 */
function validateDescription(description: string): { valid: boolean; error?: string } {
    // Already sanitized by caller, but double-check length
    if (!description || description.trim().length < 20) {
        return {
            valid: false,
            error: 'La descrizione deve contenere almeno 20 caratteri significativi per generare domande pertinenti.'
        };
    }

    if (description.length > 1000) {
        return {
            valid: false,
            error: 'La descrizione è troppo lunga (max 1000 caratteri). Riassumi i punti chiave del progetto.'
        };
    }

    // Check for placeholder text
    const placeholderPatterns = [
        /^test$/i,
        /^prova$/i,
        /^lorem ipsum/i,
        /^[a-z]{1,3}$/i, // Single/double/triple letter
        /^\d+$/,         // Only numbers
        /^[.\s]+$/       // Only dots/spaces
    ];

    if (placeholderPatterns.some(pattern => pattern.test(description.trim()))) {
        return {
            valid: false,
            error: 'La descrizione sembra essere un placeholder o test. Fornisci una descrizione reale del progetto.'
        };
    }

    return { valid: true };
}

/**
 * Validate AI-generated questions structure
 */
function validateQuestions(questions: AiQuestion[]): { valid: boolean; error?: string } {
    if (!Array.isArray(questions) || questions.length < 3 || questions.length > 7) {
        return {
            valid: false,
            error: `Expected 3-7 questions, got ${questions?.length || 0}`
        };
    }

    // Check that at least 2 questions are required
    const requiredCount = questions.filter(q => q.required).length;
    if (requiredCount < 2) {
        return {
            valid: false,
            error: `At least 2 questions must be required, got ${requiredCount}`
        };
    }

    // Validate each question has required fields
    for (const question of questions) {
        if (!question.id || !question.type || !question.question) {
            return {
                valid: false,
                error: `Question missing required fields: ${JSON.stringify(question)}`
            };
        }

        // Validate question type-specific requirements
        if ((question.type === 'single-choice' || question.type === 'multiple-choice')) {
            if (!question.options || question.options.length < 2) {
                return {
                    valid: false,
                    error: `Choice question "${question.id}" must have at least 2 options`
                };
            }
        }

        if (question.type === 'range') {
            if (question.min === undefined || question.max === undefined) {
                return {
                    valid: false,
                    error: `Range question "${question.id}" must have min and max values`
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Generate interview questions using OpenAI
 */
export async function generateQuestions(
    input: GenerateQuestionsInput,
    openaiClient: OpenAI
): Promise<QuestionGenerationResponse> {
    const startTime = Date.now();

    try {
        // 1. Sanitize input (defense in depth)
        const sanitizedDescription = sanitizePromptInput(input.description);

        // 2. Deterministic validation
        const validation = validateDescription(sanitizedDescription);
        if (!validation.valid) {
            console.warn('[generate-questions] Validation failed:', validation.error);
            return {
                success: false,
                questions: FALLBACK_QUESTIONS,
                error: validation.error
            };
        }

        console.log('[generate-questions] Generating questions for description length:', sanitizedDescription.length);

        // 3. Call OpenAI with JSON mode
        // Temperature 0.5 for balanced creativity (reduced from 0.7 for speed)
        // Reduced max_tokens to 1000 for faster response
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.5,
            max_tokens: 1000, // Reduced from 2000 for speed
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: QUESTION_GENERATION_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: `Generate 3-4 interview questions for: ${sanitizedDescription}`
                }
            ]
        });

        const duration = Date.now() - startTime;
        console.log(`[generate-questions] OpenAI call completed in ${duration}ms`);

        // 4. Parse and validate response
        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error('Empty response from OpenAI');
        }

        const aiResponse: QuestionGenerationResponse = JSON.parse(responseContent);

        // 5. Post-validation
        if (!aiResponse.success) {
            console.warn('[generate-questions] AI marked success=false:', aiResponse.error);
            return {
                success: false,
                questions: FALLBACK_QUESTIONS,
                error: aiResponse.error || 'AI could not generate questions for this description'
            };
        }

        const questionValidation = validateQuestions(aiResponse.questions);
        if (!questionValidation.valid) {
            console.error('[generate-questions] Question validation failed:', questionValidation.error);
            // Return fallback questions instead of failing completely
            return {
                success: true,
                questions: FALLBACK_QUESTIONS,
                reasoning: 'Using standard questions due to validation issues',
                suggestedTechCategory: aiResponse.suggestedTechCategory || 'MULTI'
            };
        }

        // 6. Success - return validated questions
        console.log(`[generate-questions] Successfully generated ${aiResponse.questions.length} questions`);
        return {
            success: true,
            questions: aiResponse.questions,
            reasoning: aiResponse.reasoning,
            suggestedTechCategory: aiResponse.suggestedTechCategory || 'MULTI'
        };

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[generate-questions] Error after', duration, 'ms:', error);

        // Return fallback questions on any error
        return {
            success: true, // Still success, but with fallback
            questions: FALLBACK_QUESTIONS,
            reasoning: 'Using standard questions due to generation error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
