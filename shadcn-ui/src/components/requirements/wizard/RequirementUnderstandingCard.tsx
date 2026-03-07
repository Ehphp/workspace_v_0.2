/**
 * Presentational card for reviewing a RequirementUnderstanding artifact.
 * Pure display component — all actions delegated through callbacks.
 */

import { Badge } from '@/components/ui/badge';
import {
    Target,
    Package,
    Users,
    ArrowRightLeft,
    ShieldCheck,
    Lightbulb,
    Gauge,
    XCircle,
    CheckCircle2,
    ListChecks,
} from 'lucide-react';
import type { RequirementUnderstanding } from '@/types/requirement-understanding';

interface RequirementUnderstandingCardProps {
    understanding: RequirementUnderstanding;
}

const confidenceColor = (c: number) =>
    c >= 0.8 ? 'text-emerald-600' : c >= 0.5 ? 'text-amber-600' : 'text-red-600';

const complexityBadge = (level: string) => {
    switch (level) {
        case 'LOW':
            return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Bassa</Badge>;
        case 'MEDIUM':
            return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Media</Badge>;
        case 'HIGH':
            return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Alta</Badge>;
        default:
            return <Badge variant="outline">{level}</Badge>;
    }
};

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                {title}
            </div>
            <div className="text-xs text-slate-600 leading-relaxed pl-5">
                {children}
            </div>
        </div>
    );
}

function BulletList({ items }: { items: string[] }) {
    if (items.length === 0) return <span className="italic text-slate-400">Nessuno</span>;
    return (
        <ul className="list-disc list-inside space-y-0.5">
            {items.map((item, i) => (
                <li key={i}>{item}</li>
            ))}
        </ul>
    );
}

export function RequirementUnderstandingCard({ understanding }: RequirementUnderstandingCardProps) {
    const u = understanding;

    return (
        <div className="space-y-3 text-sm">
            {/* Objective + Output — top row */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section icon={Target} title="Obiettivo di business">
                    {u.businessObjective}
                </Section>
                <Section icon={Package} title="Output atteso">
                    {u.expectedOutput}
                </Section>
            </div>

            {/* Perimeter & Exclusions */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section icon={ListChecks} title="Perimetro funzionale">
                    <BulletList items={u.functionalPerimeter} />
                </Section>
                <Section icon={XCircle} title="Esclusioni">
                    <BulletList items={u.exclusions} />
                </Section>
            </div>

            {/* Actors */}
            <Section icon={Users} title="Attori">
                {u.actors.length === 0 ? (
                    <span className="italic text-slate-400">Nessuno identificato</span>
                ) : (
                    <ul className="list-disc list-inside space-y-0.5">
                        {u.actors.map((a, i) => (
                            <li key={i}>
                                <span className="font-medium">{a.role}</span> — {a.interaction}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* State Transition */}
            <Section icon={ArrowRightLeft} title="Transizione di stato">
                <div className="flex items-start gap-2">
                    <span className="shrink-0 font-medium text-slate-500">Da:</span>
                    <span>{u.stateTransition.initialState}</span>
                </div>
                <div className="flex items-start gap-2 mt-0.5">
                    <span className="shrink-0 font-medium text-slate-500">A:</span>
                    <span>{u.stateTransition.finalState}</span>
                </div>
            </Section>

            {/* Preconditions & Assumptions */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section icon={ShieldCheck} title="Precondizioni">
                    <BulletList items={u.preconditions} />
                </Section>
                <Section icon={Lightbulb} title="Assunzioni">
                    <BulletList items={u.assumptions} />
                </Section>
            </div>

            {/* Complexity + Confidence — bottom row */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700">Complessità:</span>
                    {complexityBadge(u.complexityAssessment.level)}
                </div>
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${confidenceColor(u.confidence)}`} />
                    <span className="text-xs font-semibold text-slate-700">Confidenza:</span>
                    <span className={`text-xs font-bold ${confidenceColor(u.confidence)}`}>
                        {Math.round(u.confidence * 100)}%
                    </span>
                </div>
                {u.complexityAssessment.rationale && (
                    <span className="text-[11px] text-slate-400 italic ml-auto max-w-[40%] truncate" title={u.complexityAssessment.rationale}>
                        {u.complexityAssessment.rationale}
                    </span>
                )}
            </div>
        </div>
    );
}
