import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook for debounced async validation of technology names
 * Checks if a name already exists in the database
 */
export function useTechnologyValidation(
    currentName: string,
    editingId: string | null,
    debounceMs: number = 500
) {
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const validateName = useCallback(async (name: string, signal: AbortSignal) => {
        if (!name || name.length < 3) {
            return; // Skip validation for empty or too short names (handled by Zod)
        }

        setIsValidating(true);
        setValidationError(null);

        try {
            // Check if name exists in database
            let query = supabase
                .from('technology_presets')
                .select('id')
                .ilike('name', name)
                .limit(1);

            // If editing, exclude the current technology
            if (editingId) {
                query = query.neq('id', editingId);
            }

            const { data, error } = await query;

            if (signal.aborted) {
                return; // Request was cancelled
            }

            if (error) {
                console.error('Validation error:', error);
                setValidationError('Errore durante la validazione');
                return;
            }

            if (data && data.length > 0) {
                setValidationError('Esiste già una tecnologia con questo nome');
            }
        } catch (err) {
            if (!signal.aborted) {
                console.error('Validation exception:', err);
                setValidationError('Errore durante la validazione');
            }
        } finally {
            if (!signal.aborted) {
                setIsValidating(false);
            }
        }
    }, [editingId]);

    useEffect(() => {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            validateName(currentName, abortController.signal);
        }, debounceMs);

        return () => {
            clearTimeout(timeoutId);
            abortController.abort(); // Cancel any pending requests
        };
    }, [currentName, validateName, debounceMs]);

    return { isValidating, validationError };
}
