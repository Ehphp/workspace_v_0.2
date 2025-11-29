import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Sparkles,
  Wrench,
  Plus,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Activity } from '@/types/database';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// techOptions removed, using dynamic state


const groupOptions = [
  { value: 'ANALYSIS', label: 'Analysis' },
  { value: 'DEV', label: 'Development' },
  { value: 'TEST', label: 'Testing' },
  { value: 'OPS', label: 'Operations' },
  { value: 'GOVERNANCE', label: 'Governance' },
];

const generateActivityCode = (name: string, techCategory: string): string => {
  // Simple heuristic for prefix: first 2 chars of each word in category, or first 3 chars
  const techPrefix = techCategory.split('_').map(w => w[0]).join('').substring(0, 3).toUpperCase();

  const sanitized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 3)
    .join('_');

  return `CSTM_${techPrefix}_${sanitized}`;
};

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
    const { data, error } = await supabase
      .from('technologies')
      .select('code, name')
      .order('sort_order');

    if (data && data.length > 0) {
      setTechnologies(data.map(t => ({ value: t.code, label: t.name })));
    } else {
      // Fallback if table doesn't exist yet or is empty
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
      toast.error('Impossibile caricare le attività');
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
        description: 'Inserisci un numero di giorni maggiore di zero',
      });
      return;
    }

    setSaving(true);
    try {
      if (editActivity) {
        // UPDATE MODE
        if (!canEdit(editActivity)) {
          throw new Error('Non hai i permessi per modificare questa attività');
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

        toast.success('Attività aggiornata', {
          description: `${form.name} • ${baseDays.toFixed(2)} giorni`,
        });
        setEditActivity(null);
      } else {
        // CREATE MODE
        const generatedCode = generateActivityCode(form.name, form.techCategory);
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

        toast.success('Attività creata', {
          description: `${generatedCode} • ${baseDays.toFixed(2)} giorni`,
        });
      }

      setForm(initialForm);
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
    setEditActivity(null); // Ensure we are in create mode
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
      description: 'Modifica e salva come nuova attività custom.',
    });
  };

  const toggleActive = async (activity: Activity) => {
    if (!canEdit(activity)) {
      toast.error('Puoi modificare solo le attività che hai creato');
      return;
    }

    try {
      const { error } = await supabase
        .from('activities')
        .update({ active: !activity.active })
        .eq('id', activity.id)
        .eq('created_by', user?.id || '');

      if (error) {
        throw new Error(error.message);
      }
      toast.success('Stato aggiornato', {
        description: `${activity.code} è ora ${!activity.active ? 'attiva' : 'disattivata'}`,
      });
      await loadActivities();
    } catch (err) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error('Impossibile aggiornare lo stato', {
        description: message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50 overflow-hidden relative">
      {/* Background pattern - fixed layer */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

      {/* Header - flex-shrink-0 */}
      <div className="flex-shrink-0 relative z-10">
        <Header />
      </div>

      {/* Page Header Section - flex-shrink-0 */}
      <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0 z-10">
        <div className="container mx-auto px-6 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
              <Shield className="h-3 w-3 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Catalogo custom</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Attività personalizzate
            </h1>
            <p className="text-xs text-slate-600">
              Crea o aggiorna attività custom e pesa il loro impatto sui giorni base.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-md">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {customActivities.length} custom
            </Badge>
            <Button
              variant="outline"
              onClick={loadActivities}
              disabled={fetching}
              className="bg-white/70 backdrop-blur-sm border-slate-200 hover:bg-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/configuration')}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna a Configurazione
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden z-10 flex flex-col">
        <div className="container mx-auto px-6 py-4 h-full flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">

          {/* Stats Cards - Fixed height */}
          <div className="grid lg:grid-cols-3 gap-2 flex-shrink-0">
            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-sm">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Custom attive
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between py-2">
                <div>
                  <div className="text-xl font-bold text-slate-900">{customActivities.filter((a) => a.active).length}</div>
                  <p className="text-xs text-slate-500">su {customActivities.length} totali</p>
                </div>
                <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                  Live
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-sm">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  Gruppi coperti
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-end justify-between py-2">
                <div>
                  <div className="text-xl font-bold text-slate-900">
                    {Array.from(new Set(customActivities.map((a) => a.group))).length}
                  </div>
                  <p className="text-xs text-slate-500">fasi con custom</p>
                </div>
                <Badge variant="secondary" className="text-blue-700 bg-blue-50 border-blue-200">
                  Ready
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-sm">
              <CardHeader className="pb-1 py-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Impatto calcoli
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-xs text-slate-700">
                  Il peso modifica i giorni base. Aggiorna con cautela.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid - Fills remaining space */}
          <div className="grid xl:grid-cols-3 gap-4 flex-1 min-h-0 pb-2">

            {/* Left Col: Create Form - Scrollable */}
            <Card className="xl:col-span-1 bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl flex flex-col h-full overflow-hidden">
              <CardHeader className="py-3 flex-shrink-0 bg-white/50 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  {editActivity ? (
                    <>
                      <Edit3 className="h-4 w-4 text-blue-600" />
                      Modifica attività
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 text-emerald-600" />
                      Crea attività custom
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {editActivity ? 'Modifica i dettagli dell\'attività esistente.' : 'Definisci codice, peso e tecnologia.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4">
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="API hardening & security review"
                      required
                    />
                    {!editActivity && (
                      <p className="text-xs text-slate-500">Il codice sarà generato automaticamente dal nome e dalla tecnologia.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrizione</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Dettaglia cosa include l'attivita e eventuali vincoli."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tecnologia</Label>
                      <Select
                        value={form.techCategory}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, techCategory: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                    <div className="space-y-2">
                      <Label>Fase</Label>
                      <Select
                        value={form.group}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-slate-900">⚖️ Peso (giorni base)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={form.baseDays}
                      onChange={(e) => setForm((prev) => ({ ...prev, baseDays: e.target.value }))}
                      required
                      className="text-lg font-semibold h-12"
                    />
                    <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                      💡 <strong>Importante:</strong> Questo valore determina l'impatto dell'attività sui calcoli di stima. Usato dal motore deterministico come base_days.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {editActivity && (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleCancelEdit}
                      >
                        Annulla
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className={`flex-1 ${editActivity ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'}`}
                      disabled={saving}
                    >
                      {saving ? 'Salvataggio...' : editActivity ? 'Salva modifica' : 'Crea attività'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Right Col: Catalog Table - Scrollable */}
            <div className="xl:col-span-2 h-full flex flex-col overflow-hidden">
              <Card className="bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl flex flex-col h-full overflow-hidden">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between py-3 flex-shrink-0 bg-white/50 border-b border-slate-100">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Wrench className="h-4 w-4 text-slate-700" />
                      Catalogo attività (OOTB + custom)
                    </CardTitle>
                    <CardDescription className="text-xs">Filtra, duplica le OOTB o modifica le tue custom.</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex gap-1 bg-slate-100 rounded-full p-1">
                      <Button size="sm" variant={viewFilter === 'ALL' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('ALL')}>
                        Tutte
                      </Button>
                      <Button size="sm" variant={viewFilter === 'OOTB' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('OOTB')}>
                        Di sistema
                      </Button>
                      <Button size="sm" variant={viewFilter === 'CUSTOM' ? 'default' : 'ghost'} className="h-7 px-3" onClick={() => setViewFilter('CUSTOM')}>
                        Custom
                      </Button>
                    </div>

                    <Select value={filterTech} onValueChange={setFilterTech}>
                      <SelectTrigger className="w-[180px] h-8">
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
                        <Button variant="outline" size="sm" className="h-8 gap-2">
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

                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                      {activityRows.length} risultati
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          {visibleColumns.codice && <TableHead>Codice</TableHead>}
                          {visibleColumns.nome && <TableHead>Nome</TableHead>}
                          {visibleColumns.tecnologia && <TableHead className="hidden lg:table-cell">Tecnologia</TableHead>}
                          {visibleColumns.fase && <TableHead className="hidden lg:table-cell">Fase</TableHead>}
                          {visibleColumns.origine && <TableHead>Origine</TableHead>}
                          {visibleColumns.peso && <TableHead className="font-semibold">Peso</TableHead>}
                          <TableHead className="text-right">Azioni</TableHead>
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
                              Nessuna attività trovata
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
                              <TableRow key={activity.id}>
                                {visibleColumns.codice && (
                                  <TableCell className="font-semibold text-slate-700">{activity.code}</TableCell>
                                )}
                                {visibleColumns.nome && (
                                  <TableCell className="max-w-[240px]">
                                    <div className="text-slate-900 font-medium truncate">{activity.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{activity.description}</div>
                                    {baseRef && (
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        Deriva da {baseRef.code}
                                      </div>
                                    )}
                                  </TableCell>
                                )}
                                {visibleColumns.tecnologia && (
                                  <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                                    {technologies.find((t) => t.value === activity.tech_category)?.label || activity.tech_category}
                                  </TableCell>
                                )}
                                {visibleColumns.fase && (
                                  <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                                    {groupOptions.find((g) => g.value === activity.group)?.label || activity.group}
                                  </TableCell>
                                )}
                                {visibleColumns.origine && (
                                  <TableCell>
                                    <Badge variant={isCustom ? 'default' : 'outline'} className={isCustom ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}>
                                      {originLabel}
                                    </Badge>
                                  </TableCell>
                                )}
                                {visibleColumns.peso && (
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-2xl font-bold text-slate-900">{activity.base_days.toFixed(1)}</span>
                                      <span className="text-xs text-slate-500 font-medium">giorni</span>
                                    </div>
                                  </TableCell>
                                )}
                                <TableCell className="text-right">
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
                                        <div className="text-[10px] text-slate-500 mt-1">Creato da altro utente</div>
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>


    </div >
  );
}
