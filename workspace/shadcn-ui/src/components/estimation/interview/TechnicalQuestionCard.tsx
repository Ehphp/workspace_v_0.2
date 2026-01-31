/**
 * Technical Question Card Component
 * 
 * Modern card for displaying technical interview questions with:
 * - Category badge and icon
 * - Technical context (why this matters)
 * - Impact indicator (how it affects estimate)
 * - Various input types (single-choice, multiple-choice, range, text)
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    HelpCircle,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    Code2,
    Database,
    Shield,
    Gauge,
    Layout,
    GitBranch,
    TestTube,
    Rocket,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TechnicalQuestion, TechnicalQuestionCategory } from '@/types/requirement-interview';

/**
 * Category configuration with icons and colors
 */
const CATEGORY_CONFIG: Record<TechnicalQuestionCategory, {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
    bgColor: string;
}> = {
    INTEGRATION: {
        icon: Code2,
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        label: 'Integrazioni'
    },
    DATA: {
        icon: Database,
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        label: 'Dati'
    },
    SECURITY: {
        icon: Shield,
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        label: 'Sicurezza'
    },
    PERFORMANCE: {
        icon: Gauge,
        color: 'text-orange-700',
        bgColor: 'bg-orange-100',
        label: 'Performance'
    },
    UI_UX: {
        icon: Layout,
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
        label: 'UI/UX'
    },
    ARCHITECTURE: {
        icon: GitBranch,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-100',
        label: 'Architettura'
    },
    TESTING: {
        icon: TestTube,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        label: 'Testing'
    },
    DEPLOYMENT: {
        icon: Rocket,
        color: 'text-pink-700',
        bgColor: 'bg-pink-100',
        label: 'Deployment'
    },
};

interface TechnicalQuestionCardProps {
    question: TechnicalQuestion;
    value: string | string[] | number | undefined;
    onChange: (value: string | string[] | number) => void;
    showContext?: boolean;
    compact?: boolean;
}

export function TechnicalQuestionCard({
    question,
    value,
    onChange,
    showContext = true,
    compact = false,
}: TechnicalQuestionCardProps) {
    const [isContextExpanded, setIsContextExpanded] = useState(false);
    const category = CATEGORY_CONFIG[question.category];
    const CategoryIcon = category.icon;

    const hasAnswer = value !== undefined && value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true);

    return (
        <Card className={`
      relative overflow-hidden transition-all duration-200
      ${hasAnswer
                ? 'border-green-200 bg-green-50/30 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }
      ${compact ? 'p-4' : 'p-6'}
    `}>
            {/* Category indicator bar */}
            <div className={`absolute top-0 left-0 w-1 h-full ${category.bgColor}`} />

            <div className={`space-y-4 ${compact ? 'pl-3' : 'pl-4'}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${category.bgColor} ${category.color} shrink-0`}>
                            <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                    variant="outline"
                                    className={`${category.bgColor} ${category.color} border-0 text-xs font-medium`}
                                >
                                    {category.label}
                                </Badge>
                                {question.required && (
                                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                                        Obbligatoria
                                    </Badge>
                                )}
                                {hasAnswer && (
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">
                                        ✓ Risposta
                                    </Badge>
                                )}
                            </div>
                            <h3 className={`font-semibold text-slate-900 ${compact ? 'text-base' : 'text-lg'}`}>
                                {question.question}
                            </h3>
                        </div>
                    </div>

                    {showContext && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsContextExpanded(!isContextExpanded)}
                            className="text-slate-400 hover:text-slate-600 shrink-0"
                        >
                            <HelpCircle className="w-4 h-4 mr-1" />
                            {isContextExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </Button>
                    )}
                </div>

                {/* Context Panel (collapsible) */}
                <AnimatePresence>
                    {isContextExpanded && showContext && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm border border-slate-100">
                                <div className="flex items-start gap-2">
                                    <Code2 className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-medium text-slate-700">Contesto tecnico:</span>
                                        <p className="text-slate-600 mt-0.5">{question.technicalContext}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <TrendingUp className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="font-medium text-slate-700">Impatto sulla stima:</span>
                                        <p className="text-slate-600 mt-0.5">{question.impactOnEstimate}</p>
                                    </div>
                                </div>
                                {!hasAnswer && question.required && (
                                    <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-amber-700 text-xs">
                                            Se non conosci la risposta, chiedi al funzionale di riferimento.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Answer Input */}
                <div className="pt-2">
                    {question.type === 'single-choice' && question.options && (
                        <RadioGroup
                            value={value as string || ''}
                            onValueChange={onChange}
                            className="space-y-2"
                        >
                            {question.options.map((option) => (
                                <label
                                    key={option.id}
                                    className={`
                    flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${value === option.id
                                            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                                        }
                  `}
                                >
                                    <RadioGroupItem value={option.id} className="mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-slate-900">{option.label}</span>
                                        {option.description && (
                                            <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </RadioGroup>
                    )}

                    {question.type === 'multiple-choice' && question.options && (
                        <div className="space-y-2">
                            {question.options.map((option) => {
                                const isChecked = Array.isArray(value) && value.includes(option.id);
                                return (
                                    <label
                                        key={option.id}
                                        className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${isChecked
                                                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                                                : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                                            }
                    `}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                                const current = (value as string[]) || [];
                                                if (checked) {
                                                    onChange([...current, option.id]);
                                                } else {
                                                    onChange(current.filter(v => v !== option.id));
                                                }
                                            }}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-slate-900">{option.label}</span>
                                            {option.description && (
                                                <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {question.type === 'range' && (
                        <div className="space-y-4 pt-2">
                            <div className="px-2">
                                <Slider
                                    value={[typeof value === 'number' ? value : (question.min || 0)]}
                                    onValueChange={([v]) => onChange(v)}
                                    min={question.min || 0}
                                    max={question.max || 100}
                                    step={question.step || 1}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">
                                    {question.min || 0} {question.unit}
                                </span>
                                <span className="font-semibold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">
                                    {typeof value === 'number' ? value : (question.min || 0)} {question.unit}
                                </span>
                                <span className="text-slate-500">
                                    {question.max || 100} {question.unit}
                                </span>
                            </div>
                        </div>
                    )}

                    {question.type === 'text' && (
                        <div className="space-y-2">
                            <Textarea
                                value={(value as string) || ''}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={question.placeholder || 'Inserisci la risposta...'}
                                maxLength={question.maxLength}
                                className="min-h-[100px] resize-none"
                            />
                            {question.maxLength && (
                                <div className="flex justify-end">
                                    <span className="text-xs text-slate-400">
                                        {((value as string) || '').length} / {question.maxLength}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
