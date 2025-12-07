/**
 * Type Definitions for AI Interview System
 * 
 * Defines types for question generation, user answers, and interview state.
 */

import { z } from 'zod';

/**
 * Question Types
 */
export type QuestionType = 'single-choice' | 'multiple-choice' | 'text' | 'range';

/**
 * Question Option
 */
export interface QuestionOption {
    id: string;
    label: string;
    description?: string;
    icon?: string; // lucide-react icon name
}

/**
 * Base Question Interface
 */
export interface BaseQuestion {
    id: string;
    type: QuestionType;
    question: string;
    description?: string;
    required: boolean;
}

/**
 * Single Choice Question
 */
export interface SingleChoiceQuestion extends BaseQuestion {
    type: 'single-choice';
    options: QuestionOption[];
    defaultValue?: string;
}

/**
 * Multiple Choice Question
 */
export interface MultipleChoiceQuestion extends BaseQuestion {
    type: 'multiple-choice';
    options: QuestionOption[];
    defaultValue?: string[];
}

/**
 * Text Input Question
 */
export interface TextQuestion extends BaseQuestion {
    type: 'text';
    placeholder?: string;
    maxLength?: number;
    defaultValue?: string;
}

/**
 * Range Input Question
 */
export interface RangeQuestion extends BaseQuestion {
    type: 'range';
    min: number;
    max: number;
    step: number;
    unit?: string;
    defaultValue?: number;
}

/**
 * Union type for all question types
 */
export type AiQuestion =
    | SingleChoiceQuestion
    | MultipleChoiceQuestion
    | TextQuestion
    | RangeQuestion;

/**
 * Question Generation Response (from backend)
 */
export interface QuestionGenerationResponse {
    success: boolean;
    questions: AiQuestion[];
    reasoning?: string;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
    error?: string;
}

/**
 * User Answer Types
 */
export type AnswerValue = string | string[] | number;

export interface UserAnswer {
    questionId: string;
    value: AnswerValue;
    timestamp: Date;
}

/**
 * Interview State
 */
export interface InterviewState {
    questions: AiQuestion[];
    answers: Map<string, UserAnswer>;
    currentQuestionIndex: number;
    isComplete: boolean;
    reasoning?: string;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';
}

/**
 * Zod Schemas for Validation
 */

export const QuestionOptionSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
});

export const SingleChoiceQuestionSchema = z.object({
    id: z.string(),
    type: z.literal('single-choice'),
    question: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    options: z.array(QuestionOptionSchema).min(2),
    defaultValue: z.string().optional(),
});

export const MultipleChoiceQuestionSchema = z.object({
    id: z.string(),
    type: z.literal('multiple-choice'),
    question: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    options: z.array(QuestionOptionSchema).min(2),
    defaultValue: z.array(z.string()).optional(),
});

export const TextQuestionSchema = z.object({
    id: z.string(),
    type: z.literal('text'),
    question: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    placeholder: z.string().optional(),
    maxLength: z.number().optional(),
    defaultValue: z.string().optional(),
});

export const RangeQuestionSchema = z.object({
    id: z.string(),
    type: z.literal('range'),
    question: z.string(),
    description: z.string().optional(),
    required: z.boolean(),
    min: z.number(),
    max: z.number(),
    step: z.number(),
    unit: z.string().optional(),
    defaultValue: z.number().optional(),
});

export const AiQuestionSchema = z.discriminatedUnion('type', [
    SingleChoiceQuestionSchema,
    MultipleChoiceQuestionSchema,
    TextQuestionSchema,
    RangeQuestionSchema,
]);

export const QuestionGenerationResponseSchema = z.object({
    success: z.boolean(),
    questions: z.array(AiQuestionSchema),
    reasoning: z.string().optional(),
    suggestedTechCategory: z.enum(['FRONTEND', 'BACKEND', 'MULTI']).optional(),
    error: z.string().optional(),
});

/**
 * Helper function to validate answer for a specific question
 */
export function validateAnswer(question: AiQuestion, value: AnswerValue): boolean {
    if (question.required && (value === undefined || value === null || value === '')) {
        return false;
    }

    switch (question.type) {
        case 'single-choice':
            if (typeof value !== 'string') return false;
            return question.options.some(opt => opt.id === value);

        case 'multiple-choice':
            if (!Array.isArray(value)) return false;
            return value.every(v => question.options.some(opt => opt.id === v));

        case 'text':
            if (typeof value !== 'string') return false;
            if (question.maxLength && value.length > question.maxLength) return false;
            return true;

        case 'range':
            if (typeof value !== 'number') return false;
            if (value < question.min || value > question.max) return false;
            return true;

        default:
            return false;
    }
}

/**
 * Helper to check if all required questions are answered
 */
export function areRequiredQuestionsAnswered(
    questions: AiQuestion[],
    answers: Map<string, UserAnswer>
): boolean {
    const requiredQuestions = questions.filter(q => q.required);

    return requiredQuestions.every(question => {
        const answer = answers.get(question.id);
        if (!answer) return false;
        return validateAnswer(question, answer.value);
    });
}

/**
 * Helper to convert answers Map to serializable object
 */
export function serializeAnswers(answers: Map<string, UserAnswer>): Record<string, AnswerValue> {
    const result: Record<string, AnswerValue> = {};
    answers.forEach((answer, questionId) => {
        result[questionId] = answer.value;
    });
    return result;
}

/**
 * Helper to deserialize answers from object to Map
 */
export function deserializeAnswers(
    answersObj: Record<string, AnswerValue>
): Map<string, UserAnswer> {
    const map = new Map<string, UserAnswer>();
    Object.entries(answersObj).forEach(([questionId, value]) => {
        map.set(questionId, {
            questionId,
            value,
            timestamp: new Date(),
        });
    });
    return map;
}
