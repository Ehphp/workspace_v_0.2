import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { AIServiceError } from '@/lib/openai';

interface AiUnavailableBannerProps {
    /** Structured error from the AI backend */
    error: AIServiceError;
    /** Called when the user clicks "Retry" */
    onRetry: () => void;
    /** Called when the user dismisses the banner */
    onDismiss: () => void;
}

/**
 * Non-blocking banner displayed when the AI service is temporarily
 * unavailable (circuit breaker open, rate limited, etc.).
 *
 * Shows a countdown if `retryAfterSeconds` is available, and lets the
 * user either retry or continue with manual activity selection.
 *
 * @since Sprint 3 (S3-3c)
 */
export function AiUnavailableBanner({ error, onRetry, onDismiss }: AiUnavailableBannerProps) {
    const [countdown, setCountdown] = useState(error.retryAfterSeconds ?? 0);
    const [isRetrying, setIsRetrying] = useState(false);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleRetry = useCallback(() => {
        setIsRetrying(true);
        onRetry();
        // Reset after a short delay in case the parent doesn't unmount us
        setTimeout(() => setIsRetrying(false), 3000);
    }, [onRetry]);

    const canRetry = error.isRetryable && countdown <= 0;

    return (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-300">
                {error.code === 'AI_RATE_LIMITED'
                    ? 'Limite AI raggiunto'
                    : 'AI temporaneamente non disponibile'}
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
                <p className="mb-2">{error.message}</p>
                <div className="flex items-center gap-2">
                    {canRetry && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="border-amber-500 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                            Riprova
                        </Button>
                    )}
                    {countdown > 0 && (
                        <span className="text-xs">
                            Riprova tra {countdown}s…
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDismiss}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-400"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Prosegui manualmente
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
