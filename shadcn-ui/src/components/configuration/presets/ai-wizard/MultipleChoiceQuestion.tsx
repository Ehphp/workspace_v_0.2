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

                    const isOther = option.id === 'other';
                    // Check if any value is NOT in the standard options list (excluding 'other' itself)
                    const standardOptionIds = question.options.filter(o => o.id !== 'other').map(o => o.id);
                    const customValues = value.filter(v => !standardOptionIds.includes(v));
                    const hasCustomValue = customValues.length > 0;

                    const isChecked = isOther ? hasCustomValue : value.includes(option.id);

                    const handleOtherToggle = () => {
                        if (hasCustomValue) {
                            // Remove all custom values
                            onChange(value.filter(v => standardOptionIds.includes(v)));
                        } else {
                            // Add empty custom value to signify selection
                            onChange([...value, '']);
                        }
                    };

                    const handleOtherTextChange = (text: string) => {
                        // Keep standard values + new text
                        const standardValues = value.filter(v => standardOptionIds.includes(v));
                        if (text) {
                            onChange([...standardValues, text]);
                        } else {
                            // If text is empty but we want to keep it selected, we might keep an empty string
                            // But better to verify validation handles empty strings
                            onChange([...standardValues, text]);
                        }
                    };

                    return (
                        <div
                            key={option.id}
                            className={`flex flex-col p-4 rounded-lg border transition-all cursor-pointer ${isChecked
                                ? 'border-blue-500 bg-blue-50/50'
                                : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                                }`}
                        >
                            <div
                                className="flex items-start space-x-3"
                                onClick={(e) => {
                                    // Prevent triggering when clicking input
                                    if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLElement).type === 'text') {
                                        return;
                                    }
                                    isOther ? handleOtherToggle() : handleToggle(option.id);
                                }}
                            >
                                <Checkbox
                                    id={`${question.id}-${option.id}`}
                                    checked={isChecked}
                                    onCheckedChange={() => isOther ? handleOtherToggle() : handleToggle(option.id)}
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
                                        <div className="space-y-1 w-full">
                                            <div className="font-medium text-slate-900">{option.label}</div>
                                            {option.description && (
                                                <div className="text-sm text-slate-600">{option.description}</div>
                                            )}
                                        </div>
                                    </div>
                                </Label>
                            </div>

                            {/* Input for Other option */}
                            {isOther && isChecked && (
                                <div className="ml-8 mt-3">
                                    <input
                                        type="text"
                                        value={customValues[0] || ''}
                                        onChange={(e) => handleOtherTextChange(e.target.value)}
                                        placeholder="Specificare altro..."
                                        className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
