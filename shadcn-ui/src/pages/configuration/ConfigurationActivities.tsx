import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles,
    Edit3,
    CheckCircle2,
    ArrowLeft,
    Plus,
    Settings2,
    X,
    Wrench,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { generateActivityCode } from '@/lib/codeGeneration';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Activity } from '@/types/database';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import { motion, AnimatePresence } from 'framer-motion';

const groupOptions = [
    { value: 'ANALYSIS', label: 'Analysis' },
    { value: 'DEV', label: 'Development' },
    { value: 'TEST', label: 'Testing' },
    { value: 'OPS', label: 'Operations' },
    { value: 'GOVERNANCE', label: 'Governance' },
];

const initialForm = {
    name: '',
    description: '',
    baseHours: '1.0',
    techCategory: 'MULTI',
    group: 'DEV',
    active: true,
    baseActivityId: null as string | null,
};

type ViewFilter = 'ALL' | 'OOTB' | 'CUSTOM';

export default function ConfigurationActivities() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [technologies, setTechnologies] = useState<{ value: string; label: string }[]>([]);
    const [saving, setSaving] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [form, setForm] = useState(initialForm);
    const [editActivity, setEditActivity] = useState<Activity | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [filterTech, setFilterTech] = useState<string>('ALL');
    const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');
    const [visibleColumns, setVisibleColumns] = useState({
        codice: false,
        nome: true,
        tecnologia: true,
        fase: true,
        origine: false,
        peso: true,
    });

    useEffect(() => {
        if (user) {
            loadActivities();
            loadTechnologies();
        }
    }, [user]);

    const loadTechnologies = async () => {
        const { data } = await supabase
            .from('technology_presets')
            .select('tech_category, name')
            .order('sort_order');

        if (data && data.length > 0) {
            const uniqueTechs = Array.from(
                new Map(data.map(t => [t.tech_category, t.name])).entries()
            ).map(([value, label]) => ({ value, label }));
            setTechnologies(uniqueTechs);
        } else {
            setTechnologies([
                { value: 'POWER_PLATFORM', label: 'Power Platform' },
                { value: 'BACKEND', label: 'Backend API' },
                { value: 'FRONTEND', label: 'Frontend' },
                { value: 'USU', label: 'USU' },
                { value: 'MULTI', label: 'Multi-stack' },
            ]);
        }
    };

    const loadActivities = async () => {
        setFetching(true);
        const { data, error } = await supabase
            .from('activities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading activities', error);
            toast.error('Impossibile caricare le attivita');
        } else {
            setActivities(data || []);
        }
        setFetching(false);
    };

    const customActivities = useMemo(
        () => activities.filter((a) => a.is_custom),
        [activities]
    );

    const activityRows = useMemo(() => {
        let list = activities;
        if (viewFilter === 'OOTB') {
            list = list.filter((a) => !a.is_custom);
        } else if (viewFilter === 'CUSTOM') {
            list = list.filter((a) => a.is_custom);
        }
        if (filterTech !== 'ALL') {
            list = list.filter((a) => a.tech_category === filterTech || a.tech_category === 'MULTI');
        }
        return list;
    }, [activities, filterTech, viewFilter]);

    const canEdit = (activity: Activity) => {
        if (!user) return false;
        if (!activity.created_by) return false;
        return activity.created_by === user.id;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const baseHours = Number(form.baseHours);

        if (!form.name.trim()) {
            toast.error('Nome obbligatorio');
            return;
        }

        if (!Number.isFinite(baseHours) || baseHours <= 0) {
            toast.error('Peso non valido', {
                description: 'Inserisci un numero di ore maggiore di zero',
            });
            return;
        }

        setSaving(true);
        try {
            if (editActivity) {
                if (!canEdit(editActivity)) {
                    throw new Error('Non hai i permessi per modificare questa attivita');
                }

                const { error } = await supabase
                    .from('activities')
                    .update({
                        name: form.name,
                        description: form.description,
                        base_hours: baseHours,
                        tech_category: form.techCategory,
                        group: form.group,
                        active: form.active,
                    })
                    .eq('id', editActivity.id);

                if (error) throw error;

                toast.success('Attivita aggiornata', {
                    description: `${form.name} - ${baseHours.toFixed(2)} ore`,
                });
                setEditActivity(null);
            } else {
                const generatedCode = generateActivityCode(
                    form.name,
                    form.techCategory,
                    activities.map(a => a.code)
                );
                const { error } = await supabase.from('activities').insert({
                    code: generatedCode,
                    name: form.name,
                    description: form.description,
                    base_hours: baseHours,
                    tech_category: form.techCategory,
                    group: form.group,
                    active: form.active,
                    is_custom: true,
                    base_activity_id: form.baseActivityId,
                    created_by: user?.id || null,
                });

                if (error) throw error;

                toast.success('Attivita creata', {
                    description: `${generatedCode} - ${baseHours.toFixed(2)} ore`,
                });
            }

            setForm(initialForm);
            setShowForm(false);
            await loadActivities();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Riprovare tra qualche secondo';
            toast.error('Errore durante il salvataggio', {
                description: message,
            });
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (activity: Activity) => {
        setEditActivity(activity);
        setShowForm(true);
        setForm({
            name: activity.name,
            description: activity.description || '',
            baseHours: activity.base_hours.toString(),
            techCategory: activity.tech_category,
            group: activity.group,
            active: activity.active,
            baseActivityId: activity.base_activity_id || null,
        });
    };

    const handleCancelEdit = () => {
        setEditActivity(null);
        setForm(initialForm);
        setShowForm(false);
    };

    const handleDuplicate = (activity: Activity) => {
        setEditActivity(null);
        setShowForm(true);
        setForm({
            name: activity.name + ' (Copy)',
            description: activity.description || '',
            baseHours: activity.base_hours.toString(),
            techCategory: activity.tech_category,
            group: activity.group,
            active: true,
            baseActivityId: activity.id,
        });
        toast.message('Duplicazione pronta', {
            description: 'Modifica e salva come nuova attivita custom.',
        });
    };

    const handleNewActivity = () => {
        setEditActivity(null);
        setForm(initialForm);
        setShowForm(true);
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
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-[2]" />
            {/* Animated Background Blobs */}
            <motion.div
                animate={{ x: [0, 100, 0], y: [0, -60, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 -left-24 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
            />
            <motion.div
                animate={{ x: [0, -90, 0], y: [0, 60, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-24 w-[28rem] h-[28rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
            />
            <motion.div
                animate={{ x: [0, 60, 0], y: [0, 90, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-0 left-1/3 w-[24rem] h-[24rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
            />

            <Header />

            <main className="container mx-auto px-4 pt-4 pb-4 max-w-6xl relative z-10 h-[calc(100vh-64px)] flex flex-col">
                {/* Main Content Card - Full Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="group relative p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl overflow-hidden w-full h-full flex flex-col"
                >
                    <div className="absolute -right-8 -top-8 text-indigo-500/5 pointer-events-none">
                        <Wrench className="w-40 h-40" />
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                        {/* Header Section - Matching Dialog Style */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/configuration')}
                                    className="h-8 w-8 rounded-full hover:bg-slate-100"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h1 className="text-base font-semibold text-slate-900">Catalogo Attività</h1>
                                    <p className="text-xs text-slate-500">Gestisci le attività base per le stime. Crea custom o duplica quelle di sistema.</p>
                                </div>
                            </div>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-xs h-8"
                                onClick={handleNewActivity}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                Nuova Attività
                            </Button>
                        </div>

                        {/* Creation/Edit Form - Collapsible */}
                        <AnimatePresence>
                            {showForm && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden shrink-0"
                                >
                                    <form onSubmit={handleSubmit} className="py-4 border-b border-slate-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">
                                                    {editActivity ? '✎' : '+'}
                                                </span>
                                                {editActivity ? 'Modifica Attività' : 'Nuova Attività'}
                                            </h3>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-slate-400 hover:text-slate-600"
                                                onClick={handleCancelEdit}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-12 gap-3">
                                            {/* Nome - 4 cols */}
                                            <div className="col-span-4 space-y-1">
                                                <Label className="text-[10px] font-medium text-slate-500">Nome *</Label>
                                                <Input
                                                    value={form.name}
                                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                                    placeholder="Es. API security review"
                                                    required
                                                    className="h-8 text-xs bg-white/80 border-slate-200"
                                                />
                                            </div>

                                            {/* Tecnologia - 2 cols */}
                                            <div className="col-span-2 space-y-1">
                                                <Label className="text-[10px] font-medium text-slate-500">Tecnologia</Label>
                                                <Select
                                                    value={form.techCategory}
                                                    onValueChange={(value) => setForm((prev) => ({ ...prev, techCategory: value }))}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-white/80 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {technologies.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Fase - 2 cols */}
                                            <div className="col-span-2 space-y-1">
                                                <Label className="text-[10px] font-medium text-slate-500">Fase</Label>
                                                <Select
                                                    value={form.group}
                                                    onValueChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-white/80 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {groupOptions.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Peso - 1.5 cols */}
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] font-medium text-slate-500">Ore</Label>
                                                <Input
                                                    type="number"
                                                    step="0.5"
                                                    min="0.5"
                                                    value={form.baseHours}
                                                    onChange={(e) => setForm((prev) => ({ ...prev, baseHours: e.target.value }))}
                                                    required
                                                    className="h-8 text-xs font-semibold bg-white/80 border-slate-200"
                                                />
                                            </div>

                                            {/* Stato - 1.5 cols */}
                                            <div className="col-span-1 space-y-1">
                                                <Label className="text-[10px] font-medium text-slate-500">Stato</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className={`w-full h-8 text-xs justify-between px-2 ${form.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                    onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                                                >
                                                    {form.active ? 'ON' : 'OFF'}
                                                </Button>
                                            </div>

                                            {/* Azioni - 2 cols */}
                                            <div className="col-span-2 flex items-end gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs border-slate-200"
                                                    onClick={handleCancelEdit}
                                                >
                                                    Annulla
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white flex-1"
                                                    disabled={saving}
                                                >
                                                    {saving ? '...' : editActivity ? 'Salva' : 'Crea'}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Description - optional */}
                                        <div className="mt-2">
                                            <Textarea
                                                value={form.description}
                                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                                placeholder="Descrizione opzionale..."
                                                rows={2}
                                                className="text-xs bg-white/80 border-slate-200 resize-none"
                                            />
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Stats & Filters Row */}
                        <div className="flex items-center justify-between py-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    {activities.length} totali
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    {customActivities.length} custom
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filters */}
                                <div className="flex gap-1 bg-slate-100 rounded-full p-0.5 border border-slate-200">
                                    <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-6 px-2.5 text-[11px] rounded-full" onClick={() => setViewFilter('ALL')}>
                                        Tutti
                                    </Button>
                                    <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-6 px-2.5 text-[11px] rounded-full" onClick={() => setViewFilter('OOTB')}>
                                        Sistema
                                    </Button>
                                    <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-6 px-2.5 text-[11px] rounded-full" onClick={() => setViewFilter('CUSTOM')}>
                                        Custom
                                    </Button>
                                </div>

                                {/* Tech Filter */}
                                <Select value={filterTech} onValueChange={setFilterTech}>
                                    <SelectTrigger className="w-[140px] h-7 text-[11px] bg-white border-slate-200">
                                        <SelectValue placeholder="Tecnologia" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL" className="text-xs">Tutte</SelectItem>
                                        {technologies.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Column Picker */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 gap-1.5 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] px-2">
                                            <Settings2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[160px]">
                                        <DropdownMenuLabel className="text-xs">Colonne</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={visibleColumns.codice} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, codice: c }))} className="text-xs">
                                            Codice
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.nome} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, nome: c }))} className="text-xs">
                                            Nome
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.tecnologia} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, tecnologia: c }))} className="text-xs">
                                            Tecnologia
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.fase} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, fase: c }))} className="text-xs">
                                            Fase
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.origine} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, origine: c }))} className="text-xs">
                                            Origine
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.peso} onCheckedChange={(c) => setVisibleColumns(p => ({ ...p, peso: c }))} className="text-xs">
                                            Peso
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-2 py-0.5">
                                    {activityRows.length}
                                </Badge>
                            </div>
                        </div>

                        {/* Table Section */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/30 flex-1 overflow-hidden flex flex-col min-h-0">
                            <div className="overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:thin]">
                                <Table className="table-fixed w-full">
                                    <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm">
                                        <TableRow className="hover:bg-slate-100/50 border-slate-200">
                                            {visibleColumns.codice && <TableHead className="text-slate-700 font-semibold text-xs w-[12%]">Codice</TableHead>}
                                            {visibleColumns.nome && <TableHead className="text-slate-700 font-semibold text-xs w-[35%]">Nome</TableHead>}
                                            {visibleColumns.tecnologia && <TableHead className="text-slate-700 font-semibold text-xs w-[15%]">Tech</TableHead>}
                                            {visibleColumns.fase && <TableHead className="text-slate-700 font-semibold text-xs w-[12%]">Fase</TableHead>}
                                            {visibleColumns.origine && <TableHead className="text-slate-700 font-semibold text-xs w-[10%]">Tipo</TableHead>}
                                            {visibleColumns.peso && <TableHead className="text-slate-700 font-semibold text-xs w-[8%]">Ore</TableHead>}
                                            <TableHead className="text-right text-slate-700 font-semibold text-xs w-[8%]">Azioni</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fetching ? (
                                            <TableRow>
                                                <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-12 text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                        <p className="text-sm">Caricamento...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : activityRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-12 text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Wrench className="w-8 h-8 opacity-30" />
                                                        <p className="text-sm">Nessuna attività trovata</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activityRows.map((activity) => {
                                                const editable = canEdit(activity);
                                                const isCustom = !!activity.is_custom;
                                                const baseRef = activity.base_activity_id
                                                    ? activities.find((a) => a.id === activity.base_activity_id)
                                                    : null;

                                                return (
                                                    <TableRow key={activity.id} className="hover:bg-slate-50/80 border-slate-100">
                                                        {visibleColumns.codice && (
                                                            <TableCell className="font-mono text-[11px] text-slate-600 truncate">{activity.code}</TableCell>
                                                        )}
                                                        {visibleColumns.nome && (
                                                            <TableCell>
                                                                <div className="text-xs font-medium text-slate-900">{activity.name}</div>
                                                                {activity.description && (
                                                                    <div className="text-[10px] text-slate-500 line-clamp-1">{activity.description}</div>
                                                                )}
                                                                {baseRef && (
                                                                    <div className="text-[9px] text-slate-400">da {baseRef.code}</div>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                        {visibleColumns.tecnologia && (
                                                            <TableCell className="text-[11px] text-slate-600">
                                                                {technologies.find((t) => t.value === activity.tech_category)?.label || activity.tech_category}
                                                            </TableCell>
                                                        )}
                                                        {visibleColumns.fase && (
                                                            <TableCell className="text-[11px] text-slate-600">
                                                                {groupOptions.find((g) => g.value === activity.group)?.label || activity.group}
                                                            </TableCell>
                                                        )}
                                                        {visibleColumns.origine && (
                                                            <TableCell>
                                                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${isCustom ? 'bg-amber-50 text-amber-700 border-amber-200' : 'text-slate-500 border-slate-200'}`}>
                                                                    {isCustom ? 'Custom' : 'OOTB'}
                                                                </Badge>
                                                            </TableCell>
                                                        )}
                                                        {visibleColumns.peso && (
                                                            <TableCell>
                                                                <span className="text-sm font-semibold text-slate-700">{activity.base_hours}</span>
                                                                <span className="text-[10px] text-slate-400 ml-0.5">h</span>
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-0.5">
                                                                {isCustom && editable && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                                        onClick={() => openEdit(activity)}
                                                                        title="Modifica"
                                                                    >
                                                                        <Edit3 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                                                    onClick={() => handleDuplicate(activity)}
                                                                    title="Duplica"
                                                                >
                                                                    <Sparkles className="h-3.5 w-3.5" />
                                                                </Button>
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
            </main>
        </div>
    );
}
