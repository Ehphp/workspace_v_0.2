import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
    Brain,
    Calendar,
    Clock,
    Hash,
    Layers,
    Puzzle,
    Sparkles,
    Target,
} from 'lucide-react';
import type { ProjectActivity, ActivityGroup } from '@/types/project-activity';

// ─────────────────────────────────────────────────────────────────────────────
// Color / label maps (shared with ProjectActivitiesTab)
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_BADGE_VARIANTS: Record<ActivityGroup, string> = {
    ANALYSIS: 'bg-amber-100 text-amber-700 border-amber-200',
    DEV: 'bg-blue-100 text-blue-700 border-blue-200',
    TEST: 'bg-green-100 text-green-700 border-green-200',
    OPS: 'bg-purple-100 text-purple-700 border-purple-200',
    GOVERNANCE: 'bg-slate-200 text-slate-700 border-slate-300',
};

const GROUP_LABELS: Record<ActivityGroup, string> = {
    ANALYSIS: 'Analysis',
    DEV: 'Dev',
    TEST: 'Test',
    OPS: 'Ops',
    GOVERNANCE: 'Governance',
};

const INTERVENTION_LABELS: Record<string, string> = {
    NEW: 'New',
    MODIFY: 'Modify',
    CONFIGURE: 'Configure',
    MIGRATE: 'Migrate',
};

const BLUEPRINT_NODE_LABELS: Record<string, string> = {
    component: 'Component',
    dataDomain: 'Data Domain',
    integration: 'Integration',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityDetailSheetProps {
    activity: ProjectActivity | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-2.5">
            <Icon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
                <span className="text-xs text-slate-500 block">{label}</span>
                <span className="text-sm text-slate-800 font-medium">{children}</span>
            </div>
        </div>
    );
}

export function ActivityDetailSheet({ activity, open, onOpenChange }: ActivityDetailSheetProps) {
    if (!activity) return null;

    const effectiveHours = activity.baseHours * activity.effortModifier;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader className="pb-4 border-b">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${GROUP_BADGE_VARIANTS[activity.group]}`}>
                            {GROUP_LABELS[activity.group]}
                        </span>
                        {activity.confidence != null && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                activity.confidence >= 0.8
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : activity.confidence >= 0.6
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-red-50 text-red-500 border-red-200'
                            }`}>
                                {Math.round(activity.confidence * 100)}% confidence
                            </span>
                        )}
                        {!activity.isEnabled && (
                            <Badge variant="secondary" className="text-xs">Disabilitata</Badge>
                        )}
                    </div>
                    <SheetTitle className="text-left text-lg">{activity.name}</SheetTitle>
                    <p className="text-xs font-mono text-slate-400">{activity.code}</p>
                </SheetHeader>

                <div className="py-4 space-y-6">
                    {/* ── Description ─────────────────────────────────── */}
                    {activity.description && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descrizione</h4>
                            <p className="text-sm text-slate-700 leading-relaxed">{activity.description}</p>
                        </div>
                    )}

                    {/* ── Effort Details ──────────────────────────────── */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Effort</h4>
                        <div className="bg-slate-50 rounded-lg p-3 space-y-0.5">
                            <InfoRow icon={Clock} label="Ore Base">{activity.baseHours}h</InfoRow>
                            <InfoRow icon={Target} label="Modificatore">{activity.effortModifier}x</InfoRow>
                            <div className="border-t border-slate-200 mt-1 pt-1">
                                <InfoRow icon={Clock} label="Ore Effettive">
                                    <span className="text-base font-bold text-slate-900">{effectiveHours.toFixed(2)}h</span>
                                </InfoRow>
                            </div>
                        </div>
                    </div>

                    {/* ── Classification ──────────────────────────────── */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Classificazione</h4>
                        <div className="space-y-0.5">
                            <InfoRow icon={Layers} label="Gruppo">{GROUP_LABELS[activity.group]}</InfoRow>
                            <InfoRow icon={Puzzle} label="Tipo Intervento">{INTERVENTION_LABELS[activity.interventionType] ?? activity.interventionType}</InfoRow>
                            <InfoRow icon={Hash} label="Moltiplicatori">
                                SM: {activity.smMultiplier}x · LG: {activity.lgMultiplier}x
                            </InfoRow>
                            {activity.sourceActivityCode && (
                                <InfoRow icon={Hash} label="Attività Sorgente">{activity.sourceActivityCode}</InfoRow>
                            )}
                        </div>
                    </div>

                    {/* ── AI Section ──────────────────────────────────── */}
                    {(activity.aiRationale || activity.blueprintNodeName) && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                Generato da AI
                            </h4>

                            {activity.aiRationale && (
                                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-3">
                                    <div className="flex items-start gap-2">
                                        <Brain className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-xs font-medium text-blue-700 block mb-1">Motivazione AI</span>
                                            <p className="text-sm text-slate-700 leading-relaxed">{activity.aiRationale}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activity.blueprintNodeName && (
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                                    <span className="text-xs font-medium text-indigo-700 block mb-1">Blueprint Collegato</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-800">{activity.blueprintNodeName}</span>
                                        {activity.blueprintNodeType && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium">
                                                {BLUEPRINT_NODE_LABELS[activity.blueprintNodeType] ?? activity.blueprintNodeType}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Metadata ────────────────────────────────────── */}
                    {(activity.createdAt || activity.updatedAt) && (
                        <div className="border-t pt-4">
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                {activity.createdAt && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Creata: {new Date(activity.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                                {activity.updatedAt && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Aggiornata: {new Date(activity.updatedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
