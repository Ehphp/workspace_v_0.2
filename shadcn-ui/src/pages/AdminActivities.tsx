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

const techOptions = [
  { value: 'POWER_PLATFORM', label: 'Power Platform' },
  { value: 'BACKEND', label: 'Backend API' },
  { value: 'FRONTEND', label: 'Frontend' },
  { value: 'MULTI', label: 'Multi-stack' },
];

const groupOptions = [
  { value: 'ANALYSIS', label: 'Analysis' },
  { value: 'DEV', label: 'Development' },
  { value: 'TEST', label: 'Testing' },
  { value: 'OPS', label: 'Operations' },
  { value: 'GOVERNANCE', label: 'Governance' },
];

const initialForm = {
  code: 'CSTM_',
  name: '',
  description: '',
  baseDays: '1.0',
  techCategory: 'MULTI',
  group: 'DEV',
  active: true,
  baseActivityId: null as string | null,
};

type ViewFilter = 'ALL' | 'OOTB' | 'CUSTOM';

export default function AdminActivities() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [filterTech, setFilterTech] = useState<string>('ALL');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');

  useEffect(() => {
    if (user) {
      loadActivities();
    }
  }, [user]);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseDays = Number(form.baseDays);

    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Codice e nome sono obbligatori');
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
      const { error } = await supabase.from('activities').insert({
        code: form.code,
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

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Attività creata', {
        description: `${form.code.toUpperCase()} • ${baseDays.toFixed(2)} giorni`,
      });
      setForm({
        ...initialForm,
        code: form.code.startsWith('CSTM_') ? form.code : 'CSTM_',
      });
      await loadActivities();
    } catch (err: any) {
      toast.error('Errore durante il salvataggio', {
        description: err?.message || 'Riprovare tra qualche secondo',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (activity: Activity) => {
    setEditActivity(activity);
    setEditForm({
      code: activity.code,
      name: activity.name,
      description: activity.description || '',
      baseDays: activity.base_days.toString(),
      techCategory: activity.tech_category,
      group: activity.group,
      active: activity.active,
      baseActivityId: activity.base_activity_id || null,
    });
  };

  const handleDuplicate = (activity: Activity) => {
    const suggestedCode = activity.code.toUpperCase().includes('CSTM') ? activity.code.toUpperCase() : `${activity.code.toUpperCase()}_CSTM`;
    setForm({
      code: suggestedCode,
      name: activity.name,
      description: activity.description || '',
      baseDays: activity.base_days.toString(),
      techCategory: activity.tech_category,
      group: activity.group,
      active: true,
      baseActivityId: activity.id,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.message('Duplicazione pronta', {
      description: 'Modifica e salva come attività custom.',
    });
  };

  const handleUpdate = async () => {
    if (!editActivity) return;
    const baseDays = Number(editForm.baseDays);

    if (!Number.isFinite(baseDays) || baseDays <= 0) {
      toast.error('Peso non valido', {
        description: 'Inserisci un numero di giorni maggiore di zero',
      });
      return;
    }

    if (!canEdit(editActivity)) {
      toast.error('Puoi modificare solo le attività che hai creato');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          name: editForm.name,
          description: editForm.description,
          base_days: baseDays,
          tech_category: editForm.techCategory,
          group: editForm.group,
          active: editForm.active,
        })
        .eq('id', editActivity.id)
        .eq('created_by', user?.id || '');

      if (error) {
        throw new Error(error.message);
      }
      toast.success('Attività aggiornata', {
        description: `${editForm.name} • ${baseDays.toFixed(2)} giorni`,
      });
      setEditActivity(null);
      await loadActivities();
    } catch (err: any) {
      toast.error('Aggiornamento non riuscito', {
        description: err?.message || 'Riprovare tra qualche secondo',
      });
    } finally {
      setSaving(false);
    }
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
    } catch (err: any) {
      toast.error('Impossibile aggiornare lo stato', {
        description: err?.message,
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
    <div className="relative h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50 overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

      <Header />

      <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0">
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
              onClick={() => navigate('/lists')}
              className="hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna alle liste
            </Button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-4 space-y-4">
          <div className="grid lg:grid-cols-3 gap-2">
            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-lg">
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

            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-lg">
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

            <Card className="bg-white/80 backdrop-blur-md border-slate-200/70 shadow-lg">
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

          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-1 bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Crea attività custom
                </CardTitle>
                <CardDescription className="text-xs">
                  Definisci codice, peso e tecnologia.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[calc(100vh-420px)] overflow-y-auto">
                <form className="space-y-3" onSubmit={handleCreate}>
                  <div className="space-y-2">
                    <Label htmlFor="code">Codice attività</Label>
                    <Input
                      id="code"
                      value={form.code}
                      onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="CSTM_API_HARDENING"
                      required
                    />
                    <p className="text-xs text-slate-500">Usa un prefisso chiaro (es. CSTM_) per distinguere le attività custom.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="API hardening & security review"
                      required
                    />
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
                          {techOptions.map((opt) => (
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Peso (giorni base)</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0.05"
                        value={form.baseDays}
                        onChange={(e) => setForm((prev) => ({ ...prev, baseDays: e.target.value }))}
                        required
                      />
                      <p className="text-xs text-slate-500">Usato dal motore deterministico come base_days.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Attiva</Label>
                      <div className="flex items-center gap-3 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50">
                        <Switch
                          checked={form.active}
                          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
                        />
                        <span className="text-sm text-slate-700">{form.active ? 'Disponibile' : 'Disattiva'}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    disabled={saving}
                  >
                    {saving ? 'Salvataggio...' : 'Crea attività'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="xl:col-span-2 space-y-4">
              <Card className="bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between py-3">
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
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Tecnologia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tutte le tecnologie</SelectItem>
                        {techOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
                      {activityRows.length} risultati
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead>Codice</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="hidden lg:table-cell">Tecnologia</TableHead>
                          <TableHead className="hidden lg:table-cell">Fase</TableHead>
                          <TableHead>Origine</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fetching ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                              Caricamento...
                            </TableCell>
                          </TableRow>
                        ) : activityRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-slate-500">
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
                                <TableCell className="font-semibold">{activity.code}</TableCell>
                                <TableCell className="max-w-[240px]">
                                  <div className="text-slate-900 font-medium truncate">{activity.name}</div>
                                  <div className="text-xs text-slate-500 truncate">{activity.description}</div>
                                  {baseRef && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      Deriva da {baseRef.code}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                                  {techOptions.find((t) => t.value === activity.tech_category)?.label || activity.tech_category}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                                  {groupOptions.find((g) => g.value === activity.group)?.label || activity.group}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={isCustom ? 'default' : 'outline'} className={isCustom ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}>
                                    {originLabel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                    {activity.base_days.toFixed(2)} d
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {isCustom ? (
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={activity.active}
                                        onCheckedChange={() => toggleActive(activity)}
                                        disabled={!editable}
                                      />
                                      <span className="text-xs text-slate-600">
                                        {activity.active ? 'Attiva' : 'Spenta'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">Read-only</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isCustom ? (
                                    <>
                                      <Button variant="ghost" size="sm" onClick={() => openEdit(activity)} disabled={!editable}>
                                        <Edit3 className="h-4 w-4 mr-1" />
                                        Modifica
                                      </Button>
                                      {!editable && (
                                        <div className="text-[10px] text-slate-500 mt-1">Creato da altro utente</div>
                                      )}
                                    </>
                                  ) : (
                                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(activity)}>
                                      <Sparkles className="h-4 w-4 mr-1" />
                                      Duplica in custom
                                    </Button>
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

      <Dialog open={!!editActivity} onOpenChange={(open) => !open && setEditActivity(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica attività custom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Codice attività</Label>
              <Input
                id="edit-code"
                value={editForm.code}
                disabled
                className="bg-slate-50"
              />
              <p className="text-xs text-slate-500">Il codice non può essere modificato dopo la creazione.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrizione</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tecnologia</Label>
                <Select
                  value={editForm.techCategory}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, techCategory: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {techOptions.map((opt) => (
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
                  value={editForm.group}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, group: value }))}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Peso (giorni base)</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={editForm.baseDays}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, baseDays: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Attiva</Label>
                <div className="flex items-center gap-3 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50">
                  <Switch
                    checked={editForm.active}
                    onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, active: checked }))}
                  />
                  <span className="text-sm text-slate-700">{editForm.active ? 'Disponibile' : 'Disattiva'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditActivity(null)}>
              Annulla
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

