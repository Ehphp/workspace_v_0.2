/**
 * Editable card for reviewing a RequirementUnderstanding artifact.
 *
 * When `onUpdate` is provided, all text fields become inline-editable
 * with a "draft revision" UX — user edits render in italic with an
 * indigo left bar. Each section offers a "Ripristina" undo.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    Target,
    Package,
    Users,
    User2,
    Server,
    ArrowRightLeft,
    ShieldCheck,
    Lightbulb,
    Gauge,
    XCircle,
    CheckCircle2,
    ListChecks,
    Plus,
    X,
    RotateCcw,
    PenLine,
} from 'lucide-react';
import type { RequirementUnderstanding, ActorType } from '@/types/requirement-understanding';

interface RequirementUnderstandingCardProps {
    understanding: RequirementUnderstanding;
    /** Original AI output — enables diff highlighting when provided */
    originalUnderstanding?: RequirementUnderstanding;
    /** Enables inline editing when provided */
    onUpdate?: (updated: RequirementUnderstanding) => void;
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

// ── Section wrapper with edit indicators ──

function Section({
    icon: Icon,
    title,
    editable,
    isEdited,
    onRestore,
    children,
}: {
    icon: React.ElementType;
    title: string;
    editable?: boolean;
    isEdited?: boolean;
    onRestore?: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className={cn(
            'space-y-1 group/section border-l-2 pl-2 transition-colors duration-200',
            isEdited ? 'border-emerald-400' : 'border-transparent'
        )}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                {title}
                {isEdited && onRestore && (
                    <button
                        type="button"
                        onClick={onRestore}
                        className="ml-auto flex items-center gap-0.5 text-[10px] font-normal text-emerald-500 hover:text-emerald-700 transition-colors"
                        title="Ripristina testo originale"
                    >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">Ripristina</span>
                    </button>
                )}
                {editable && !isEdited && (
                    <PenLine className="w-3 h-3 text-slate-300 opacity-0 group-hover/section:opacity-100 transition-opacity ml-auto" />
                )}
            </div>
            <div className="text-xs text-slate-600 leading-relaxed pl-5">
                {children}
            </div>
        </div>
    );
}

// ── Auto-resizing textarea that looks like plain text ──

function EditableText({
    value,
    originalValue,
    isEdited,
    onChange,
}: {
    value: string;
    originalValue?: string;
    isEdited: boolean;
    onChange: (v: string) => void;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <div>
            {isEdited && originalValue && (
                <div className="text-[11px] leading-relaxed text-slate-400 line-through mb-0.5 select-none">
                    {originalValue}
                </div>
            )}
            <textarea
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={1}
                className={cn(
                    'editable-inline w-full resize-none bg-transparent border-none p-0 shadow-none appearance-none',
                    'outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none',
                    'text-xs leading-relaxed cursor-text',
                    'rounded px-1.5 py-0.5 -mx-1.5 -my-0.5',
                    'transition-colors duration-150',
                    'hover:bg-slate-50 focus:bg-emerald-50/40',
                    isEdited ? 'text-emerald-700' : 'text-inherit'
                )}
            />
        </div>
    );
}

// ── Auto-resizing textarea for bullet list items ──

function AutoTextarea({
    value,
    originalValue,
    onChange,
    placeholder,
    isEdited,
}: {
    value: string;
    originalValue?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    isEdited: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <div className="flex-1 min-w-0">
            {isEdited && originalValue && (
                <div className="text-[11px] leading-relaxed text-slate-400 line-through mb-0.5 select-none">
                    {originalValue}
                </div>
            )}
            <textarea
                ref={ref}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={1}
                className={cn(
                    'editable-inline w-full resize-none overflow-hidden bg-transparent border-none p-0 shadow-none appearance-none',
                    'outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none',
                    'text-xs leading-relaxed cursor-text',
                    'rounded px-1 -mx-1 py-0.5',
                    'hover:bg-slate-50 focus:bg-emerald-50/40',
                    'transition-colors duration-150',
                    isEdited ? 'text-emerald-700' : 'text-slate-600'
                )}
            />
        </div>
    );
}

// ── Editable bullet list with per-item diff, add & remove ──

function EditableBulletList({
    items,
    originalItems,
    onChange,
    emptyLabel = 'Nessuno',
    addLabel = 'Aggiungi',
}: {
    items: string[];
    originalItems?: string[];
    onChange?: (items: string[]) => void;
    emptyLabel?: string;
    addLabel?: string;
}) {
    const handleChange = (i: number, v: string) => {
        const updated = [...items];
        updated[i] = v;
        onChange?.(updated);
    };
    const handleDelete = (i: number) => onChange?.(items.filter((_, idx) => idx !== i));
    const handleAdd = () => onChange?.([...items, '']);

    return (
        <div className="space-y-0.5">
            {items.length === 0 && (
                <span className="italic text-slate-400">{emptyLabel}</span>
            )}
            {items.map((item, i) => {
                const isItemEdited = originalItems != null && (
                    i >= originalItems.length || item !== originalItems[i]
                );
                return (
                    <div key={i} className="flex items-start gap-1 group/item">
                        <span className="text-slate-400 mt-1 shrink-0 select-none">•</span>
                        {onChange ? (
                            <>
                                <AutoTextarea
                                    value={item}
                                    originalValue={isItemEdited && originalItems && i < originalItems.length ? originalItems[i] : undefined}
                                    onChange={(v) => handleChange(i, v)}
                                    placeholder="Scrivi qui…"
                                    isEdited={isItemEdited}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleDelete(i)}
                                    className="shrink-0 opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity mt-0.5"
                                    title="Rimuovi"
                                >
                                    <X className="w-3 h-3 text-red-400" />
                                </button>
                            </>
                        ) : (
                            <span className="break-words">{item}</span>
                        )}
                    </div>
                );
            })}
            {onChange && (
                <button
                    type="button"
                    onClick={handleAdd}
                    className="flex items-center gap-0.5 text-[11px] text-emerald-500 hover:text-emerald-700 ml-4 mt-1 transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    {addLabel}
                </button>
            )}
        </div>
    );
}

// ── Actor type icon helper ──

const ActorTypeIcon = ({ type }: { type?: ActorType }) => {
    if (type === 'system') return <Server className="w-3 h-3 text-blue-500 shrink-0" aria-label="Sistema" />;
    return <User2 className="w-3 h-3 text-slate-500 shrink-0" aria-label="Umano" />;
};

const interactionModeBadge = (mode?: string) => {
    if (!mode) return null;
    const label = mode === 'api_ingestion' ? 'API' : mode === 'automated' ? 'Auto' : 'Manual';
    const colors = mode === 'api_ingestion'
        ? 'bg-blue-50 text-blue-600 border-blue-200'
        : mode === 'automated'
            ? 'bg-violet-50 text-violet-600 border-violet-200'
            : 'bg-slate-50 text-slate-500 border-slate-200';
    return <Badge variant="outline" className={cn('text-[9px] px-1 py-0 leading-tight font-normal', colors)}>{label}</Badge>;
};

export function RequirementUnderstandingCard({
    understanding,
    originalUnderstanding,
    onUpdate,
}: RequirementUnderstandingCardProps) {
    const u = understanding;
    const o = originalUnderstanding;
    const editable = onUpdate != null;

    const patch = useCallback(
        (updates: Partial<RequirementUnderstanding>) => {
            onUpdate?.({ ...understanding, ...updates });
        },
        [understanding, onUpdate]
    );

    // Section-level edit checks
    const isObjEdited = o != null && u.businessObjective !== o.businessObjective;
    const isOutEdited = o != null && u.expectedOutput !== o.expectedOutput;
    const isPerEdited = o != null && JSON.stringify(u.functionalPerimeter) !== JSON.stringify(o.functionalPerimeter);
    const isExcEdited = o != null && JSON.stringify(u.exclusions) !== JSON.stringify(o.exclusions);
    const isActEdited = o != null && JSON.stringify(u.actors) !== JSON.stringify(o.actors);
    const isTraEdited = o != null && (
        u.stateTransition.initialState !== o.stateTransition.initialState ||
        u.stateTransition.finalState !== o.stateTransition.finalState
    );
    const isPreEdited = o != null && JSON.stringify(u.preconditions) !== JSON.stringify(o.preconditions);
    const isAssEdited = o != null && JSON.stringify(u.assumptions) !== JSON.stringify(o.assumptions);

    return (
        <div className="space-y-3 text-sm">
            {/* Obiettivo + Output */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section
                    icon={Target}
                    title="Obiettivo di business"
                    editable={editable}
                    isEdited={isObjEdited}
                    onRestore={isObjEdited ? () => patch({ businessObjective: o!.businessObjective }) : undefined}
                >
                    {editable ? (
                        <EditableText
                            value={u.businessObjective}
                            originalValue={o?.businessObjective}
                            isEdited={isObjEdited}
                            onChange={(v) => patch({ businessObjective: v })}
                        />
                    ) : (
                        u.businessObjective
                    )}
                </Section>
                <Section
                    icon={Package}
                    title="Output atteso"
                    editable={editable}
                    isEdited={isOutEdited}
                    onRestore={isOutEdited ? () => patch({ expectedOutput: o!.expectedOutput }) : undefined}
                >
                    {editable ? (
                        <EditableText
                            value={u.expectedOutput}
                            originalValue={o?.expectedOutput}
                            isEdited={isOutEdited}
                            onChange={(v) => patch({ expectedOutput: v })}
                        />
                    ) : (
                        u.expectedOutput
                    )}
                </Section>
            </div>

            {/* Perimetro & Esclusioni */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section
                    icon={ListChecks}
                    title="Perimetro funzionale"
                    editable={editable}
                    isEdited={isPerEdited}
                    onRestore={isPerEdited ? () => patch({ functionalPerimeter: [...o!.functionalPerimeter] }) : undefined}
                >
                    <EditableBulletList
                        items={u.functionalPerimeter}
                        originalItems={o?.functionalPerimeter}
                        onChange={editable ? (items) => patch({ functionalPerimeter: items }) : undefined}
                    />
                </Section>
                <Section
                    icon={XCircle}
                    title="Esclusioni"
                    editable={editable}
                    isEdited={isExcEdited}
                    onRestore={isExcEdited ? () => patch({ exclusions: [...o!.exclusions] }) : undefined}
                >
                    <EditableBulletList
                        items={u.exclusions}
                        originalItems={o?.exclusions}
                        onChange={editable ? (items) => patch({ exclusions: items }) : undefined}
                        emptyLabel="Nessuna esclusione identificata"
                    />
                </Section>
            </div>

            {/* Attori */}
            <Section
                icon={Users}
                title="Attori"
                editable={editable}
                isEdited={isActEdited}
                onRestore={isActEdited ? () => patch({ actors: o!.actors.map(a => ({ ...a })) }) : undefined}
            >
                {u.actors.length === 0 && !editable ? (
                    <span className="italic text-slate-400">Nessuno identificato</span>
                ) : (
                    <div className="space-y-0.5">
                        {u.actors.length === 0 && editable && (
                            <span className="italic text-slate-400">Nessuno identificato</span>
                        )}
                        {u.actors.map((a, i) => {
                            const origActor = o?.actors[i];
                            const isActorItemEdited = o != null && (
                                i >= o.actors.length ||
                                a.role !== origActor?.role ||
                                a.interaction !== origActor?.interaction ||
                                a.type !== origActor?.type ||
                                a.interactionMode !== origActor?.interactionMode
                            );
                            return (
                                <div key={i} className="flex items-start gap-1 group/item">
                                    <span className="text-slate-400 mt-px shrink-0 select-none">•</span>
                                    {editable ? (
                                        <>
                                            <div className="flex-1 flex items-baseline gap-1 flex-wrap min-w-0">
                                                <input
                                                    type="text"
                                                    value={a.role}
                                                    onChange={(e) => {
                                                        const actors = u.actors.map((act, idx) =>
                                                            idx === i ? { ...act, role: e.target.value } : act
                                                        );
                                                        patch({ actors });
                                                    }}
                                                    placeholder="Ruolo"
                                                    className={cn(
                                                        'editable-inline bg-transparent border-none p-0 shadow-none font-medium appearance-none',
                                                        'outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none',
                                                        'text-xs leading-relaxed cursor-text',
                                                        'rounded px-1 -mx-1 py-0.5',
                                                        'hover:bg-slate-50 focus:bg-emerald-50/40',
                                                        'transition-colors duration-150',
                                                        isActorItemEdited ? 'text-emerald-700' : 'text-slate-600'
                                                    )}
                                                    style={{ width: `${Math.max(a.role.length + 2, 5)}ch` }}
                                                />
                                                <span className="text-slate-400 select-none">—</span>
                                                <input
                                                    type="text"
                                                    value={a.interaction}
                                                    onChange={(e) => {
                                                        const actors = u.actors.map((act, idx) =>
                                                            idx === i ? { ...act, interaction: e.target.value } : act
                                                        );
                                                        patch({ actors });
                                                    }}
                                                    placeholder="Interazione"
                                                    className={cn(
                                                        'editable-inline flex-1 min-w-0 bg-transparent border-none p-0 shadow-none appearance-none',
                                                        'outline-none focus:ring-0 focus:ring-offset-0 focus:outline-none',
                                                        'text-xs leading-relaxed cursor-text',
                                                        'rounded px-1 -mx-1 py-0.5',
                                                        'hover:bg-slate-50 focus:bg-emerald-50/40',
                                                        'transition-colors duration-150',
                                                        isActorItemEdited ? 'text-emerald-700' : 'text-slate-600'
                                                    )}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => patch({ actors: u.actors.filter((_, idx) => idx !== i) })}
                                                className="shrink-0 opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-red-50 transition-opacity mt-0.5"
                                                title="Rimuovi attore"
                                            >
                                                <X className="w-3 h-3 text-red-400" />
                                            </button>
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-1">
                                            <ActorTypeIcon type={a.type} />
                                            <span className="font-medium">{a.role}</span>
                                            {interactionModeBadge(a.interactionMode)}
                                            <span className="text-slate-400 select-none">—</span>
                                            {a.interaction}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {editable && (
                            <button
                                type="button"
                                onClick={() => patch({ actors: [...u.actors, { type: 'human' as const, role: '', interaction: '' }] })}
                                className="flex items-center gap-0.5 text-[11px] text-emerald-500 hover:text-emerald-700 ml-4 mt-1 transition-colors"
                            >
                                <Plus className="w-3 h-3" />
                                Aggiungi attore
                            </button>
                        )}
                    </div>
                )}
            </Section>

            {/* Transizione di stato */}
            <Section
                icon={ArrowRightLeft}
                title="Transizione di stato"
                editable={editable}
                isEdited={isTraEdited}
                onRestore={isTraEdited ? () => patch({ stateTransition: { ...o!.stateTransition } }) : undefined}
            >
                <div className="space-y-0.5">
                    <div className="flex items-start gap-2">
                        <span className="shrink-0 font-medium text-slate-500 select-none">Da:</span>
                        {editable ? (
                            <div className="flex-1">
                                <EditableText
                                    value={u.stateTransition.initialState}
                                    originalValue={o?.stateTransition.initialState}
                                    isEdited={o != null && u.stateTransition.initialState !== o.stateTransition.initialState}
                                    onChange={(v) => patch({ stateTransition: { ...u.stateTransition, initialState: v } })}
                                />
                            </div>
                        ) : (
                            <span>{u.stateTransition.initialState}</span>
                        )}
                    </div>
                    <div className="flex items-start gap-2 mt-0.5">
                        <span className="shrink-0 font-medium text-slate-500 select-none">A:</span>
                        {editable ? (
                            <div className="flex-1">
                                <EditableText
                                    value={u.stateTransition.finalState}
                                    originalValue={o?.stateTransition.finalState}
                                    isEdited={o != null && u.stateTransition.finalState !== o.stateTransition.finalState}
                                    onChange={(v) => patch({ stateTransition: { ...u.stateTransition, finalState: v } })}
                                />
                            </div>
                        ) : (
                            <span>{u.stateTransition.finalState}</span>
                        )}
                    </div>
                </div>
            </Section>

            {/* Precondizioni & Assunzioni */}
            <div className="grid gap-3 md:grid-cols-2">
                <Section
                    icon={ShieldCheck}
                    title="Precondizioni"
                    editable={editable}
                    isEdited={isPreEdited}
                    onRestore={isPreEdited ? () => patch({ preconditions: [...o!.preconditions] }) : undefined}
                >
                    <EditableBulletList
                        items={u.preconditions}
                        originalItems={o?.preconditions}
                        onChange={editable ? (items) => patch({ preconditions: items }) : undefined}
                    />
                </Section>
                <Section
                    icon={Lightbulb}
                    title="Assunzioni"
                    editable={editable}
                    isEdited={isAssEdited}
                    onRestore={isAssEdited ? () => patch({ assumptions: [...o!.assumptions] }) : undefined}
                >
                    <EditableBulletList
                        items={u.assumptions}
                        originalItems={o?.assumptions}
                        onChange={editable ? (items) => patch({ assumptions: items }) : undefined}
                    />
                </Section>
            </div>

            {/* Complessità + Confidenza (read-only, metadati AI) */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 flex-wrap">
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
                    <span
                        className="text-[11px] text-slate-400 italic ml-auto"
                    >
                        {u.complexityAssessment.rationale}
                    </span>
                )}
            </div>
        </div>
    );
}
