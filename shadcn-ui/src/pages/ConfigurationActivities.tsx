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
  };

  const handleDuplicate = (activity: Activity) => {
    setEditActivity(null);
    setActiveTab('create');
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

      <main className="container mx-auto px-4 pt-4 pb-4 max-w-7xl relative z-10 h-[calc(100vh-64px)] flex flex-col">
        <div className={`flex flex-col lg:flex-row gap-6 items-start h-full ${activeTab === 'catalog' ? 'lg:justify-center' : ''}`}>
          <AnimatePresence initial={false}>
            {activeTab !== 'catalog' && (
              <motion.div
                key="hero"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -120 }}
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
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={false}
            animate={{
              opacity: 1,
              y: 0,
              scale: activeTab === 'catalog' ? 1 : 0.98,
              alignSelf: activeTab === 'catalog' ? 'center' : 'stretch'
            }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className={`group relative p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl overflow-hidden w-full max-w-[1300px] flex flex-col ${activeTab === 'catalog' ? 'h-[90%]' : 'h-full lg:flex-1'}`}
          >
            <div className="absolute -right-8 -top-8 text-indigo-500/5 pointer-events-none">
              <Sparkles className="w-40 h-40" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  {activeTab === 'catalog' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveTab('create')}
                      className="h-8 w-8 rounded-full -ml-2 text-slate-500 hover:text-slate-900"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-semibold">
                      Workspace
                    </div>
                    <h2 className="text-2xl font-bold mt-2 leading-tight text-slate-900">Centro attivita</h2>
                    <p className="text-sm text-slate-500">
                      Crea/duplica e consulta il catalogo OOTB + custom.
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                  {activities.length} totali
                </Badge>
              </div>

              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'create' | 'catalog')} className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="grid grid-cols-2 bg-slate-100/80 border border-slate-200 rounded-xl p-1 flex-shrink-0 mb-4">
                  <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-lg">
                    Crea / Modifica
                  </TabsTrigger>
                  <TabsTrigger value="catalog" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-sm font-semibold rounded-lg">
                    Catalogo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="flex-1 overflow-y-auto pr-2 -mr-2 flex-col data-[state=active]:flex">
                  <form className="flex-1 flex flex-col gap-4" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <Label htmlFor="name" className="text-slate-700">Nome</Label>
                        <Input
                          id="name"
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="API hardening & security review"
                          required
                          className="bg-white/50 border-slate-200 focus:bg-white transition-colors"
                        />
                      </div>

                      {showDescription && (
                        <div className="space-y-1.5 col-span-2">
                          <Label htmlFor="description" className="text-slate-700">Descrizione</Label>
                          <Textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Dettaglia cosa include l'attivita e eventuali vincoli."
                            rows={2}
                            className="bg-white/50 border-slate-200 focus:bg-white transition-colors"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-slate-700">Tecnologia</Label>
                        <Select
                          value={form.techCategory}
                          onValueChange={(value) => setForm((prev) => ({ ...prev, techCategory: value }))}
                        >
                          <SelectTrigger className="bg-white/50 border-slate-200">
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
                        <Label className="text-slate-700">Fase</Label>
                        <Select
                          value={form.group}
                          onValueChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
                        >
                          <SelectTrigger className="bg-white/50 border-slate-200">
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
                        <Label className="text-slate-700">Peso (ore)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={form.baseHours}
                          onChange={(e) => setForm((prev) => ({ ...prev, baseHours: e.target.value }))}
                          required
                          className="text-lg font-semibold bg-white/50 border-slate-200 focus:bg-white transition-colors"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-700">Stato</Label>
                        <Button
                          type="button"
                          variant="outline"
                          className={`w-full justify-between ${form.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                          onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                        >
                          {form.active ? 'Attiva subito' : 'Mantieni bozza'}
                          <span className="text-xs opacity-80 font-semibold">{form.active ? 'ON' : 'OFF'}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:bg-slate-100"
                        onClick={() => setShowDescription((prev) => !prev)}
                      >
                        {showDescription ? 'Nascondi descrizione' : 'Aggiungi descrizione'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:bg-slate-100"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                      >
                        {showAdvanced ? 'Chiudi extra' : 'Impostazioni avanzate'}
                      </Button>
                    </div>

                    {showAdvanced && (
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Codice generato</p>
                          <p className="text-xs text-slate-500">Viene proposto automaticamente da nome e tecnologia.</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Suggerimento</p>
                          <p className="text-xs text-slate-500">Imposta il peso base in funzione dello sforzo minimo.</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 mt-auto">
                      {editActivity && (
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                          onClick={handleCancelEdit}
                        >
                          Annulla
                        </Button>
                      )}
                      <Button
                        type="submit"
                        className={`flex-1 ${editActivity ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'} text-white shadow-md border-0`}
                        disabled={saving}
                      >
                        {saving ? 'Salvataggio...' : editActivity ? 'Salva modifica' : 'Crea attivita'}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="catalog" className="flex-1 flex-col min-h-0 mt-0 data-[state=active]:flex">
                  <div className="flex flex-wrap gap-2 items-center justify-between mb-3 flex-shrink-0">
                    <div className="flex gap-1 bg-slate-100 rounded-full p-1 border border-slate-200">
                      <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('ALL')}>
                        Tutte
                      </Button>
                      <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('OOTB')}>
                        Di sistema
                      </Button>
                      <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-7 px-2 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-600" onClick={() => setViewFilter('CUSTOM')}>
                        Custom
                      </Button>
                    </div>

                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={filterTech} onValueChange={setFilterTech}>
                        <SelectTrigger className="w-[170px] h-8 bg-white border-slate-200 text-slate-700 text-sm">
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
                          <Button variant="outline" size="sm" className="h-8 gap-2 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs px-3">
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

                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 text-xs px-2 py-1">
                        {activityRows.length} risultati
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/50 flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:thin]">
                      <Table className="table-fixed w-full">
                        <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur z-10 shadow-sm">
                          <TableRow className="hover:bg-slate-100/50 border-slate-200">
                            {visibleColumns.codice && <TableHead className="text-slate-700 font-semibold w-[10%]">Codice</TableHead>}
                            {visibleColumns.nome && <TableHead className="text-slate-700 font-semibold w-[34%]">Nome</TableHead>}
                            {visibleColumns.tecnologia && <TableHead className="hidden lg:table-cell text-slate-700 font-semibold w-[16%]">Tecnologia</TableHead>}
                            {visibleColumns.fase && <TableHead className="hidden lg:table-cell text-slate-700 font-semibold w-[12%]">Fase</TableHead>}
                            {visibleColumns.origine && <TableHead className="text-slate-700 font-semibold w-[10%]">Origine</TableHead>}
                            {visibleColumns.peso && <TableHead className="text-slate-700 font-semibold w-[10%]">Peso</TableHead>}
                            <TableHead className="text-right text-slate-700 font-semibold w-[8%]">Azioni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fetching ? (
                            <TableRow>
                              <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8 text-slate-500">
                                Caricamento...
                              </TableCell>
                            </TableRow>
                          ) : activityRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="text-center py-8 text-slate-500">
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
                                <TableRow key={activity.id} className="hover:bg-slate-50/80 border-slate-100">
                                  {visibleColumns.codice && (
                                    <TableCell className="font-semibold text-slate-700 truncate">{activity.code}</TableCell>
                                  )}
                                  {visibleColumns.nome && (
                                    <TableCell className="max-w-[360px] whitespace-normal break-words">
                                      <div className="text-slate-900 font-medium">{activity.name}</div>
                                      <div className="text-xs text-slate-500">{activity.description}</div>
                                      {baseRef && (
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                          Deriva da {baseRef.code}
                                        </div>
                                      )}
                                    </TableCell>
                                  )}
                                  {visibleColumns.tecnologia && (
                                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 truncate">
                                      {technologies.find((t) => t.value === activity.tech_category)?.label || activity.tech_category}
                                    </TableCell>
                                  )}
                                  {visibleColumns.fase && (
                                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 truncate">
                                      {groupOptions.find((g) => g.value === activity.group)?.label || activity.group}
                                    </TableCell>
                                  )}
                                  {visibleColumns.origine && (
                                    <TableCell className="truncate">
                                      <Badge variant={isCustom ? 'default' : 'outline'} className={isCustom ? 'bg-amber-100 text-amber-800 border-amber-200' : 'border-slate-300 text-slate-600'}>
                                        {originLabel}
                                      </Badge>
                                    </TableCell>
                                  )}
                                  {visibleColumns.peso && (
                                    <TableCell className="truncate">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xl font-bold text-slate-700">{activity.base_hours.toFixed(1)}</span>
                                        <span className="text-xs text-slate-500 font-medium">ore</span>
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
                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => openEdit(activity)}
                                            disabled={!editable}
                                            title="Modifica"
                                          >
                                            <Edit3 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                            onClick={() => handleDuplicate(activity)}
                                            title="Duplica in custom"
                                          >
                                            <Sparkles className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        {!editable && (
                                          <div className="text-[10px] text-slate-400 mt-1">Creato da altro utente</div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="flex justify-end">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
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
