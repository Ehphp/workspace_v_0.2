import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TechnologyPreset, Activity, Driver, Risk, Technology } from '@/types/database';
import { toast } from 'sonner';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    RefreshCw,
    Info,
    Layers,
    LayoutList,
    AlertTriangle,
    Settings,
    Plus,
    Edit3,
    Trash2,
    Sparkles,
    ArrowLeft,
    X,
    ArrowUp,
    ArrowDown,
    CheckCircle2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PresetView extends TechnologyPreset {
    defaultActivities: Activity[];
    defaultRisks: Risk[];
    driverDefaults: { code: string; value: string }[];
}

interface PresetForm {
    name: string;
    description: string;
    techCategory: string;
    activities: Activity[]; // Ordered list
    driverValues: Record<string, string>;
    riskCodes: string[];
}

const initialForm: PresetForm = {
    name: '',
    description: '',
    techCategory: 'MULTI',
    activities: [],
    driverValues: {},
    riskCodes: [],
};

export default function ConfigurationPresets() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [presets, setPresets] = useState<PresetView[]>([]);
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
    const [allRisks, setAllRisks] = useState<Risk[]>([]);

    // UI State
    const [viewFilter, setViewFilter] = useState<'ALL' | 'OOTB' | 'CUSTOM'>('ALL');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PresetForm>(initialForm);
    const [selectedPreview, setSelectedPreview] = useState<PresetView | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [presetsRes, activitiesRes, driversRes, risksRes, pivotRes, techRes] = await Promise.all([
                supabase.from('technology_presets').select('*').order('name'),
                supabase.from('activities').select('*').eq('active', true).order('name'),
                supabase.from('drivers').select('*'),
                supabase.from('risks').select('*'),
                supabase.from('technology_preset_activities').select('tech_preset_id, activity_id, position'),
                supabase.from('technologies').select('*').order('sort_order'),
            ]);

            if (presetsRes.error) throw presetsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;
            if (driversRes.error) throw driversRes.error;
            if (risksRes.error) throw risksRes.error;
            if (pivotRes.error) throw pivotRes.error;

            const activities = activitiesRes.data || [];
            const risks = risksRes.data || [];
            const drivers = driversRes.data || [];
            const loadedTechnologies = techRes.data || [];

            setAllActivities(activities);
            setAllDrivers(drivers);
            setAllRisks(risks);
            setTechnologies(loadedTechnologies);

            const activityById = new Map<string, Activity>();
            activities.forEach((a) => activityById.set(a.id, a));

            const pivotByPreset = new Map<string, { activity_id: string; position: number | null }[]>();
            ((pivotRes.data as { tech_preset_id: string; activity_id: string; position: number | null }[] | null) || []).forEach((row) => {
                if (!pivotByPreset.has(row.tech_preset_id)) {
                    pivotByPreset.set(row.tech_preset_id, []);
                }
                pivotByPreset.get(row.tech_preset_id)!.push({
                    activity_id: row.activity_id,
                    position: row.position ?? null,
                });
            });

            const presetViews: PresetView[] = (presetsRes.data || []).map((p) => {
                const pivots = pivotByPreset.get(p.id) || [];
                const defaultActivities = pivots
                    .sort((a, b) => {
                        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
                        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
                        return pa - pb;
                    })
                    .map((row) => activityById.get(row.activity_id))
                    .filter((a): a is Activity => Boolean(a));

                const driverDefaults = Object.entries(p.default_driver_values || {}).map(([code, value]) => ({ code, value }));
                const defaultRisks = risks.filter((r) => p.default_risks?.includes(r.code));

                return {
                    ...p,
                    defaultActivities,
                    driverDefaults,
                    defaultRisks,
                    default_activity_codes: defaultActivities.map((a) => a.code),
                };
            });

            setPresets(presetViews);
        } catch (err) {
            console.error('Failed to load presets', err);
            const message = err instanceof Error ? err.message : 'Failed to load presets';
            setError(message);
            toast.error('Errore caricamento dati', { description: message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const filteredPresets = useMemo(() => {
        let list = presets;
        if (viewFilter === 'OOTB') list = list.filter(p => !p.is_custom);
        if (viewFilter === 'CUSTOM') list = list.filter(p => p.is_custom);
        return list;
    }, [presets, viewFilter]);

    const stats = useMemo(() => {
        const perCategory = presets.reduce<Record<string, number>>((acc, p) => {
            acc[p.tech_category] = (acc[p.tech_category] || 0) + 1;
            return acc;
        }, {});
        const avgActivities = presets.length
            ? Math.round(
                presets.reduce((sum, p) => sum + (p.defaultActivities?.length || 0), 0) / presets.length
            )
            : 0;
        return { perCategory, avgActivities };
    }, [presets]);

    const getTechLabel = (code: string) => {
        const tech = technologies.find(t => t.code === code);
        return tech ? tech.name : code;
    };

    const handleCreate = () => {
        setEditingId(null);
        setForm(initialForm);
        setIsDialogOpen(true);
    };

    const handleEdit = (preset: PresetView) => {
        if (!preset.is_custom || preset.created_by !== user?.id) {
            toast.error('Non puoi modificare questo preset');
            return;
        }
        setEditingId(preset.id);
        setForm({
            name: preset.name,
            description: preset.description || '',
            techCategory: preset.tech_category,
            activities: preset.defaultActivities,
            driverValues: preset.default_driver_values || {},
            riskCodes: preset.default_risks || [],
        });
        setIsDialogOpen(true);
    };

    const handleDuplicate = (preset: PresetView) => {
        setEditingId(null);
        setForm({
            name: `${preset.name} (Copy)`,
            description: preset.description || '',
            techCategory: preset.tech_category,
            activities: [...preset.defaultActivities],
            driverValues: { ...preset.default_driver_values },
            riskCodes: [...preset.default_risks],
        });
        setIsDialogOpen(true);
        toast.message('Preset duplicato', { description: 'Modifica e salva il nuovo preset custom.' });
    };

    const handleDelete = async (preset: PresetView) => {
        if (!confirm('Sei sicuro di voler eliminare questo preset?')) return;

        try {
            const { error } = await supabase
                .from('technology_presets')
                .delete()
                .eq('id', preset.id)
                .eq('created_by', user?.id || '');

            if (error) throw error;

            toast.success('Preset eliminato');
            loadData();
        } catch (err) {
            toast.error('Errore eliminazione', { description: err instanceof Error ? err.message : 'Errore sconosciuto' });
        }
    };

    const generateCode = (name: string) => {
        return name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Il nome è obbligatorio');
            return;
        }

        setSaving(true);
        try {
            let presetId = editingId;

            const presetData = {
                name: form.name,
                description: form.description,
                tech_category: form.techCategory,
                default_driver_values: form.driverValues,
                default_risks: form.riskCodes,
                default_activity_codes: form.activities.map(a => a.code),
                is_custom: true,
                created_by: user?.id
            };

            if (editingId) {
                // Update
                const { error } = await supabase
                    .from('technology_presets')
                    .update(presetData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                // Create
                const code = generateCode(form.name);
                const { data, error } = await supabase
                    .from('technology_presets')
                    .insert({ ...presetData, code })
                    .select('id')
                    .single();
                if (error) throw error;
                presetId = data.id;
            }

            // Handle Activities (Join Table)
            if (presetId) {
                // 1. Delete existing
                if (editingId) {
                    await supabase
                        .from('technology_preset_activities')
                        .delete()
                        .eq('tech_preset_id', presetId);
                }

                // 2. Insert new
                if (form.activities.length > 0) {
                    const rows = form.activities.map((a, idx) => ({
                        tech_preset_id: presetId,
                        activity_id: a.id,
                        position: idx + 1
                    }));
                    const { error } = await supabase
                        .from('technology_preset_activities')
                        .insert(rows);
                    if (error) throw error;
                }
            }

            toast.success(editingId ? 'Preset aggiornato' : 'Preset creato');
            setIsDialogOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Errore salvataggio', { description: err instanceof Error ? err.message : 'Errore sconosciuto' });
        } finally {
            setSaving(false);
        }
    };

    // Form Helpers
    const addActivity = (activityId: string) => {
        const activity = allActivities.find(a => a.id === activityId);
        if (activity && !form.activities.find(a => a.id === activityId)) {
            setForm(prev => ({ ...prev, activities: [...prev.activities, activity] }));
        }
    };

    const removeActivity = (index: number) => {
        setForm(prev => ({
            ...prev,
            activities: prev.activities.filter((_, i) => i !== index)
        }));
    };

    const moveActivity = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === form.activities.length - 1) return;

        const newActivities = [...form.activities];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newActivities[index], newActivities[targetIndex]] = [newActivities[targetIndex], newActivities[index]];

        setForm(prev => ({ ...prev, activities: newActivities }));
    };

    const toggleRisk = (riskCode: string) => {
        setForm(prev => {
            const exists = prev.riskCodes.includes(riskCode);
            return {
                ...prev,
                riskCodes: exists
                    ? prev.riskCodes.filter(c => c !== riskCode)
                    : [...prev.riskCodes, riskCode]
            };
        });
    };

    const updateDriverValue = (driverCode: string, value: string) => {
        setForm(prev => {
            const newValues = { ...prev.driverValues };
            if (value === '_REMOVE_') {
                delete newValues[driverCode];
            } else {
                newValues[driverCode] = value;
            }
            return { ...prev, driverValues: newValues };
        });
    };

    return (
        <div className="min-h-screen h-screen flex flex-col bg-syntero-gradient overflow-hidden">
            <div className="flex-shrink-0">
                <Header />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="container mx-auto px-6 py-4 h-full flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 flex-shrink-0">
                        <div>
                            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 mb-1">
                                <Layers className="h-3 w-3 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-700">Configurazione</span>
                            </div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">Preset Tecnologici</h1>
                            <p className="text-xs text-slate-600">Gestisci i template di stima per le diverse tecnologie.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" onClick={() => navigate('/configuration/technologies')}>
                                <Settings className="h-4 w-4 mr-2" />
                                Tecnologie
                            </Button>
                            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Aggiorna
                            </Button>
                            <Button variant="default" size="sm" onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" />
                                Crea Preset
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/configuration')}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Indietro
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
                        <Card className="bg-white/80 border-slate-200">
                            <CardHeader className="pb-2 py-2">
                                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-blue-600" />
                                    Preset totali
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-end gap-4 py-2">
                                <div className="text-2xl font-bold text-slate-900">{presets.length}</div>
                                <div className="flex flex-wrap gap-1 text-xs text-slate-700">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                        Custom: {presets.filter(p => p.is_custom).length}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                        {/* More stats if needed */}
                    </div>

                    {/* Main List */}
                    <Card className="bg-white/85 border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
                        <CardHeader className="flex-shrink-0 py-3 bg-white/50 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-900">Elenco Preset</CardTitle>
                                <CardDescription className="text-xs text-slate-600">
                                    Visualizza e gestisci i preset disponibili.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex gap-1 bg-slate-100 rounded-full p-1">
                                    <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('ALL')}>Tutti</Button>
                                    <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('OOTB')}>Sistema</Button>
                                    <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('CUSTOM')}>Custom</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-hidden flex-1 p-0 flex flex-col">
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow className="hover:bg-white">
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Attività</TableHead>
                                            <TableHead>Driver/Rischi</TableHead>
                                            <TableHead className="text-right">Azioni</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPresets.map((preset) => {
                                            const isOwner = preset.is_custom && preset.created_by === user?.id;
                                            return (
                                                <TableRow key={preset.id}>
                                                    <TableCell>
                                                        <div className="font-semibold text-slate-900">{preset.name}</div>
                                                        <div className="text-xs text-slate-500">{preset.description}</div>
                                                        {preset.is_custom && (
                                                            <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Custom</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">{getTechLabel(preset.tech_category)}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                                                            {preset.defaultActivities.slice(0, 3).map(a => (
                                                                <Badge key={a.id} variant="secondary" className="text-[10px]">{a.code}</Badge>
                                                            ))}
                                                            {preset.defaultActivities.length > 3 && (
                                                                <Badge variant="outline" className="text-[10px]">+{preset.defaultActivities.length - 3}</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-[10px] text-slate-500">Drivers: {preset.driverDefaults.length}</div>
                                                            <div className="text-[10px] text-slate-500">Rischi: {preset.defaultRisks.length}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => setSelectedPreview(preset)} title="Dettagli">
                                                                <Info className="h-4 w-4 text-slate-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDuplicate(preset)} title="Duplica">
                                                                <Sparkles className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            {isOwner && (
                                                                <>
                                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(preset)} title="Modifica">
                                                                        <Edit3 className="h-4 w-4 text-emerald-600" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(preset)} title="Elimina">
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Modifica Preset' : 'Crea Nuovo Preset'}</DialogTitle>
                        <DialogDescription>Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Es. Sviluppo Backend Standard" />
                            </div>
                            <div className="space-y-2">
                                <Label>Tecnologia</Label>
                                <Select value={form.techCategory} onValueChange={v => setForm(p => ({ ...p, techCategory: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {technologies.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label>Descrizione</Label>
                                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descrizione del preset..." rows={2} />
                            </div>
                        </div>

                        {/* Activities Configuration */}
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Attività Default</Label>
                                <Select onValueChange={addActivity}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Aggiungi attività..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <ScrollArea className="h-[200px]">
                                            {allActivities.map(a => (
                                                <SelectItem key={a.id} value={a.id} disabled={!!form.activities.find(fa => fa.id === a.id)}>
                                                    {a.name} ({a.base_days}d)
                                                </SelectItem>
                                            ))}
                                        </ScrollArea>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 rounded-md border p-2 min-h-[100px] space-y-2">
                                {form.activities.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 py-8">Nessuna attività selezionata</div>
                                ) : (
                                    form.activities.map((act, idx) => (
                                        <div key={act.id} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0">{idx + 1}</Badge>
                                                <div>
                                                    <div className="text-sm font-medium">{act.name}</div>
                                                    <div className="text-[10px] text-slate-500">{act.code} • {act.base_days} giorni</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveActivity(idx, 'down')} disabled={idx === form.activities.length - 1}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => removeActivity(idx)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Drivers & Risks */}
                        <div className="grid md:grid-cols-2 gap-6 border-t pt-4">
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Driver Default</Label>
                                <div className="space-y-2">
                                    {allDrivers.map(d => (
                                        <div key={d.id} className="flex items-center justify-between text-sm border-b pb-2">
                                            <span className="font-medium text-slate-700">{d.name}</span>
                                            <Select
                                                value={form.driverValues[d.code] || '_REMOVE_'}
                                                onValueChange={(v) => updateDriverValue(d.code, v)}
                                            >
                                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="_REMOVE_">-- Nessuno --</SelectItem>
                                                    {d.options.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Rischi Default</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {allRisks.map(r => {
                                        const isSelected = form.riskCodes.includes(r.code);
                                        return (
                                            <div
                                                key={r.id}
                                                className={`cursor-pointer border rounded p-2 text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-orange-50 border-orange-200' : 'hover:bg-slate-50'}`}
                                                onClick={() => toggleRisk(r.code)}
                                            >
                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'}`}>
                                                    {isSelected && <CheckCircle2 className="h-2 w-2 text-white" />}
                                                </div>
                                                <span className={isSelected ? 'font-medium text-orange-900' : 'text-slate-600'}>{r.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? 'Salvataggio...' : 'Salva Preset'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={!!selectedPreview} onOpenChange={(open) => !open && setSelectedPreview(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedPreview?.name}</DialogTitle>
                        <DialogDescription>{selectedPreview?.description}</DialogDescription>
                    </DialogHeader>
                    {selectedPreview && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Badge variant="outline">{getTechLabel(selectedPreview.tech_category)}</Badge>
                                {selectedPreview.is_custom && <Badge className="bg-amber-100 text-amber-800">Custom</Badge>}
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Attività ({selectedPreview.defaultActivities.length})</h4>
                                <div className="bg-slate-50 p-2 rounded border max-h-[200px] overflow-y-auto space-y-1">
                                    {selectedPreview.defaultActivities.map((a, i) => (
                                        <div key={i} className="text-sm flex justify-between">
                                            <span>{i + 1}. {a.name}</span>
                                            <span className="text-slate-500 text-xs">{a.base_days}d</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Drivers</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedPreview.driverDefaults.map(d => (
                                            <Badge key={d.code} variant="outline" className="text-xs">{d.code}: {d.value}</Badge>
                                        ))}
                                        {selectedPreview.driverDefaults.length === 0 && <span className="text-xs text-slate-500">-</span>}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Rischi</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedPreview.defaultRisks.map(r => (
                                            <Badge key={r.code} variant="secondary" className="text-xs bg-orange-50 text-orange-800">{r.code}</Badge>
                                        ))}
                                        {selectedPreview.defaultRisks.length === 0 && <span className="text-xs text-slate-500">-</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
