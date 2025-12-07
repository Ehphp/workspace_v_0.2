/**
 * Test Component for Question Generation
 * 
 * Simple component to test the AI question generation endpoint.
 * Can be temporarily added to a page for manual testing.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { generateInterviewQuestions } from '@/lib/ai-interview-api';
import { AiQuestion } from '@/types/ai-interview';
import { useAuth } from '@/hooks/useAuth';

export function QuestionGenerationTest() {
    const { session } = useAuth();
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [questions, setQuestions] = useState<AiQuestion[] | null>(null);
    const [reasoning, setReasoning] = useState<string | null>(null);

    const handleTest = async () => {
        if (!description.trim()) {
            setError('Inserisci una descrizione');
            return;
        }

        setLoading(true);
        setError(null);
        setQuestions(null);
        setReasoning(null);

        try {
            const result = await generateInterviewQuestions(
                description,
                session?.access_token
            );

            if (!result.success) {
                setError(result.error || 'Generazione fallita');
                return;
            }

            setQuestions(result.questions);
            setReasoning(result.reasoning || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">
                    Test Question Generation Endpoint
                </h2>
                <p className="text-sm text-muted-foreground">
                    Test interno per verificare il funzionamento del generatore di domande AI
                </p>
            </div>

            {/* Input */}
            <div className="space-y-2">
                <label className="text-sm font-medium">
                    Descrizione Progetto (min 20 caratteri)
                </label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Es: Piattaforma e-commerce B2B con integrazione SAP e frontend React..."
                    rows={4}
                    className="resize-none"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{description.length} / 1000 caratteri</span>
                    <span>{description.length < 20 ? `Mancano ${20 - description.length} caratteri` : '✓ OK'}</span>
                </div>
            </div>

            {/* Action Button */}
            <Button
                onClick={handleTest}
                disabled={loading || description.length < 20}
                className="w-full"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generazione domande...
                    </>
                ) : (
                    'Genera Domande AI'
                )}
            </Button>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Success - Reasoning */}
            {reasoning && (
                <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Reasoning:</strong> {reasoning}
                    </AlertDescription>
                </Alert>
            )}

            {/* Success - Questions */}
            {questions && questions.length > 0 && (
                <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="font-semibold text-lg">
                        Domande Generate ({questions.length})
                    </h3>

                    {questions.map((q, index) => (
                        <div key={q.id} className="border-l-4 border-primary pl-4 py-2">
                            <div className="flex items-start gap-2">
                                <span className="font-bold text-primary">Q{index + 1}.</span>
                                <div className="flex-1">
                                    <p className="font-medium">{q.question}</p>
                                    {q.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {q.description}
                                        </p>
                                    )}

                                    {/* Question Metadata */}
                                    <div className="flex gap-2 mt-2 text-xs">
                                        <span className="px-2 py-1 bg-secondary rounded">
                                            {q.type}
                                        </span>
                                        {q.required && (
                                            <span className="px-2 py-1 bg-destructive/10 text-destructive rounded">
                                                Required
                                            </span>
                                        )}
                                    </div>

                                    {/* Options for choice questions */}
                                    {(q.type === 'single-choice' || q.type === 'multiple-choice') && q.options && (
                                        <ul className="mt-2 space-y-1">
                                            {q.options.map(opt => (
                                                <li key={opt.id} className="text-sm flex items-start gap-2">
                                                    <span className="text-muted-foreground">•</span>
                                                    <div>
                                                        <span className="font-medium">{opt.label}</span>
                                                        {opt.description && (
                                                            <span className="text-muted-foreground ml-2">
                                                                ({opt.description})
                                                            </span>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* Range metadata */}
                                    {q.type === 'range' && (
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            Range: {q.min} - {q.max} {q.unit && `(${q.unit})`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* JSON Output for debugging */}
            {questions && (
                <details className="border rounded-lg p-4">
                    <summary className="cursor-pointer font-medium">
                        JSON Output (per debugging)
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                        {JSON.stringify({ questions, reasoning }, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}
