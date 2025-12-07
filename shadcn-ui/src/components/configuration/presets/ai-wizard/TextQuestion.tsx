/**
 * Text Question Component
 * 
 * Renders a text input question.
 */

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { TextQuestion } from '@/types/ai-interview';

interface TextQuestionProps {
    question: TextQuestion;
    value?: string;
    onChange: (value: string) => void;
}

export function TextQuestion({
    question,
    value = '',
    onChange,
}: TextQuestionProps) {
    const remainingChars = question.maxLength ? question.maxLength - value.length : null;

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={question.id} className="text-lg font-semibold text-slate-900">
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {question.description && (
                    <p className="text-sm text-slate-600">{question.description}</p>
                )}
            </div>

            <div className="space-y-2">
                <Textarea
                    id={question.id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={question.placeholder || 'Inserisci la tua risposta...'}
                    maxLength={question.maxLength}
                    rows={4}
                    className="resize-none"
                />
                {remainingChars !== null && (
                    <div className="flex justify-end">
                        <span className={`text-xs ${remainingChars < 20 ? 'text-destructive' : 'text-slate-500'
                            }`}>
                            {remainingChars} caratteri rimanenti
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
