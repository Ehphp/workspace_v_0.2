import { useState } from 'react';
import { normalizeRequirement, NormalizationResult } from '@/lib/openai';
import { useToast } from '@/hooks/use-toast';

interface UseRequirementNormalizationReturn {
    normalize: (description: string) => Promise<NormalizationResult | null>;
    normalizationResult: NormalizationResult | null;
    isNormalizing: boolean;
    error: Error | null;
    resetNormalization: () => void;
}

export function useRequirementNormalization(): UseRequirementNormalizationReturn {
    const [normalizationResult, setNormalizationResult] = useState<NormalizationResult | null>(null);
    const [isNormalizing, setIsNormalizing] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const { toast } = useToast();

    const normalize = async (description: string) => {
        if (!description || description.trim().length < 10) {
            toast({
                title: 'Description too short',
                description: 'Please enter a more detailed description to analyze.',
                variant: 'destructive',
            });
            return null;
        }

        setIsNormalizing(true);
        setError(null);

        try {
            const result = await normalizeRequirement(description);
            setNormalizationResult(result);
            return result;
        } catch (err) {
            console.error('Normalization error:', err);
            const errorObj = err instanceof Error ? err : new Error('Failed to normalize requirement');
            setError(errorObj);
            toast({
                title: 'Analysis Failed',
                description: 'Could not analyze the requirement. Please try again.',
                variant: 'destructive',
            });
            return null;
        } finally {
            setIsNormalizing(false);
        }
    };

    const resetNormalization = () => {
        setNormalizationResult(null);
        setError(null);
    };

    return {
        normalize,
        normalizationResult,
        isNormalizing,
        error,
        resetNormalization
    };
}
