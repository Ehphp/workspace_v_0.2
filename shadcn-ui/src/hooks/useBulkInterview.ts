/**
 * Hook for managing Bulk Interview state
 * 
 * Provides state management for the bulk interview flow:
 * - Analyze requirements and generate questions
 * - Track answers
 * - Generate estimates for all requirements
 */

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
    generateBulkInterviewQuestions,
    generateBulkEstimatesFromInterview,
    bulkAnswersMapToRecord,
} from '@/lib/bulk-interview-api';
import type {
    BulkInterviewPhase,
    BulkInterviewQuestion,
    BulkInterviewAnswer,
    BulkRequirementInput,
    RequirementAnalysis,
    BulkRequirementEstimation,
    BulkInterviewResponse,
    BulkEstimateFromInterviewResponse,
} from '@/types/bulk-interview';
import type { Activity } from '@/types/database';

interface UseBulkInterviewReturn {
    // State
    phase: BulkInterviewPhase;
    requirements: BulkRequirementInput[];
    questions: BulkInterviewQuestion[];
    requirementAnalysis: RequirementAnalysis[];
    answers: Map<string, BulkInterviewAnswer>;
    currentQuestionIndex: number;
    reasoning: string | undefined;
    estimations: BulkRequirementEstimation[];
    error: string | null;

    // Computed
    progress: number;
    currentQuestion: BulkInterviewQuestion | undefined;
    canProceed: boolean;
    isFirstQuestion: boolean;
    isLastQuestion: boolean;
    answeredCount: number;
    requiredAnswered: boolean;
    summary: {
        totalRequirements: number;
        globalQuestions: number;
        multiReqQuestions: number;
        specificQuestions: number;
    };

    // Actions
    analyzeRequirements: (
        requirements: BulkRequirementInput[],
        techCategory: string,
        techPresetId?: string,
        projectContext?: { name: string; description: string }
    ) => Promise<boolean>;
    answerQuestion: (questionId: string, value: string | string[] | number) => void;
    nextQuestion: () => void;
    previousQuestion: () => void;
    goToQuestion: (index: number) => void;
    generateEstimates: (techCategory: string) => Promise<BulkEstimateFromInterviewResponse | null>;
    reset: () => void;
}

export function useBulkInterview(): UseBulkInterviewReturn {
    // Core state
    const [phase, setPhase] = useState<BulkInterviewPhase>('idle');
    const [requirements, setRequirements] = useState<BulkRequirementInput[]>([]);
    const [questions, setQuestions] = useState<BulkInterviewQuestion[]>([]);
    const [requirementAnalysis, setRequirementAnalysis] = useState<RequirementAnalysis[]>([]);
    const [answers, setAnswers] = useState<Map<string, BulkInterviewAnswer>>(new Map());
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [reasoning, setReasoning] = useState<string | undefined>();
    const [estimations, setEstimations] = useState<BulkRequirementEstimation[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Computed values
    const progress = useMemo(() => {
        if (questions.length === 0) return 0;
        return ((currentQuestionIndex + 1) / questions.length) * 100;
    }, [currentQuestionIndex, questions.length]);

    const currentQuestion = useMemo(() => {
        return questions[currentQuestionIndex];
    }, [questions, currentQuestionIndex]);

    const answeredCount = useMemo(() => {
        return answers.size;
    }, [answers]);

    const requiredAnswered = useMemo(() => {
        const requiredQuestions = questions.filter(q => q.required);
        return requiredQuestions.every(q => answers.has(q.id));
    }, [questions, answers]);

    const canProceed = useMemo(() => {
        if (!currentQuestion) return false;
        // Can proceed if current question is answered OR not required
        return answers.has(currentQuestion.id) || !currentQuestion.required;
    }, [currentQuestion, answers]);

    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    const summary = useMemo(() => ({
        totalRequirements: requirements.length,
        globalQuestions: questions.filter(q => q.scope === 'global').length,
        multiReqQuestions: questions.filter(q => q.scope === 'multi-requirement').length,
        specificQuestions: questions.filter(q => q.scope === 'specific').length,
    }), [requirements.length, questions]);

    // Actions
    const analyzeRequirements = useCallback(async (
        reqs: BulkRequirementInput[],
        techCategory: string,
        techPresetId?: string,
        projectContext?: { name: string; description: string }
    ): Promise<boolean> => {
        setPhase('analyzing');
        setError(null);
        setRequirements(reqs);

        try {
            console.log('[useBulkInterview] Analyzing', reqs.length, 'requirements');

            const response = await generateBulkInterviewQuestions({
                requirements: reqs,
                techCategory,
                techPresetId,
                projectContext,
            });

            if (response.success && response.questions.length > 0) {
                setQuestions(response.questions);
                setRequirementAnalysis(response.requirementAnalysis);
                setReasoning(response.reasoning);
                setPhase('interviewing');
                setCurrentQuestionIndex(0);
                return true;
            } else {
                setError(response.error || 'Impossibile generare le domande.');
                setPhase('error');
                return false;
            }
        } catch (err) {
            console.error('[useBulkInterview] Error analyzing requirements:', err);
            setError(err instanceof Error ? err.message : 'Errore durante l\'analisi.');
            setPhase('error');
            return false;
        }
    }, []);

    const answerQuestion = useCallback((questionId: string, value: string | string[] | number) => {
        const question = questions.find(q => q.id === questionId);
        if (!question) return;

        const answer: BulkInterviewAnswer = {
            questionId,
            scope: question.scope,
            affectedRequirementIds: question.affectedRequirementIds,
            category: question.category,
            value,
            timestamp: new Date(),
        };

        setAnswers(prev => {
            const newAnswers = new Map(prev);
            newAnswers.set(questionId, answer);
            return newAnswers;
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

    const generateEstimates = useCallback(async (
        techCategory: string
    ): Promise<BulkEstimateFromInterviewResponse | null> => {
        setPhase('generating');
        setError(null);

        try {
            // Fetch activities from database
            console.log('[useBulkInterview] Fetching activities for tech_category:', techCategory);

            const { data: activitiesData, error: activitiesError } = await supabase
                .from('activities')
                .select('*')
                .eq('active', true)
                .or(`tech_category.eq.${techCategory},tech_category.eq.MULTI`);

            if (activitiesError) {
                throw new Error(`Errore caricamento attività: ${activitiesError.message}`);
            }

            const activities = (activitiesData || []) as Activity[];

            if (activities.length === 0) {
                throw new Error('Nessuna attività disponibile per questa categoria tecnologica.');
            }

            // Convert answers Map to Record
            const answersRecord = bulkAnswersMapToRecord(answers);

            // Format activities for API
            const formattedActivities = activities.map(a => ({
                code: a.code,
                name: a.name,
                description: a.description || '',
                base_hours: a.base_hours,
                group: a.group,
                tech_category: a.tech_category,
            }));

            console.log('[useBulkInterview] Generating estimates with', Object.keys(answersRecord).length, 'answers');

            const response = await generateBulkEstimatesFromInterview({
                requirements,
                techCategory,
                answers: answersRecord,
                activities: formattedActivities,
            });

            if (response.success) {
                setEstimations(response.estimations);
                setPhase('reviewing');
                return response;
            } else {
                setError(response.error || 'Impossibile generare le stime.');
                setPhase('error');
                return null;
            }
        } catch (err) {
            console.error('[useBulkInterview] Error generating estimates:', err);
            setError(err instanceof Error ? err.message : 'Errore durante la generazione delle stime.');
            setPhase('error');
            return null;
        }
    }, [requirements, answers]);

    const reset = useCallback(() => {
        setPhase('idle');
        setRequirements([]);
        setQuestions([]);
        setRequirementAnalysis([]);
        setAnswers(new Map());
        setCurrentQuestionIndex(0);
        setReasoning(undefined);
        setEstimations([]);
        setError(null);
    }, []);

    return {
        // State
        phase,
        requirements,
        questions,
        requirementAnalysis,
        answers,
        currentQuestionIndex,
        reasoning,
        estimations,
        error,

        // Computed
        progress,
        currentQuestion,
        canProceed,
        isFirstQuestion,
        isLastQuestion,
        answeredCount,
        requiredAnswered,
        summary,

        // Actions
        analyzeRequirements,
        answerQuestion,
        nextQuestion,
        previousQuestion,
        goToQuestion,
        generateEstimates,
        reset,
    };
}
