/**
 * Single Choice Question Component
 * 
 * Renders a single-choice question with radio buttons.
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { SingleChoiceQuestion } from '@/types/ai-interview';
import * as Icons from 'lucide-react';
import { WIZARD_DESIGN, combineClasses } from './wizard-design-system';

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
        <div className={WIZARD_DESIGN.spacing.card}>
            <div className={WIZARD_DESIGN.spacing.tight}>
                <h3 className={WIZARD_DESIGN.typography.questionTitle}>
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </h3>
                {question.description && (
                    <p className={WIZARD_DESIGN.typography.description}>{question.description}</p>
                )}
            </div>

            <RadioGroup
                value={value && !question.options.find(o => o.id === value) && question.options.some(o => o.id === 'other') ? 'other' : value}
                onValueChange={(val) => {
                    // If 'other' is selected, don't change value immediately to 'other', 
                    // wait for input or set empty string if current is not custom
                    if (val === 'other') {
                        onChange('');
                    } else {
                        onChange(val);
                    }
                }}
                className="space-y-3"
            >
                {question.options.map((option) => {
                    const IconComponent = option.icon && (Icons as any)[option.icon];
                    const isOther = option.id === 'other';
                    const isCustomValue = value && !question.options.find(o => o.id === value);
                    const isSelected = isOther ? isCustomValue : value === option.id;

                    return (
                        <div
                            key={option.id}
                            className={combineClasses(
                                'flex flex-col p-4',
                                WIZARD_DESIGN.borders.option,
                                WIZARD_DESIGN.interactive.transition,
                                WIZARD_DESIGN.interactive.cursor,
                                isSelected ? WIZARD_DESIGN.borders.optionSelected : WIZARD_DESIGN.borders.optionHover
                            )}
                        >
                            <div className="flex items-start space-x-3">
                                <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} className="mt-1" />
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
                            {isOther && isSelected && (
                                <div className="ml-8 mt-3">
                                    <input
                                        type="text"
                                        value={isCustomValue ? value : ''}
                                        onChange={(e) => onChange(e.target.value)}
                                        placeholder="Specificare altro..."
                                        className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </RadioGroup>
        </div>
    );
}
