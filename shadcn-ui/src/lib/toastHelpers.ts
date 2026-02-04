import { toast } from 'sonner';

/**
 * Centralized toast helper utilities to reduce code duplication
 */

/**
 * Display an error toast with consistent formatting
 * @param context - Context description (e.g., "caricamento dati", "salvataggio")
 * @param error - The error object or message
 */
export function showApiError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    toast.error(`Errore ${context}`, {
        description: message,
    });
}

/**
 * Display a success toast
 * @param message - Success message to display
 * @param description - Optional detailed description
 */
export function showSuccess(message: string, description?: string) {
    toast.success(message, {
        description,
    });
}

/**
 * Display an info toast
 * @param message - Info message to display
 * @param description - Optional detailed description
 */
export function showInfo(message: string, description?: string) {
    toast.info(message, {
        description,
    });
}

/**
 * Display a warning toast
 * @param message - Warning message to display
 * @param description - Optional detailed description
 */
export function showWarning(message: string, description?: string) {
    toast.warning(message, {
        description,
    });
}

/**
 * Show a loading toast and return functions to update/dismiss it
 * @param message - Initial loading message
 * @returns Object with update and dismiss functions
 */
export function showLoading(message: string) {
    const toastId = toast.loading(message);

    return {
        update: (newMessage: string) => toast.loading(newMessage, { id: toastId }),
        success: (successMessage: string, description?: string) =>
            toast.success(successMessage, { id: toastId, description }),
        error: (errorMessage: string, description?: string) =>
            toast.error(errorMessage, { id: toastId, description }),
        dismiss: () => toast.dismiss(toastId),
    };
}
