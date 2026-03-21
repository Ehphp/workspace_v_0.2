/**
 * Prompt Management — Admin UI for S4-3 (Prompt Versioning & A/B Testing)
 *
 * Allows admins to:
 *   - View all prompt variants with confidence & usage stats
 *   - Create new variants with traffic split
 *   - Edit prompt content
 *   - Promote best-performing variant
 *   - Compare A/B performance via chart
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Trophy, Edit2, Power, PowerOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/PageShell';

// ── Types ──────────────────────────────────────────────

interface PromptRow {
    id: string;
    prompt_key: string;
    version: number;
    variant: string;
    traffic_pct: number;
    system_prompt: string;
    is_active: boolean;
    usage_count: number;
    avg_confidence: number | null;
    promoted_at: string | null;
    created_at: string;
    updated_at: string;
    description: string | null;
}

// ── Helpers ─────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
}

function buildFunctionUrl(name: string): string {
    return `/.netlify/functions/${name}`;
}

// ── Component ──────────────────────────────────────────

export default function PromptManagement() {
    const navigate = useNavigate();
    const [prompts, setPrompts] = useState<PromptRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedKey, setSelectedKey] = useState<string>('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<PromptRow | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editTrafficPct, setEditTrafficPct] = useState(0);
    const [newVariantOpen, setNewVariantOpen] = useState(false);
    const [newVariantName, setNewVariantName] = useState('');
    const [newVariantContent, setNewVariantContent] = useState('');
    const [newVariantTraffic, setNewVariantTraffic] = useState(10);

    // Fetch prompts
    const fetchPrompts = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(buildFunctionUrl('manage-prompts'), { headers });
            const data = await res.json();
            if (data.success) {
                setPrompts(data.prompts);
                if (!selectedKey && data.prompts.length > 0) {
                    const keys = [...new Set(data.prompts.map((p: PromptRow) => p.prompt_key))];
                    setSelectedKey(keys[0] as string);
                }
            }
        } catch (err) {
            toast.error('Errore nel caricamento dei prompt.');
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchPrompts(); }, []);

    // Unique prompt keys
    const promptKeys = useMemo(() => {
        return [...new Set(prompts.map(p => p.prompt_key))].sort();
    }, [prompts]);

    // Filtered variants for selected key
    const variants = useMemo(() => {
        return prompts
            .filter(p => p.prompt_key === selectedKey)
            .sort((a, b) => {
                if (a.variant === 'default') return -1;
                if (b.variant === 'default') return 1;
                return a.variant.localeCompare(b.variant);
            });
    }, [prompts, selectedKey]);

    // Best variant recommendation
    const bestVariant = useMemo(() => {
        const active = variants.filter(v => v.is_active && v.avg_confidence != null && v.usage_count >= 50);
        if (active.length < 2) return null;
        const sorted = [...active].sort((a, b) => (b.avg_confidence ?? 0) - (a.avg_confidence ?? 0));
        const best = sorted[0];
        const current = variants.find(v => v.variant === 'default');
        if (!current || best.id === current.id) return null;
        const improvement = ((best.avg_confidence ?? 0) - (current.avg_confidence ?? 0)) * 100;
        if (improvement <= 0) return null;
        return { prompt: best, improvement: improvement.toFixed(1) };
    }, [variants]);

    // ── Handlers ──────────────────────────────────────

    const handlePromote = async (promptId: string) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(buildFunctionUrl('manage-prompts/promote'), {
                method: 'POST',
                headers,
                body: JSON.stringify({ promptId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Variante promossa con successo.');
                fetchPrompts();
            } else {
                toast.error(data.error || 'Errore nella promozione.');
            }
        } catch {
            toast.error('Errore di rete.');
        }
    };

    const handleToggleActive = async (promptId: string, currentActive: boolean) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(buildFunctionUrl('manage-prompts'), {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ promptId, is_active: !currentActive }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Prompt ${currentActive ? 'disattivato' : 'attivato'}.`);
                fetchPrompts();
            }
        } catch {
            toast.error('Errore di rete.');
        }
    };

    const handleSaveEdit = async () => {
        if (!editingPrompt) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(buildFunctionUrl('manage-prompts'), {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    promptId: editingPrompt.id,
                    system_prompt: editContent,
                    traffic_pct: editTrafficPct,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Prompt aggiornato.');
                setEditDialogOpen(false);
                fetchPrompts();
            } else {
                toast.error(data.error || 'Errore nell\'aggiornamento.');
            }
        } catch {
            toast.error('Errore di rete.');
        }
    };

    const handleCreateVariant = async () => {
        if (!selectedKey || !newVariantContent) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(buildFunctionUrl('manage-prompts'), {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prompt_key: selectedKey,
                    variant: newVariantName || undefined,
                    system_prompt: newVariantContent,
                    traffic_pct: newVariantTraffic,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Nuova variante creata.');
                setNewVariantOpen(false);
                setNewVariantName('');
                setNewVariantContent('');
                setNewVariantTraffic(10);
                fetchPrompts();
            } else {
                toast.error(data.error || 'Errore nella creazione.');
            }
        } catch {
            toast.error('Errore di rete.');
        }
    };

    // ── Render ────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <PageShell showHeader={false} maxWidth="5xl" contentClassName="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Gestione Prompt AI</h1>
                    <p className="text-muted-foreground text-sm">
                        Versionamento, A/B testing e metriche dei prompt
                    </p>
                </div>
            </div>

            {/* Prompt Key Selector */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <Label className="whitespace-nowrap">Prompt Key:</Label>
                        <Select value={selectedKey} onValueChange={setSelectedKey}>
                            <SelectTrigger className="w-72">
                                <SelectValue placeholder="Seleziona prompt..." />
                            </SelectTrigger>
                            <SelectContent>
                                {promptKeys.map(key => (
                                    <SelectItem key={key} value={key}>{key}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNewVariantOpen(true)}
                            disabled={!selectedKey}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Nuova Variante
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* A/B Recommendation */}
            {bestVariant && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-green-800">
                                    Raccomandazione: variante <strong>{bestVariant.prompt.variant}</strong> ha +{bestVariant.improvement}% di confidence
                                    con {bestVariant.prompt.usage_count} campioni.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handlePromote(bestVariant.prompt.id)}
                            >
                                <Trophy className="h-4 w-4 mr-1" />
                                Promuovi
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Variant Cards */}
            <div className="space-y-4">
                {variants.map(v => (
                    <Card key={v.id} className={!v.is_active ? 'opacity-60' : ''}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base">
                                        Variant: {v.variant}
                                    </CardTitle>
                                    <Badge variant="outline">v{v.version}</Badge>
                                    {v.promoted_at && (
                                        <Badge variant="secondary" className="text-xs">
                                            Promosso
                                        </Badge>
                                    )}
                                    {!v.is_active && (
                                        <Badge variant="destructive" className="text-xs">
                                            Inattivo
                                        </Badge>
                                    )}
                                </div>
                                <Badge variant="outline" className="font-mono">
                                    {v.traffic_pct}% traffico
                                </Badge>
                            </div>
                            {v.description && (
                                <CardDescription>{v.description}</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Confidence</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-semibold">
                                            {v.avg_confidence != null ? v.avg_confidence.toFixed(3) : '—'}
                                        </p>
                                        {v.avg_confidence != null && (
                                            <Progress
                                                value={v.avg_confidence * 100}
                                                className="h-2 flex-1"
                                            />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Utilizzi</p>
                                    <p className="text-lg font-semibold">
                                        {v.usage_count.toLocaleString('it-IT')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Aggiornato</p>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(v.updated_at).toLocaleDateString('it-IT')}
                                    </p>
                                </div>
                            </div>

                            {/* Prompt preview */}
                            <pre className="bg-muted p-3 rounded text-xs max-h-32 overflow-y-auto whitespace-pre-wrap mb-4">
                                {v.system_prompt.substring(0, 300)}
                                {v.system_prompt.length > 300 ? '...' : ''}
                            </pre>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditingPrompt(v);
                                        setEditContent(v.system_prompt);
                                        setEditTrafficPct(v.traffic_pct);
                                        setEditDialogOpen(true);
                                    }}
                                >
                                    <Edit2 className="h-3 w-3 mr-1" />
                                    Modifica
                                </Button>

                                {v.variant !== 'default' && v.is_active && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePromote(v.id)}
                                    >
                                        <Trophy className="h-3 w-3 mr-1" />
                                        Promuovi
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleActive(v.id, v.is_active)}
                                >
                                    {v.is_active
                                        ? <><PowerOff className="h-3 w-3 mr-1" />Disattiva</>
                                        : <><Power className="h-3 w-3 mr-1" />Attiva</>
                                    }
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {variants.length === 0 && selectedKey && (
                    <p className="text-center text-muted-foreground py-8">
                        Nessuna variante trovata per <strong>{selectedKey}</strong>.
                    </p>
                )}
            </div>

            {/* A/B Comparison Chart */}
            {variants.filter(v => v.is_active && v.avg_confidence != null).length >= 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Confronto A/B</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {variants
                                .filter(v => v.is_active)
                                .map(v => (
                                    <div key={v.id} className="flex items-center gap-3">
                                        <span className="text-sm w-20 truncate">{v.variant}</span>
                                        <Progress
                                            value={(v.avg_confidence ?? 0) * 100}
                                            className="h-4 flex-1"
                                        />
                                        <span className="text-sm font-mono w-16 text-right">
                                            {v.avg_confidence != null ? v.avg_confidence.toFixed(3) : '—'}
                                        </span>
                                        <span className="text-xs text-muted-foreground w-20 text-right">
                                            ({v.usage_count} usi)
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Modifica Prompt: {editingPrompt?.prompt_key} / {editingPrompt?.variant}
                        </DialogTitle>
                        <DialogDescription>
                            Modifica il contenuto del prompt o la percentuale di traffico.
                            Il salvataggio crea una nuova versione.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>System Prompt</Label>
                            <Textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="min-h-[300px] font-mono text-xs"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Label>Traffico %</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={editTrafficPct}
                                onChange={e => setEditTrafficPct(Number(e.target.value))}
                                className="w-24"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Annulla
                        </Button>
                        <Button onClick={handleSaveEdit}>Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Variant Dialog */}
            <Dialog open={newVariantOpen} onOpenChange={setNewVariantOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Nuova Variante per: {selectedKey}</DialogTitle>
                        <DialogDescription>
                            Crea una nuova variante A/B per questo prompt. Inizia con un traffico basso (10-20%).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label>Nome Variante (opzionale)</Label>
                            <Input
                                placeholder="Es: B, experimental, v2..."
                                value={newVariantName}
                                onChange={e => setNewVariantName(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>System Prompt</Label>
                            <Textarea
                                value={newVariantContent}
                                onChange={e => setNewVariantContent(e.target.value)}
                                className="min-h-[250px] font-mono text-xs"
                                placeholder="Inserisci il system prompt..."
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <Label>Traffico %</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                value={newVariantTraffic}
                                onChange={e => setNewVariantTraffic(Number(e.target.value))}
                                className="w-24"
                            />
                            <span className="text-xs text-muted-foreground">
                                Consigliato: 10-20% per nuove varianti
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewVariantOpen(false)}>
                            Annulla
                        </Button>
                        <Button onClick={handleCreateVariant} disabled={!newVariantContent}>
                            Crea Variante
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
