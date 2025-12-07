/**
 * Description Input Component
 * 
 * Initial step where user provides project description.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import { sanitizePromptInput } from '@/types/ai-validation';

interface DescriptionInputProps {
    initialValue?: string;
    onSubmit: (description: string) => void;
    loading?: boolean;
}

const EXAMPLES = [
    'B2B Ecommerce platform with SAP integration and React frontend',
    'Mobile app for real-time IoT sensor monitoring with offline support',
    'Internal HR dashboard for employee management with SSO integration',
    'Microservices API gateway with Kong and Node.js backend'
];

export function DescriptionInput({
    initialValue = '',
    onSubmit,
    loading = false
}: DescriptionInputProps) {
    const [description, setDescription] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);

    const sanitized = sanitizePromptInput(description);
    const charCount = sanitized.length;
    const isValid = charCount >= 20 && charCount <= 1000;
    const canSubmit = isValid && !loading;

    const handleSubmit = () => {
        setError(null);

        if (charCount < 20) {
            setError('La descrizione deve contenere almeno 20 caratteri significativi.');
            return;
        }

        if (charCount > 1000) {
            setError('La descrizione è troppo lunga (max 1000 caratteri).');
            return;
        }

        onSubmit(sanitized);
    };

    const handleExampleClick = (example: string) => {
        setDescription(example);
        setError(null);
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">
                    Descrivi il tuo progetto
                </h2>
                <p className="text-lg text-slate-600">
                    L'AI genererà domande personalizzate per creare il preset perfetto
                </p>
            </div>

            {/* Input */}
            <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold text-slate-700">
                    Descrizione del progetto
                </Label>
                <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => {
                        setDescription(e.target.value);
                        setError(null);
                    }}
                    placeholder="Es: Piattaforma e-commerce B2B con integrazione SAP, frontend React, backend Node.js, deploy su AWS..."
                    rows={6}
                    maxLength={1000}
                    disabled={loading}
                    className="resize-none text-base"
                />
                <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${charCount < 20 ? 'text-destructive' :
                            charCount > 900 ? 'text-amber-600' :
                                'text-slate-500'
                        }`}>
                        {charCount} / 1000 caratteri
                        {charCount < 20 && ` (minimo 20, mancano ${20 - charCount})`}
                    </span>
                    {isValid && (
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                            ✓ Pronto
                        </span>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Examples */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Lightbulb className="w-4 h-4" />
                    <span className="font-medium">Esempi per iniziare:</span>
                </div>
                <div className="grid gap-2">
                    {EXAMPLES.map((example, index) => (
                        <button
                            key={index}
                            onClick={() => handleExampleClick(example)}
                            disabled={loading}
                            className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {example}
                        </button>
                    ))}
                </div>
            </div>

            {/* Submit Button */}
            <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="lg"
                className="w-full gap-2 text-base font-semibold"
            >
                {loading ? (
                    <>
                        <Sparkles className="w-5 h-5 animate-spin" />
                        Generazione domande...
                    </>
                ) : (
                    <>
                        Genera Domande AI
                        <ArrowRight className="w-5 h-5" />
                    </>
                )}
            </Button>

            {/* Info */}
            <div className="text-center text-xs text-slate-500">
                L'AI analizzerà la descrizione e genererà 3-5 domande contestuali per ottimizzare il preset
            </div>
        </div>
    );
}
