/**
 * Hook for managing Requirement Technical Interview state
 * 
 * Provides state management and actions for the technical interview flow:
 * - Generate questions from requirement description
 * - Track answers
 * - Generate estimate from answers
 */

import { useState, useCallback, useMemo, useRef } from 'react';
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
    PreEstimate,
} from '@/types/requirement-interview';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';
import type { ImpactMap } from '@/types/impact-map';
import type { EstimationBlueprint } from '@/types/estimation-blueprint';
import type { ProjectTechnicalBlueprint } from '@/types/project-technical-blueprint';

/** Result returned by generateQuestions so callers get data synchronously */
export interface GenerateQuestionsResult {
    success: boolean;
    decision?: 'ASK' | 'SKIP';
    questions?: TechnicalQuestion[];
    reasoning?: string;
    estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
    preEstimate?: PreEstimate;
}

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
    /** Information-gain planner decision (undefined for legacy responses) */
    plannerDecision: 'ASK' | 'SKIP' | undefined;
    /** Pre-estimate from Round 0 planner */
    preEstimate: PreEstimate | undefined;

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
        technologyId: string,
        techCategory: string,
        projectId?: string,
        projectContext?: { name: string; description: string; owner?: string; projectType?: string; domain?: string; scope?: string; teamSize?: number; deadlinePressure?: string; methodology?: string },
        requirementUnderstanding?: RequirementUnderstanding,
        impactMap?: ImpactMap,
        estimationBlueprint?: EstimationBlueprint,
        projectTechnicalBlueprint?: ProjectTechnicalBlueprint
    ) => Promise<GenerateQuestionsResult>;
    answerQuestion: (questionId: string, value: string | string[] | number) => void;
    nextQuestion: () => void;
    previousQuestion: () => void;
    goToQuestion: (index: number) => void;
    generateEstimate: (
        description: string,
        technologyId: string,
        techCategory: string,
        projectId?: string,
        projectContext?: { name: string; description: string; owner?: string; projectType?: string; domain?: string; scope?: string; teamSize?: number; deadlinePressure?: string; methodology?: string },
        requirementUnderstanding?: RequirementUnderstanding,
        impactMap?: ImpactMap,
        estimationBlueprint?: EstimationBlueprint,
        projectTechnicalBlueprint?: ProjectTechnicalBlueprint
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
    // Information-gain planner state
    const [plannerDecision, setPlannerDecision] = useState<'ASK' | 'SKIP' | undefined>();
    const [preEstimate, setPreEstimate] = useState<PreEstimate | undefined>();
    // Ref keeps latest preEstimate accessible in closures without stale-state issues
    const preEstimateRef = useRef<PreEstimate | undefined>();

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
        technologyId: string,
        techCategory: string,
        projectId?: string,
        projectContext?: { name: string; description: string; owner?: string; projectType?: string; domain?: string; scope?: string; teamSize?: number; deadlinePressure?: string; methodology?: string },
        requirementUnderstanding?: RequirementUnderstanding,
        impactMap?: ImpactMap,
        estimationBlueprint?: EstimationBlueprint,
        projectTechnicalBlueprint?: ProjectTechnicalBlueprint
    ): Promise<GenerateQuestionsResult> => {
        setPhase('loading-questions');
        setError(null);

        try {
            const response = await generateInterviewQuestions({
                description,
                techPresetId: technologyId,
                techCategory,
                projectId,
                projectContext,
                requirementUnderstanding,
                impactMap,
                estimationBlueprint,
                projectTechnicalBlueprint: projectTechnicalBlueprint
                    ? (projectTechnicalBlueprint as unknown as Record<string, unknown>)
                    : undefined,
            });

            if (response.success && (response.decision === 'SKIP' || response.questions.length > 0)) {
                setQuestions(response.questions);
                setReasoning(response.reasoning);
                setEstimatedComplexity(response.estimatedComplexity);
                setSuggestedActivities(response.suggestedActivities || []);
                setCurrentQuestionIndex(0);
                setAnswers(new Map());
                setPlannerDecision(response.decision);
                setPreEstimate(response.preEstimate);
                preEstimateRef.current = response.preEstimate;
                setPhase('interviewing');
                return {
                    success: true,
                    decision: response.decision,
                    questions: response.questions,
                    reasoning: response.reasoning,
                    estimatedComplexity: response.estimatedComplexity,
                    preEstimate: response.preEstimate,
                };
            } else {
                setError(response.error || 'Impossibile generare le domande. Riprova.');
                setPhase('error');
                return { success: false };
            }
        } catch (err) {
            console.error('[useRequirementInterview] Error generating questions:', err);
            setError(err instanceof Error ? err.message : 'Errore durante la generazione delle domande.');
            setPhase('error');
            return { success: false };
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
        technologyId: string,
        techCategory: string,
        projectId?: string,
        projectContext?: { name: string; description: string; owner?: string; projectType?: string; domain?: string; scope?: string; teamSize?: number; deadlinePressure?: string; methodology?: string },
        requirementUnderstanding?: RequirementUnderstanding,
        impactMap?: ImpactMap,
        estimationBlueprint?: EstimationBlueprint,
        projectTechnicalBlueprint?: ProjectTechnicalBlueprint
    ): Promise<EstimationFromInterviewResponse | null> => {
        setPhase('generating-estimate');
        setError(null);

        try {
            // Activities are now fetched server-side in the Netlify Function.
            // This eliminates the client-side Supabase query and reduces payload.
            console.log('[useRequirementInterview] Generating estimate (activities fetched server-side)');

            // Generate estimate
            const response = await generateEstimateFromInterview({
                description,
                techPresetId: technologyId,
                techCategory,
                answers: answersMapToRecord(answers),
                projectId,
                projectContext,
                preEstimate: preEstimateRef.current ?? preEstimate,
                requirementUnderstanding,
                impactMap,
                estimationBlueprint,
                projectTechnicalBlueprint: projectTechnicalBlueprint
                    ? (projectTechnicalBlueprint as unknown as Record<string, unknown>)
                    : undefined,
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
    }, [answers, preEstimate]);

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
        setPlannerDecision(undefined);
        setPreEstimate(undefined);
        preEstimateRef.current = undefined;
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
        plannerDecision,
        preEstimate,

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
