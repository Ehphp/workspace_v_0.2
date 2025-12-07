/**
 * AI Wizard State Management Hook
 * 
 * Manages the finite state machine for the AI Technology Wizard:
 * IDLE -> LOADING_QUESTIONS -> INTERVIEW -> GENERATING_PRESET -> REVIEW -> SAVING -> COMPLETE
 */

import { useReducer, useCallback } from 'react';
import {
    AiQuestion,
    UserAnswer,
    AnswerValue,
    areRequiredQuestionsAnswered,
    validateAnswer,
} from '../types/ai-interview';
import { GeneratedPreset } from '@/types/ai-preset-generation';

/**
 * Wizard States
 */
export type WizardState =
    | 'idle'                  // Initial state, show description input
    | 'loading-questions'     // Fetching questions from AI
    | 'interview'             // User answering questions
    | 'generating-preset'     // AI generating preset from answers
    | 'review'                // User reviewing generated preset
    | 'saving'                // Saving preset to database
    | 'complete'              // Success - preset saved
    | 'error';                // Error occurred

/**
 * Wizard Context Data
 */
export interface WizardData {
    // Step 1: Initial input
    description: string;

    // Step 2: AI-generated questions
    questions: AiQuestion[];
    reasoning?: string;
    suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI';

    // Step 3: User answers
    answers: Map<string, UserAnswer>;
    currentQuestionIndex: number;

    // Step 4: Generated preset
    generatedPreset?: GeneratedPreset;

    // Error handling
    error?: string;
}

/**
 * Full Wizard State
 */
export interface WizardStateType {
    state: WizardState;
    data: WizardData;
}

/**
 * Wizard Actions
 */
export type WizardAction =
    | { type: 'START'; description: string }
    | { type: 'QUESTIONS_LOADED'; questions: AiQuestion[]; reasoning?: string; suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI' }
    | { type: 'QUESTIONS_ERROR'; error: string }
    | { type: 'ANSWER_QUESTION'; questionId: string; value: AnswerValue }
    | { type: 'NEXT_QUESTION' }
    | { type: 'PREVIOUS_QUESTION' }
    | { type: 'START_GENERATION' }
    | { type: 'PRESET_GENERATED'; preset: GeneratedPreset }
    | { type: 'GENERATION_ERROR'; error: string }
    | { type: 'EDIT_PRESET'; preset: GeneratedPreset }
    | { type: 'START_SAVING' }
    | { type: 'SAVE_SUCCESS' }
    | { type: 'SAVE_ERROR'; error: string }
    | { type: 'RESET' };

/**
 * Initial state
 */
const initialState: WizardStateType = {
    state: 'idle',
    data: {
        description: '',
        questions: [],
        answers: new Map(),
        currentQuestionIndex: 0,
    },
};

/**
 * Wizard Reducer
 */
function wizardReducer(state: WizardStateType, action: WizardAction): WizardStateType {
    switch (action.type) {
        case 'START':
            return {
                state: 'loading-questions',
                data: {
                    ...initialState.data,
                    description: action.description,
                },
            };

        case 'QUESTIONS_LOADED':
            return {
                state: 'interview',
                data: {
                    ...state.data,
                    questions: action.questions,
                    reasoning: action.reasoning,
                    suggestedTechCategory: action.suggestedTechCategory,
                    currentQuestionIndex: 0,
                    answers: new Map(),
                },
            };

        case 'QUESTIONS_ERROR':
            return {
                state: 'error',
                data: {
                    ...state.data,
                    error: action.error,
                },
            };

        case 'ANSWER_QUESTION': {
            const newAnswers = new Map(state.data.answers);
            const question = state.data.questions.find(q => q.id === action.questionId);

            if (question && validateAnswer(question, action.value)) {
                newAnswers.set(action.questionId, {
                    questionId: action.questionId,
                    value: action.value,
                    timestamp: new Date(),
                });
            }

            return {
                ...state,
                data: {
                    ...state.data,
                    answers: newAnswers,
                },
            };
        }

        case 'NEXT_QUESTION': {
            const nextIndex = state.data.currentQuestionIndex + 1;

            // If we've answered all questions, move to generation
            if (nextIndex >= state.data.questions.length) {
                return {
                    state: 'generating-preset',
                    data: state.data,
                };
            }

            return {
                ...state,
                data: {
                    ...state.data,
                    currentQuestionIndex: nextIndex,
                },
            };
        }

        case 'PREVIOUS_QUESTION': {
            const prevIndex = Math.max(0, state.data.currentQuestionIndex - 1);

            return {
                ...state,
                data: {
                    ...state.data,
                    currentQuestionIndex: prevIndex,
                },
            };
        }

        case 'START_GENERATION':
            return {
                state: 'generating-preset',
                data: state.data,
            };

        case 'PRESET_GENERATED':
            return {
                state: 'review',
                data: {
                    ...state.data,
                    generatedPreset: action.preset,
                },
            };

        case 'GENERATION_ERROR':
            return {
                state: 'error',
                data: {
                    ...state.data,
                    error: action.error,
                },
            };

        case 'EDIT_PRESET':
            return {
                ...state,
                data: {
                    ...state.data,
                    generatedPreset: action.preset,
                },
            };

        case 'START_SAVING':
            return {
                state: 'saving',
                data: state.data,
            };

        case 'SAVE_SUCCESS':
            return {
                state: 'complete',
                data: state.data,
            };

        case 'SAVE_ERROR':
            return {
                state: 'error',
                data: {
                    ...state.data,
                    error: action.error,
                },
            };

        case 'RESET':
            return initialState;

        default:
            return state;
    }
}

/**
 * Hook for AI Wizard State Management
 */
export function useAiWizardState() {
    const [wizardState, dispatch] = useReducer(wizardReducer, initialState);

    // Computed properties
    const canProceed = useCallback(() => {
        if (wizardState.state !== 'interview') return false;

        const currentQuestion = wizardState.data.questions[wizardState.data.currentQuestionIndex];
        if (!currentQuestion) return false;

        const currentAnswer = wizardState.data.answers.get(currentQuestion.id);

        // If question is required, must have valid answer
        if (currentQuestion.required) {
            return currentAnswer !== undefined && validateAnswer(currentQuestion, currentAnswer.value);
        }

        // Optional questions can be skipped
        return true;
    }, [wizardState]);

    const canGenerate = useCallback(() => {
        return areRequiredQuestionsAnswered(
            wizardState.data.questions,
            wizardState.data.answers
        );
    }, [wizardState.data.questions, wizardState.data.answers]);

    const isFirstQuestion = wizardState.data.currentQuestionIndex === 0;
    const isLastQuestion = wizardState.data.currentQuestionIndex === wizardState.data.questions.length - 1;

    const progress = wizardState.data.questions.length > 0
        ? ((wizardState.data.currentQuestionIndex + 1) / wizardState.data.questions.length) * 100
        : 0;

    // Action creators
    const start = useCallback((description: string) => {
        dispatch({ type: 'START', description });
    }, []);

    const loadQuestions = useCallback((
        questions: AiQuestion[],
        reasoning?: string,
        suggestedTechCategory?: 'FRONTEND' | 'BACKEND' | 'MULTI'
    ) => {
        dispatch({ type: 'QUESTIONS_LOADED', questions, reasoning, suggestedTechCategory });
    }, []);

    const setQuestionsError = useCallback((error: string) => {
        dispatch({ type: 'QUESTIONS_ERROR', error });
    }, []);

    const answerQuestion = useCallback((questionId: string, value: AnswerValue) => {
        dispatch({ type: 'ANSWER_QUESTION', questionId, value });
    }, []);

    const nextQuestion = useCallback(() => {
        dispatch({ type: 'NEXT_QUESTION' });
    }, []);

    const previousQuestion = useCallback(() => {
        dispatch({ type: 'PREVIOUS_QUESTION' });
    }, []);

    const startGeneration = useCallback(() => {
        dispatch({ type: 'START_GENERATION' });
    }, []);

    const setGeneratedPreset = useCallback((preset: GeneratedPreset) => {
        dispatch({ type: 'PRESET_GENERATED', preset });
    }, []);

    const setGenerationError = useCallback((error: string) => {
        dispatch({ type: 'GENERATION_ERROR', error });
    }, []);

    const editPreset = useCallback((preset: GeneratedPreset) => {
        dispatch({ type: 'EDIT_PRESET', preset });
    }, []);

    const startSaving = useCallback(() => {
        dispatch({ type: 'START_SAVING' });
    }, []);

    const setSaveSuccess = useCallback(() => {
        dispatch({ type: 'SAVE_SUCCESS' });
    }, []);

    const setSaveError = useCallback((error: string) => {
        dispatch({ type: 'SAVE_ERROR', error });
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    return {
        // State
        state: wizardState.state,
        data: wizardState.data,

        // Computed properties
        canProceed: canProceed(),
        canGenerate: canGenerate(),
        isFirstQuestion,
        isLastQuestion,
        progress,

        // Actions
        start,
        loadQuestions,
        setQuestionsError,
        answerQuestion,
        nextQuestion,
        previousQuestion,
        startGeneration,
        setGeneratedPreset,
        setGenerationError,
        editPreset,
        startSaving,
        setSaveSuccess,
        setSaveError,
        reset,
    };
}

/**
 * Type guard helpers
 */
export function isInterviewState(state: WizardState): boolean {
    return state === 'interview';
}

export function isReviewState(state: WizardState): boolean {
    return state === 'review';
}

export function isLoadingState(state: WizardState): boolean {
    return state === 'loading-questions' || state === 'generating-preset' || state === 'saving';
}

export function isErrorState(state: WizardState): boolean {
    return state === 'error';
}

export function isCompleteState(state: WizardState): boolean {
    return state === 'complete';
}
