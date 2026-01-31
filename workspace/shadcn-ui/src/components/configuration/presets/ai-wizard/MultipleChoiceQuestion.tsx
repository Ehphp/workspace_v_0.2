/**
 * Multiple Choice Question Component
 * 
 * Renders a multiple-choice question with checkboxes.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MultipleChoiceQuestion } from '@/types/ai-interview';
import * as Icons from 'lucide-react';
import { WIZARD_DESIGN, combineClasses } from './wizard-design-system';

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
        <div className={WIZARD_DESIGN.spacing.card}>
            <div className={WIZARD_DESIGN.spacing.tight}>
                <h3 className={WIZARD_DESIGN.typography.questionTitle}>
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </h3>
                {question.description && (
                    <p className={WIZARD_DESIGN.typography.description}>{question.description}</p>
                )}
                <p className={`${WIZARD_DESIGN.typography.help} italic`}>Seleziona tutte le opzioni che si applicano</p>
            </div>

            <div className={WIZARD_DESIGN.spacing.items}>
                {question.options.map((option) => {
                    const IconComponent = option.icon && (Icons as any)[option.icon];

                    const isOther = option.id === 'other';
                    // Check if any value is NOT in the standard options list (excluding 'other' itself)
                    const standardOptionIds = question.options.filter(o => o.id !== 'other').map(o => o.id);
                    const customValues = value.filter(v => v && !standardOptionIds.includes(v));
                    const hasCustomValue = customValues.length > 0;

                    const isChecked = isOther ? hasCustomValue : value.includes(option.id);

                    const handleOtherToggle = () => {
                        if (hasCustomValue) {
                            // Remove all custom values (filter out empty strings and custom values)
                            onChange(value.filter(v => v && standardOptionIds.includes(v)));
                        } else {
                            // Add a placeholder for custom input
                            onChange([...value, '__custom__']);
                        }
                    };

                    const handleOtherTextChange = (text: string) => {
                        // Keep standard values + replace custom placeholder with actual text
                        const standardValues = value.filter(v => v && standardOptionIds.includes(v));
                        const trimmedText = text.trim();

                        if (trimmedText) {
                            // Replace any custom values with the new text
                            onChange([...standardValues, trimmedText]);
                        } else {
                            // Keep placeholder if text is empty
                            onChange([...standardValues, '__custom__']);
                        }
                    };

                    return (
                        <div
                            key={option.id}
                            className={combineClasses(
                                'flex flex-col p-4',
                                WIZARD_DESIGN.borders.option,
                                WIZARD_DESIGN.interactive.transition,
                                WIZARD_DESIGN.interactive.cursor,
                                isChecked ? WIZARD_DESIGN.borders.optionSelected : WIZARD_DESIGN.borders.optionHover
                            )}
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
                                            <IconComponent className={`${WIZARD_DESIGN.icons.medium} text-blue-600 flex-shrink-0 mt-0.5`} />
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
                                        value={customValues.find(v => v !== '__custom__') || ''}
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
