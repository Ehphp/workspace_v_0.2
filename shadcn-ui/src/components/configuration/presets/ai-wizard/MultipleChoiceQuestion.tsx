/**
 * Multiple Choice Question Component
 * 
 * Renders a multiple-choice question with checkboxes.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MultipleChoiceQuestion } from '@/types/ai-interview';
import * as Icons from 'lucide-react';

interface MultipleChoiceQuestionProps {
    question: MultipleChoiceQuestion;
    value?: string[];
    onChange: (value: string[]) => void;
}

export function MultipleChoiceQuestion({
    question,
    value = [],
    onChange,
}: MultipleChoiceQuestionProps) {
    const handleToggle = (optionId: string) => {
        const newValue = value.includes(optionId)
            ? value.filter(v => v !== optionId)
            : [...value, optionId];
        onChange(newValue);
    };

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
                <p className="text-xs text-slate-500 italic">Seleziona tutte le opzioni che si applicano</p>
            </div>

            <div className="space-y-3">
                {question.options.map((option) => {
                    const IconComponent = option.icon && (Icons as any)[option.icon];
                    const isChecked = value.includes(option.id);

                    return (
                        <div
                            key={option.id}
                            className={`flex items-start space-x-3 p-4 rounded-lg border transition-all cursor-pointer ${isChecked
                                    ? 'border-blue-500 bg-blue-50/50'
                                    : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                                }`}
                            onClick={() => handleToggle(option.id)}
                        >
                            <Checkbox
                                id={`${question.id}-${option.id}`}
                                checked={isChecked}
                                onCheckedChange={() => handleToggle(option.id)}
                                className="mt-1"
                            />
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
            </div>
        </div>
    );
}
