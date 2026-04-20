import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Circle,
    MinusCircle,
    Clock,
    Copy,
    Check,
} from 'lucide-react';
import type { DebugStep, DebugStepStatus } from '@/lib/pipeline-debug-api';

function StatusIcon({ status }: { status: DebugStepStatus }) {
    switch (status) {
        case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'error':   return <XCircle className="h-4 w-4 text-red-500" />;
        case 'running': return <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />;
        case 'skipped': return <MinusCircle className="h-4 w-4 text-slate-400" />;
        default:        return <Circle className="h-4 w-4 text-slate-300" />;
    }
}

function cardBorder(status: DebugStepStatus): string {
    switch (status) {
        case 'success': return 'border-green-200';
        case 'error':   return 'border-red-200 bg-red-50/50';
        case 'running': return 'border-indigo-300 bg-indigo-50/50';
        case 'skipped': return 'border-slate-200 opacity-50';
        default:        return 'border-slate-200';
    }
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            title="Copia JSON"
        >
            {copied
                ? <><Check className="h-2.5 w-2.5 text-green-400" /><span className="text-green-400">Copiato</span></>
                : <><Copy className="h-2.5 w-2.5" /><span>Copia</span></>
            }
        </button>
    );
}

function JsonViewer({ data }: { data: Record<string, unknown> }) {
    const [expanded, setExpanded] = useState(false);
    const text = JSON.stringify(data, null, 2);
    const isLong = text.length > 2000;

    return (
        <div className="relative">
            <div className="flex items-center justify-end px-2 py-1 bg-slate-800 rounded-t-md border-b border-slate-700">
                <CopyButton text={text} />
            </div>
            <pre className={`text-[10px] leading-relaxed font-mono overflow-auto p-3 bg-slate-900 text-slate-100 rounded-b-md whitespace-pre-wrap break-all ${expanded || !isLong ? '' : 'max-h-48'}`}>
                {text}
            </pre>
            {isLong && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                    {expanded ? 'Mostra meno' : `Mostra tutto (${Math.round(text.length / 1024)}kb)`}
                </button>
            )}
        </div>
    );
}

function StepCard({ step, isLast }: { step: DebugStep; isLast: boolean }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'request' | 'response'>('response');
    const hasDetail = !!(step.request || step.response);

    return (
        <div className="relative flex gap-3">
            {!isLast && (
                <div className="absolute left-[13px] top-6 bottom-0 w-px bg-slate-200 z-0" />
            )}

            <div className="relative z-10 mt-1.5 shrink-0">
                <StatusIcon status={step.status} />
            </div>

            <div className={`flex-1 mb-2.5 border rounded-lg overflow-hidden bg-white ${cardBorder(step.status)}`}>
                <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors disabled:cursor-default text-left"
                    onClick={() => hasDetail && setOpen(o => !o)}
                    disabled={!hasDetail}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-slate-700 truncate">{step.label}</span>
                        {step.note && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                {step.note.slice(0, 60)}{step.note.length > 60 ? '…' : ''}
                            </Badge>
                        )}
                        {step.error && !step.note && (
                            <span className="text-[10px] text-red-600 truncate">{step.error}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                        {step.durationMs != null && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{step.durationMs}ms
                            </span>
                        )}
                        {hasDetail && (
                            open
                                ? <ChevronUp className="h-3 w-3 text-slate-400" />
                                : <ChevronDown className="h-3 w-3 text-slate-400" />
                        )}
                    </div>
                </button>

                {open && hasDetail && (
                    <div className="border-t border-slate-200 px-3 py-2.5 space-y-2">
                        <div className="flex gap-1">
                            {(['request', 'response'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    disabled={t === 'request' ? !step.request : !step.response}
                                    className={`text-[10px] px-2.5 py-0.5 rounded font-medium transition-colors disabled:opacity-30 ${
                                        tab === t
                                            ? 'bg-slate-700 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {t === 'request' ? 'Request' : 'Response'}
                                </button>
                            ))}
                        </div>
                        {tab === 'request'  && step.request  && <JsonViewer data={step.request} />}
                        {tab === 'response' && step.response && <JsonViewer data={step.response} />}
                    </div>
                )}
            </div>
        </div>
    );
}

interface FullPipelineTimelineProps {
    steps: DebugStep[];
    totalDurationMs?: number;
}

export function FullPipelineTimeline({ steps, totalDurationMs }: FullPipelineTimelineProps) {
    const errorCount = steps.filter(s => s.status === 'error').length;
    const successCount = steps.filter(s => s.status === 'success').length;

    return (
        <div>
            {totalDurationMs != null && (
                <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1.5">
                        {successCount > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-green-50 text-green-700 border-green-200">
                                {successCount} ok
                            </Badge>
                        )}
                        {errorCount > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-red-50 text-red-700 border-red-200">
                                {errorCount} errori
                            </Badge>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />totale {totalDurationMs}ms
                    </span>
                </div>
            )}
            {steps.map((step, i) => (
                <StepCard key={step.id} step={step} isLast={i === steps.length - 1} />
            ))}
        </div>
    );
}
