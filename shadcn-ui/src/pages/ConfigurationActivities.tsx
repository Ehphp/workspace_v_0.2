import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Sparkles,
  Wrench,
  Edit3,
  CheckCircle2,
  Settings2,
  ArrowLeft,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { generateActivityCode } from '@/lib/codeGeneration';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Activity } from '@/types/database';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  baseDays: '1.0',
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
  const [activeTab, setActiveTab] = useState<'create' | 'catalog'>('create');
  const [showDescription, setShowDescription] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [filterTech, setFilterTech] = useState<string>('ALL');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');
  const [visibleColumns, setVisibleColumns] = useState({
    codice: false,
    nome: true,
    tecnologia: false,
    fase: false,
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
      .from('technologies')
      .select('code, name')
      .order('sort_order');

    if (data && data.length > 0) {
      setTechnologies(data.map(t => ({ value: t.code, label: t.name })));
    } else {
      setTechnologies([
        { value: 'POWER_PLATFORM', label: 'Power Platform' },
        { value: 'BACKEND', label: 'Backend API' },
        { value: 'FRONTEND', label: 'Frontend' },
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
    const baseDays = Number(form.baseDays);

    if (!form.name.trim()) {
      toast.error('Nome obbligatorio');
      return;
    }

    if (!Number.isFinite(baseDays) || baseDays <= 0) {
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
            base_days: baseDays,
            tech_category: form.techCategory,
            group: form.group,
            active: form.active,
          })
          .eq('id', editActivity.id);

        if (error) throw error;

        toast.success('Attivita aggiornata', {
          description: `${form.name} - ${baseDays.toFixed(2)} ore`,
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
          base_days: baseDays,
          tech_category: form.techCategory,
          group: form.group,
          active: form.active,
          is_custom: true,
          base_activity_id: form.baseActivityId,
          created_by: user?.id || null,
        });

        if (error) throw error;

        toast.success('Attivita creata', {
          description: `${generatedCode} - ${baseDays.toFixed(2)} ore`,
        });
      }

      setForm(initialForm);
      setActiveTab('catalog');
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
    setActiveTab('create');
    setForm({
      name: activity.name,
      description: activity.description || '',
      baseDays: activity.base_days.toString(),
      techCategory: activity.tech_category,
      group: activity.group,
      active: activity.active,
      baseActivityId: activity.base_activity_id || null,
    });
  };

  const handleCancelEdit = () => {
    setEditActivity(null);
    setForm(initialForm);
  };

  const handleDuplicate = (activity: Activity) => {
    setEditActivity(null);
    setActiveTab('create');
    setForm({
      name: activity.name + ' (Copy)',
      description: activity.description || '',
      baseDays: activity.base_days.toString(),
      techCategory: activity.tech_category,
      group: activity.group,
      active: true,
      baseActivityId: activity.id,
    });
    toast.message('Duplicazione pronta', {
      description: 'Modifica e salva come nuova attivita custom.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

      <main className="container mx-auto px-4 pt-6 pb-4 max-w-6xl relative z-10">
        <div className={`flex flex-col lg:flex-row gap-6 items-start ${activeTab === 'catalog' ? 'lg:justify-center' : ''}`}>
          <AnimatePresence initial={false}>
            {activeTab !== 'catalog' && (
              <motion.div
                key="hero"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -120 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-5 relative lg:flex-1"
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
                  <Shield className="w-4 h-4 mr-2 text-amber-600" />
                  Catalogo custom
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                  Attivita personalizzate
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                    in un colpo d'occhio
                  </span>
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl leading-relaxed font-medium">
                  Crea, duplica o consulta le attivita custom e le OOTB in un unico pannello, con tutto visibile in viewport.
                </p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {customActivities.length} custom
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    {Array.from(new Set(customActivities.map((a) => a.group))).length} gruppi
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    {customActivities.filter((a) => a.active).length} attive
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="ghost" onClick={() => setActiveTab('catalog')} className="hover:bg-slate-100">
                    Apri catalogo
                  </Button>
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.12, rotate: [0, 4, -3, 0] }}
                  transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                  className="hidden lg:block absolute -right-10 -top-10 w-56 h-56 rounded-[32px] bg-gradient-to-br from-indigo-400/60 via-blue-400/50 to-purple-500/40 blur-3xl"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={false}
            animate={{
              opacity: 1,
              y: 0,
              scale: activeTab === 'catalog' ? 1 : 0.88,
              alignSelf: activeTab === 'catalog' ? 'center' : 'stretch'
            }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            whileHover={{ scale: activeTab === 'catalog' ? 1.002 : 0.89 }}
            className={`group relative p-5 rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-900/30 overflow-hidden w-full max-w-[1300px] ${activeTab !== 'catalog' ? 'lg:flex-1' : ''}`}
          >
            <motion.div
              initial={{ opacity: 0.12, scale: 1 }}
              animate={{ opacity: [0.12, 0.2, 0.12], scale: [1, 1.03, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950"
            />
            <div className="absolute -right-8 -top-8 text-indigo-300/20 group-hover:text-indigo-200/30 transition-colors duration-300">
              <Sparkles className="w-28 h-28" />
            </div>
            <div className="relative z-10 space-y-5 h-full">
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] uppercase tracking-[0.2em]">
                    Workspace
                  </div>
                  <h2 className="text-2xl font-bold mt-2 leading-tight">Centro attivita</h2>
                  <p className="text-sm text-indigo-100/80">
                    Crea/duplica e consulta il catalogo OOTB + custom senza lasciare la schermata.
                  </p>
                </div>
                <Badge className="bg-white/15 text-white border-white/20 text-xs">
                  {activities.length} totali
                </Badge>
              </div>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'catalog')} className="w-full h-full">
                <TabsList className="grid grid-cols-2 bg-white/10 border border-white/15 rounded-2xl p-1">
                  <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-xl">
                    Crea / Modifica
                  </TabsTrigger>
                  <TabsTrigger value="catalog" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-xl">
                    Catalogo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="mt-3 space-y-3">
                  <form className="space-y-3" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor="name" className="text-white/90">Nome</Label>
                        <Input
                          id="name"
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="API hardening & security review"
                          required
                          className="bg-white text-slate-900 h-10"
                        />
                      </div>

                      {showDescription && (
                        <div className="space-y-1.5 col-span-2">
                          <Label htmlFor="description" className="text-white/90">Descrizione</Label>
                          <Textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Dettaglia cosa include l'attivita e eventuali vincoli."
                            rows={2}
                            className="bg-white text-slate-900"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-white/90">Tecnologia</Label>
                        <Select
                          value={form.techCategory}
                          onValueChange={(value) => setForm((prev) => ({ ...prev, techCategory: value }))}
                        >
                          <SelectTrigger className="bg-white text-slate-900">
                            <SelectValue placeholder="Seleziona tecnologia" />
                          </SelectTrigger>
                          <SelectContent>
                            {technologies.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/90">Fase</Label>
                        <Select
                          value={form.group}
                          onValueChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
                        >
                          <SelectTrigger className="bg-white text-slate-900">
                            <SelectValue placeholder="Seleziona fase" />
                          </SelectTrigger>
                          <SelectContent>
                            {groupOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-white/90">Peso (ore)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={form.baseDays}
                          onChange={(e) => setForm((prev) => ({ ...prev, baseDays: e.target.value }))}
                          required
                          className="text-lg font-semibold h-10 bg-white text-slate-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/90">Stato</Label>
                        <Button
                          type="button"
                          variant="outline"
                          className={`w-full h-10 justify-between ${form.active ? 'bg-emerald-500/20 border-emerald-200 text-white' : 'bg-white/10 text-white border-white/20'}`}
                          onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                        >
                          {form.active ? 'Attiva subito' : 'Mantieni bozza'}
                          <span className="text-xs opacity-80">{form.active ? 'ON' : 'OFF'}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-indigo-100 hover:bg-white/10"
                        onClick={() => setShowDescription((prev) => !prev)}
                      >
                        {showDescription ? 'Nascondi descrizione' : 'Aggiungi descrizione'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-indigo-100 hover:bg-white/10"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                      >
                        {showAdvanced ? 'Chiudi extra' : 'Impostazioni avanzate'}
                      </Button>
                    </div>

                    {showAdvanced && (
                      <div className="grid grid-cols-2 gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">Codice generato</p>
                          <p className="text-xs text-indigo-100/80">Viene proposto automaticamente da nome e tecnologia.</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">Suggerimento</p>
                          <p className="text-xs text-indigo-100/80">Imposta il peso base in funzione dello sforzo minimo.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {editActivity && (
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-white/30 text-white hover:bg-white/10"
                          onClick={handleCancelEdit}
                        >
                          Annulla
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className={`flex-1 ${editActivity ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'} border-0 shadow-md`}
                        disabled={saving}
                      >
                        {saving ? 'Salvataggio...' : editActivity ? 'Salva modifica' : 'Crea attivita'}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="catalog" className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-1 bg-white/10 rounded-full p-1 border border-white/15">
                      <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900" onClick={() => setViewFilter('ALL')}>
                        Tutte
                      </Button>
                      <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900" onClick={() => setViewFilter('OOTB')}>
                        Di sistema
                      </Button>
                      <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900" onClick={() => setViewFilter('CUSTOM')}>
                        Custom
                      </Button>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={filterTech} onValueChange={setFilterTech}>
                        <SelectTrigger className="w-[170px] h-8 bg-white text-slate-900 text-sm">
                          <SelectValue placeholder="Tecnologia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tutte le tecnologie</SelectItem>
                          {technologies.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 gap-2 bg-white/10 text-white border-white/20 hover:bg-white/20 text-xs px-3">
                            <Settings2 className="h-4 w-4" />
                            Colonne
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                          <DropdownMenuLabel>Mostra colonne</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.codice}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, codice: checked }))}
                          >
                            Codice
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.nome}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, nome: checked }))}
                          >
                            Nome
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.tecnologia}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, tecnologia: checked }))}
                          >
                            Tecnologia
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.fase}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, fase: checked }))}
                          >
                            Fase
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.origine}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, origine: checked }))}
                          >
                            Origine
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns.peso}
                            onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, peso: checked }))}
                          >
                            Peso
                          </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Badge variant="secondary" className="bg-white/15 text-white border-white/20 text-xs px-2 py-1">
                        {activityRows.length} risultati
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 max-h-[52vh] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] min-w-0">
                    <style>
                      {`.rounded-2xl::-webkit-scrollbar { display: none; }`}
                    </style>
                    <Table className="table-fixed w-full">
                      <TableHeader className="sticky top-0 bg-white/10 backdrop-blur z-10">
                        <TableRow className="hover:bg-white/5">
                          {visibleColumns.codice && <TableHead className="text-white w-[10%]">Codice</TableHead>}
                          {visibleColumns.nome && <TableHead className="text-white w-[34%]">Nome</TableHead>}
                          {visibleColumns.tecnologia && <TableHead className="hidden lg:table-cell text-white w-[16%]">Tecnologia</TableHead>}
                          {visibleColumns.fase && <TableHead className="hidden lg:table-cell text-white w-[12%]">Fase</TableHead>}
                          {visibleColumns.origine && <TableHead className="text-white w-[10%]">Origine</TableHead>}
                          {visibleColumns.peso && <TableHead className="text-white font-semibold w-[10%]">Peso</TableHead>}
                          <TableHead className="text-right text-white w-[8%]">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fetching ? (
                          <TableRow>
                            <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8 text-indigo-100/80">
                              Caricamento...
                            </TableCell>
                          </TableRow>
                        ) : activityRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8 text-indigo-100/80">
                              Nessuna attivita trovata
                            </TableCell>
                          </TableRow>
                        ) : (
                          activityRows.map((activity) => {
                            const editable = canEdit(activity);
                            const isCustom = !!activity.is_custom;
                            const baseRef = activity.base_activity_id
                              ? activities.find((a) => a.id === activity.base_activity_id)
                              : null;
                            const originLabel = isCustom
                              ? baseRef
                                ? 'Custom (override)'
                                : 'Custom'
                              : 'OOTB';
                            return (
                              <TableRow key={activity.id} className="hover:bg-white/5">
                                {visibleColumns.codice && (
                                  <TableCell className="font-semibold text-white/90 truncate">{activity.code}</TableCell>
                                )}
                                {visibleColumns.nome && (
                                  <TableCell className="max-w-[360px] whitespace-normal break-words">
                                    <div className="text-white font-medium">{activity.name}</div>
                                    <div className="text-xs text-indigo-100/80">{activity.description}</div>
                                    {baseRef && (
                                      <div className="text-[10px] text-indigo-100/70 mt-0.5">
                                        Deriva da {baseRef.code}
                                      </div>
                                    )}
                                  </TableCell>
                                )}
                                {visibleColumns.tecnologia && (
                                  <TableCell className="hidden lg:table-cell text-xs text-indigo-100/80 truncate">
                                    {technologies.find((t) => t.value === activity.tech_category)?.label || activity.tech_category}
                                  </TableCell>
                                )}
                                {visibleColumns.fase && (
                                  <TableCell className="hidden lg:table-cell text-xs text-indigo-100/80 truncate">
                                    {groupOptions.find((g) => g.value === activity.group)?.label || activity.group}
                                  </TableCell>
                                )}
                                {visibleColumns.origine && (
                                  <TableCell className="truncate">
                                    <Badge variant={isCustom ? 'default' : 'outline'} className={isCustom ? 'bg-amber-200/90 text-amber-900 border-amber-200' : 'border-white/30 text-white'}>
                                      {originLabel}
                                    </Badge>
                                  </TableCell>
                                )}
                                {visibleColumns.peso && (
                                  <TableCell className="truncate">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-2xl font-bold text-white">{activity.base_days.toFixed(1)}</span>
                                      <span className="text-xs text-indigo-100/80 font-medium">ore</span>
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="text-right truncate">
                                  {isCustom ? (
                                    <>
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-blue-200 hover:text-white hover:bg-white/10"
                                          onClick={() => openEdit(activity)}
                                          disabled={!editable}
                                          title="Modifica"
                                        >
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-indigo-100 hover:text-emerald-200 hover:bg-white/10"
                                          onClick={() => handleDuplicate(activity)}
                                          title="Duplica in custom"
                                        >
                                          <Sparkles className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      {!editable && (
                                        <div className="text-[10px] text-indigo-100/70 mt-1">Creato da altro utente</div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex justify-end">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-indigo-100 hover:text-emerald-200 hover:bg-white/10"
                                        onClick={() => handleDuplicate(activity)}
                                        title="Duplica in custom"
                                      >
                                        <Sparkles className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
