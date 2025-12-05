import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import { toast } from 'sonner';
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
    CheckCircle2,
    Shield
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
            const [presetsRes, activitiesRes, driversRes, risksRes, pivotRes] = await Promise.all([
                supabase.from('technology_presets').select('*').order('name'),
                supabase.from('activities').select('*').eq('active', true).order('name'),
                supabase.from('drivers').select('*'),
                supabase.from('risks').select('*'),
                supabase.from('technology_preset_activities').select('tech_preset_id, activity_id, position'),
            ]);

            if (presetsRes.error) throw presetsRes.error;
            if (activitiesRes.error) throw activitiesRes.error;
            if (driversRes.error) throw driversRes.error;
            if (risksRes.error) throw risksRes.error;
            if (pivotRes.error) throw pivotRes.error;

            const activities = activitiesRes.data || [];
            const risks = risksRes.data || [];
            const drivers = driversRes.data || [];

            setAllActivities(activities);
            setAllDrivers(drivers);
            setAllRisks(risks);

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

    // Get unique technology categories from existing presets
    const techCategories = useMemo(() => {
        const categories = new Set(presets.map(p => p.tech_category));
        return Array.from(categories).sort();
    }, [presets]);


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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <motion.div
                animate={{ x: [0, 100, 0], y: [0, -60, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 -left-24 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{ x: [0, -90, 0], y: [0, 60, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-24 w-[28rem] h-[28rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{ x: [0, 60, 0], y: [0, 90, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-0 left-1/3 w-[24rem] h-[24rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />

            <Header />

            <main className="container mx-auto px-4 pt-4 pb-4 max-w-7xl relative z-10 h-[calc(100vh-64px)] flex flex-col">
                <div className="flex flex-col lg:flex-row gap-6 items-start h-full">
                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="space-y-5 relative lg:flex-1 pt-4"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/configuration')}
                            className="absolute -left-2 -top-2 h-9 w-9 rounded-full hover:bg-slate-200/70"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary" className="w-fit px-4 py-1.5 text-sm font-semibold bg-white/80 backdrop-blur-sm border-slate-200 text-slate-700 shadow-sm">
                            <Layers className="w-4 h-4 mr-2 text-blue-600" />
                            Configurazione
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                            Preset Tecnologici
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                                standardizza il lavoro
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed font-medium">
                            Gestisci i template di stima per le diverse tecnologie. Un punto di partenza solido per ogni nuovo progetto.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                {presets.length} preset totali
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                {presets.filter(p => p.is_custom).length} custom
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md border-0"
                                onClick={handleCreate}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Crea nuovo preset
                            </Button>
                        </div>
                    </motion.div>

                    {/* Main Content Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.1, ease: 'easeInOut' }}
                        className="group relative p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl overflow-hidden w-full lg:flex-[1.5] h-full flex flex-col"
                    >
                        <div className="absolute -right-8 -top-8 text-indigo-500/5 pointer-events-none">
                            <Layers className="w-40 h-40" />
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-semibold">
                                        Libreria
                                    </div>
                                    <h2 className="text-2xl font-bold mt-2 leading-tight text-slate-900">Elenco Preset</h2>
                                </div>
                                <div className="flex gap-1 bg-slate-100 rounded-full p-1 border border-slate-200">
                                    <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('ALL')}>
                                        Tutti
                                    </Button>
                                    <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('OOTB')}>
                                        Sistema
                                    </Button>
                                    <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('CUSTOM')}>
                                        Custom
                                    </Button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white/50 flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:thin]">
                                    <Table className="table-fixed w-full">
                                        <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur z-10 shadow-sm">
                                            <TableRow className="hover:bg-slate-100/50 border-slate-200">
                                                <TableHead className="text-slate-700 font-semibold w-[30%]">Nome</TableHead>
                                                <TableHead className="text-slate-700 font-semibold w-[20%]">Categoria</TableHead>
                                                <TableHead className="text-slate-700 font-semibold w-[25%] hidden md:table-cell">Contenuto</TableHead>
                                                <TableHead className="text-right text-slate-700 font-semibold w-[25%]">Azioni</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPresets.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                        Nessun preset trovato
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredPresets.map((preset) => {
                                                    const isOwner = preset.is_custom && preset.created_by === user?.id;
                                                    return (
                                                        <TableRow key={preset.id} className="hover:bg-slate-50/80 border-slate-100">
                                                            <TableCell className="align-top">
                                                                <div className="font-semibold text-slate-900">{preset.name}</div>
                                                                <div className="text-xs text-slate-500 line-clamp-2">{preset.description}</div>
                                                                {preset.is_custom && (
                                                                    <Badge variant="outline" className="mt-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Custom</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="align-top">
                                                                <Badge variant="outline" className="text-xs border-slate-200 text-slate-600 bg-white">{preset.tech_category}</Badge>
                                                            </TableCell>
                                                            <TableCell className="align-top hidden md:table-cell">
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="text-xs text-slate-500">
                                                                        <span className="font-medium text-slate-700">{preset.defaultActivities.length}</span> attività
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {preset.defaultActivities.slice(0, 2).map(a => (
                                                                            <span key={a.id} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                                                                                {a.code}
                                                                            </span>
                                                                        ))}
                                                                        {preset.defaultActivities.length > 2 && (
                                                                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                                                                                +{preset.defaultActivities.length - 2}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right align-top">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                                        onClick={() => setSelectedPreview(preset)}
                                                                        title="Dettagli"
                                                                    >
                                                                        <Info className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                                                        onClick={() => handleDuplicate(preset)}
                                                                        title="Duplica"
                                                                    >
                                                                        <Sparkles className="h-4 w-4" />
                                                                    </Button>
                                                                    {isOwner && (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                                                onClick={() => handleEdit(preset)}
                                                                                title="Modifica"
                                                                            >
                                                                                <Edit3 className="h-4 w-4" />
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                                onClick={() => handleDelete(preset)}
                                                                                title="Elimina"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Edit/Create Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900">{editingId ? 'Modifica Preset' : 'Crea Nuovo Preset'}</DialogTitle>
                        <DialogDescription className="text-slate-500">Configura i dettagli, le attività e i parametri di default.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-700">Nome</Label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Es. Sviluppo Backend Standard"
                                    className="bg-white border-slate-200 focus:bg-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-700">Tecnologia</Label>
                                <Select value={form.techCategory} onValueChange={v => setForm(p => ({ ...p, techCategory: v }))}>
                                    <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {techCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2 space-y-2">
                                <Label className="text-slate-700">Descrizione</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Descrizione del preset..."
                                    rows={2}
                                    className="bg-white border-slate-200 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Activities Configuration */}
                        <div className="space-y-3 border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold text-slate-900">Attività Default</Label>
                                <Select onValueChange={addActivity}>
                                    <SelectTrigger className="w-[250px] bg-white border-slate-200">
                                        <SelectValue placeholder="Aggiungi attività..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <ScrollArea className="h-[200px]">
                                            {allActivities.map(a => (
                                                <SelectItem key={a.id} value={a.id} disabled={!!form.activities.find(fa => fa.id === a.id)}>
                                                    {a.name} ({a.base_hours}h)
                                                </SelectItem>
                                            ))}
                                        </ScrollArea>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2 min-h-[100px] space-y-2">
                                {form.activities.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 py-8">Nessuna attività selezionata</div>
                                ) : (
                                    form.activities.map((act, idx) => (
                                        <div key={act.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center rounded-full p-0 bg-slate-50 border-slate-200 text-slate-600">{idx + 1}</Badge>
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{act.name}</div>
                                                    <div className="text-[10px] text-slate-500">{act.code} • {act.base_hours} ore</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'up')} disabled={idx === 0}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => moveActivity(idx, 'down')} disabled={idx === form.activities.length - 1}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeActivity(idx)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Drivers & Risks */}
                        <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-4">
                            <div className="space-y-3">
                                <Label className="text-base font-semibold text-slate-900">Driver Default</Label>
                                <div className="space-y-2">
                                    {allDrivers.map(d => (
                                        <div key={d.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                                            <span className="font-medium text-slate-700">{d.name}</span>
                                            <Select
                                                value={form.driverValues[d.code] || '_REMOVE_'}
                                                onValueChange={(v) => updateDriverValue(d.code, v)}
                                            >
                                                <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-slate-200">
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
                                <Label className="text-base font-semibold text-slate-900">Rischi Default</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {allRisks.map(r => {
                                        const isSelected = form.riskCodes.includes(r.code);
                                        return (
                                            <div
                                                key={r.id}
                                                className={`cursor-pointer border rounded-lg p-2 text-xs flex items-center gap-2 transition-colors ${isSelected ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
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

                    <DialogFooter className="pt-4 border-t border-slate-100">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-slate-200 text-slate-700">Annulla</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                            {saving ? 'Salvataggio...' : 'Salva Preset'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={!!selectedPreview} onOpenChange={(open) => !open && setSelectedPreview(null)}>
                <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900">{selectedPreview?.name}</DialogTitle>
                        <DialogDescription className="text-slate-500">{selectedPreview?.description}</DialogDescription>
                    </DialogHeader>
                    {selectedPreview && (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Badge variant="outline" className="border-slate-200 text-slate-600">{selectedPreview.tech_category}</Badge>
                                {selectedPreview.is_custom && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Custom</Badge>}
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-slate-900">Attività ({selectedPreview.defaultActivities.length})</h4>
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 max-h-[200px] overflow-y-auto space-y-1">
                                    {selectedPreview.defaultActivities.map((a, i) => (
                                        <div key={i} className="text-sm flex justify-between text-slate-700">
                                            <span>{i + 1}. {a.name}</span>
                                            <span className="text-slate-500 text-xs">{a.base_hours}h</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 text-slate-900">Drivers</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedPreview.driverDefaults.map(d => (
                                            <Badge key={d.code} variant="outline" className="text-xs border-slate-200 text-slate-600">{d.code}: {d.value}</Badge>
                                        ))}
                                        {selectedPreview.driverDefaults.length === 0 && <span className="text-xs text-slate-500">-</span>}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 text-slate-900">Rischi</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {selectedPreview.defaultRisks.map(r => (
                                            <Badge key={r.code} variant="secondary" className="text-xs bg-orange-50 text-orange-800 border border-orange-100">{r.code}</Badge>
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
