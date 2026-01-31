/**
 * Text Question Component
 * 
 * Renders a text input question.
 */

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { TextQuestion } from '@/types/ai-interview';
import { WIZARD_DESIGN } from './wizard-design-system';

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
        <div className={WIZARD_DESIGN.spacing.card}>
            <div className={WIZARD_DESIGN.spacing.tight}>
                <Label htmlFor={question.id} className={WIZARD_DESIGN.typography.questionTitle}>
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {question.description && (
                    <p className={WIZARD_DESIGN.typography.description}>{question.description}</p>
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
                        <span className={`${WIZARD_DESIGN.typography.help} ${remainingChars < 20 ? 'text-destructive' : ''}`}>
                            {remainingChars} caratteri rimanenti
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
