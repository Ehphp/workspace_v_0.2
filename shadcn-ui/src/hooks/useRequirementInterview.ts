/**
 * Hook for managing Requirement Technical Interview state
 * 
 * Provides state management and actions for the technical interview flow:
 * - Generate questions from requirement description
 * - Track answers
 * - Generate estimate from answers
 */

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_ACTIVITIES } from '@/lib/mockData';
import {
    generateInterviewQuestions,
    generateEstimateFromInterview,
    answersMapToRecord,
} from '@/lib/requirement-interview-api';
import type {
    TechnicalQuestion,
    InterviewAnswer,
    RequirementInterviewState,
    EstimationFromInterviewResponse,
    SelectedActivityWithReason,
    SuggestedDriver,
} from '@/types/requirement-interview';
import type { Activity } from '@/types/database';

interface UseRequirementInterviewReturn {
    // State
    phase: RequirementInterviewState['phase'];
    questions: TechnicalQuestion[];
    answers: Map<string, InterviewAnswer>;
    currentQuestionIndex: number;
    reasoning: string | undefined;
    estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
    suggestedActivities: string[];
    error: string | null;

    // Computed
    progress: number;
    currentQuestion: TechnicalQuestion | undefined;
    canProceed: boolean;
    isFirstQuestion: boolean;
    isLastQuestion: boolean;
    answeredCount: number;
    requiredAnswered: boolean;

    // Estimate result (after interview completion)
    estimateResult: EstimationFromInterviewResponse | null;

    // Actions
    generateQuestions: (
        description: string,
        techPresetId: string,
        techCategory: string,
        projectContext?: { name: string; description: string; owner?: string }
    ) => Promise<boolean>;
    answerQuestion: (questionId: string, value: string | string[] | number) => void;
    nextQuestion: () => void;
    previousQuestion: () => void;
    goToQuestion: (index: number) => void;
    generateEstimate: (
        description: string,
        techPresetId: string,
        techCategory: string
    ) => Promise<EstimationFromInterviewResponse | null>;
    reset: () => void;
}

const initialState: RequirementInterviewState = {
    phase: 'idle',
    questions: [],
    answers: new Map(),
    currentQuestionIndex: 0,
    reasoning: undefined,
    estimatedComplexity: undefined,
    suggestedActivities: undefined,
    error: undefined,
};

export function useRequirementInterview(): UseRequirementInterviewReturn {
    // Core state
    const [phase, setPhase] = useState<RequirementInterviewState['phase']>('idle');
    const [questions, setQuestions] = useState<TechnicalQuestion[]>([]);
    const [answers, setAnswers] = useState<Map<string, InterviewAnswer>>(new Map());
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [reasoning, setReasoning] = useState<string | undefined>();
    const [estimatedComplexity, setEstimatedComplexity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | undefined>();
    const [suggestedActivities, setSuggestedActivities] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Estimate result
    const [estimateResult, setEstimateResult] = useState<EstimationFromInterviewResponse | null>(null);

    // Computed values
    const progress = useMemo(() => {
        if (questions.length === 0) return 0;
        return ((currentQuestionIndex + 1) / questions.length) * 100;
    }, [questions.length, currentQuestionIndex]);

    const currentQuestion = useMemo(() => {
        return questions[currentQuestionIndex];
    }, [questions, currentQuestionIndex]);

    const canProceed = useMemo(() => {
        if (!currentQuestion) return false;
        if (!currentQuestion.required) return true;
        return answers.has(currentQuestion.id);
    }, [currentQuestion, answers]);

    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const answeredCount = answers.size;

    const requiredAnswered = useMemo(() => {
        return questions
            .filter(q => q.required)
            .every(q => answers.has(q.id));
    }, [questions, answers]);

    // Actions
    const generateQuestions = useCallback(async (
        description: string,
        techPresetId: string,
        techCategory: string,
        projectContext?: { name: string; description: string; owner?: string }
    ): Promise<boolean> => {
        setPhase('loading-questions');
        setError(null);

        try {
            const response = await generateInterviewQuestions({
                description,
                techPresetId,
                techCategory,
                projectContext,
            });

            if (response.success && response.questions.length > 0) {
                setQuestions(response.questions);
                setReasoning(response.reasoning);
                setEstimatedComplexity(response.estimatedComplexity);
                setSuggestedActivities(response.suggestedActivities || []);
                setCurrentQuestionIndex(0);
                setAnswers(new Map());
                setPhase('interviewing');
                return true;
            } else {
                setError(response.error || 'Impossibile generare le domande. Riprova.');
                setPhase('error');
                return false;
            }
        } catch (err) {
            console.error('[useRequirementInterview] Error generating questions:', err);
            setError(err instanceof Error ? err.message : 'Errore durante la generazione delle domande.');
            setPhase('error');
            return false;
        }
    }, []);

    const answerQuestion = useCallback((
        questionId: string,
        value: string | string[] | number
    ) => {
        const question = questions.find(q => q.id === questionId);
        if (!question) {
            console.warn('[useRequirementInterview] Question not found:', questionId);
            return;
        }

        setAnswers(prev => {
            const next = new Map(prev);
            next.set(questionId, {
                questionId,
                category: question.category,
                value,
                timestamp: new Date(),
            });
            return next;
        });
    }, [questions]);

    const nextQuestion = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
        }
    }, [currentQuestionIndex, questions.length]);

    const previousQuestion = useCallback(() => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(i => i - 1);
        }
    }, [currentQuestionIndex]);

    const goToQuestion = useCallback((index: number) => {
        if (index >= 0 && index < questions.length) {
            setCurrentQuestionIndex(index);
        }
    }, [questions.length]);

    const generateEstimate = useCallback(async (
        description: string,
        techPresetId: string,
        techCategory: string
    ): Promise<EstimationFromInterviewResponse | null> => {
        setPhase('generating-estimate');
        setError(null);

        try {
            // Fetch activities from database filtered by tech category
            console.log('[useRequirementInterview] Fetching activities for tech_category:', techCategory);

            const { data: activitiesData, error: activitiesError } = await supabase
                .from('activities')
                .select('*')
                .eq('active', true)
                .or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`);

            console.log('[useRequirementInterview] Query result:', {
                count: activitiesData?.length || 0,
                error: activitiesError?.message,
                sampleCodes: activitiesData?.slice(0, 5).map(a => `${a.code} (${a.tech_category})`),
            });

            let activities: Activity[];
            if (activitiesError || !activitiesData || activitiesData.length === 0) {
                console.warn('[useRequirementInterview] Using mock activities');
                activities = MOCK_ACTIVITIES.filter(
                    a => a.tech_category === techCategory || a.tech_category === 'MULTI'
                );
            } else {
                activities = activitiesData;
            }

            if (activities.length === 0) {
                setError('Nessuna attività disponibile per questa tecnologia.');
                setPhase('error');
                return null;
            }

            // Generate estimate
            const response = await generateEstimateFromInterview({
                description,
                techPresetId,
                techCategory,
                answers: answersMapToRecord(answers),
                activities,
            });

            if (response.success) {
                setEstimateResult(response);
                setPhase('complete');
                return response;
            } else {
                setError(response.error || 'Impossibile generare la stima. Riprova.');
                setPhase('error');
                return null;
            }
        } catch (err) {
            console.error('[useRequirementInterview] Error generating estimate:', err);
            setError(err instanceof Error ? err.message : 'Errore durante la generazione della stima.');
            setPhase('error');
            return null;
        }
    }, [answers]);

    const reset = useCallback(() => {
        setPhase('idle');
        setQuestions([]);
        setAnswers(new Map());
        setCurrentQuestionIndex(0);
        setReasoning(undefined);
        setEstimatedComplexity(undefined);
        setSuggestedActivities([]);
        setError(null);
        setEstimateResult(null);
    }, []);

    return {
        // State
        phase,
        questions,
        answers,
        currentQuestionIndex,
        reasoning,
        estimatedComplexity,
        suggestedActivities,
        error,

        // Computed
        progress,
        currentQuestion,
        canProceed,
        isFirstQuestion,
        isLastQuestion,
        answeredCount,
        requiredAnswered,

        // Estimate result
        estimateResult,

        // Actions
        generateQuestions,
        answerQuestion,
        nextQuestion,
        previousQuestion,
        goToQuestion,
        generateEstimate,
        reset,
    };
}
