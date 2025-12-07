/**
 * Single Choice Question Component
 * 
 * Renders a single-choice question with radio buttons.
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { SingleChoiceQuestion } from '@/types/ai-interview';
import * as Icons from 'lucide-react';

interface SingleChoiceQuestionProps {
    question: SingleChoiceQuestion;
    value?: string;
    onChange: (value: string) => void;
}

export function SingleChoiceQuestion({
    question,
    value,
    onChange,
}: SingleChoiceQuestionProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </h3>
                {question.description && (
                    <p className="text-sm text-slate-600">{question.description}</p>
                )}
            </div>

            <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
                {question.options.map((option) => {
                    const IconComponent = option.icon && (Icons as any)[option.icon];

                    return (
                        <div
                            key={option.id}
                            className="flex items-start space-x-3 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer"
                        >
                            <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} className="mt-1" />
                            <Label
                                htmlFor={`${question.id}-${option.id}`}
                                className="flex-1 cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    {IconComponent && (
                                        <IconComponent className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="space-y-1">
                                        <div className="font-medium text-slate-900">{option.label}</div>
                                        {option.description && (
                                            <div className="text-sm text-slate-600">{option.description}</div>
                                        )}
                                    </div>
                                </div>
                            </Label>
                        </div>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
