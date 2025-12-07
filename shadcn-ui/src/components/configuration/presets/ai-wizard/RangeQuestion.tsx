/**
 * Range Question Component
 * 
 * Renders a range slider question with visual feedback.
 */

import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { RangeQuestion } from '@/types/ai-interview';

interface RangeQuestionProps {
    question: RangeQuestion;
    value?: number;
    onChange: (value: number) => void;
}

export function RangeQuestion({
    question,
    value,
    onChange,
}: RangeQuestionProps) {
    const currentValue = value ?? question.defaultValue ?? question.min;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor={question.id} className="text-lg font-semibold text-slate-900">
                    {question.question}
                    {question.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {question.description && (
                    <p className="text-sm text-slate-600">{question.description}</p>
                )}
            </div>

            <div className="space-y-4">
                {/* Value Display */}
                <div className="flex items-center justify-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-center">
                        <div className="text-4xl font-bold text-blue-600">
                            {currentValue}
                        </div>
                        {question.unit && (
                            <div className="text-sm text-slate-600 mt-1">{question.unit}</div>
                        )}
                    </div>
                </div>

                {/* Slider */}
                <div className="px-2">
                    <Slider
                        id={question.id}
                        min={question.min}
                        max={question.max}
                        step={question.step}
                        value={[currentValue]}
                        onValueChange={(values) => onChange(values[0])}
                        className="w-full"
                    />
                </div>

                {/* Min/Max Labels */}
                <div className="flex justify-between text-xs text-slate-500 px-2">
                    <span>
                        {question.min} {question.unit && `${question.unit}`}
                    </span>
                    <span>
                        {question.max} {question.unit && `${question.unit}`}
                    </span>
                </div>
            </div>
        </div>
    );
}
