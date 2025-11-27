import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import type { TechnologyPreset, Activity, Driver, Risk } from '@/types/database';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RefreshCw, Info, Layers, LayoutList, AlertTriangle } from 'lucide-react';

interface PresetView extends TechnologyPreset {
    defaultActivities: Activity[];
    defaultRisks: Risk[];
    driverDefaults: { code: string; value: string }[];
}

export default function Presets() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [presets, setPresets] = useState<PresetView[]>([]);
    const [selected, setSelected] = useState<PresetView | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [presetsRes, activitiesRes, driversRes, risksRes, pivotRes] = await Promise.all([
                supabase.from('technology_presets').select('*').order('name'),
                supabase.from('activities').select('*').eq('active', true),
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

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

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50 overflow-hidden">
            {/* Header - flex-shrink-0 */}
            <div className="flex-shrink-0">
                <Header />
            </div>

            {/* Main content - flex-1 with internal scroll */}
            <div className="flex-1 overflow-y-auto">
                <div className="container mx-auto px-6 py-6 pb-12 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Catalogo preset</p>
                            <h1 className="text-2xl font-bold text-slate-900">Technology Presets</h1>
                            <p className="text-sm text-slate-600">Consulta e applica i preset tecnologici con i loro default di attività, driver e rischi.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={loadData} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Aggiorna
                            </Button>
                            <Button variant="default" onClick={() => navigate('/configuration')}>
                                Torna a Configurazione
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-white/80 border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-blue-600" />
                                    Preset totali
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">Suddivisi per categoria tech</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-end gap-4">
                                <div className="text-3xl font-bold text-slate-900">{presets.length}</div>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                                    {Object.entries(stats.perCategory).map(([cat, count]) => (
                                        <Badge key={cat} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                            {cat}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white/80 border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <LayoutList className="h-4 w-4 text-emerald-600" />
                                    Attività default (media)
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">Per preset tecnologico</CardDescription>
                            </CardHeader>
                            <CardContent className="text-3xl font-bold text-slate-900">
                                {stats.avgActivities} <span className="text-sm text-slate-500 font-medium">per preset</span>
                            </CardContent>
                        </Card>

                        {error ? (
                            <Card className="bg-white/80 border-amber-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                                        <AlertTriangle className="h-4 w-4" />
                                        Errore
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-amber-800">{error}</CardContent>
                            </Card>
                        ) : (
                            <Card className="bg-white/80 border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Info className="h-4 w-4 text-slate-600" />
                                        Stato caricamento
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500">
                                        {loading ? 'Caricamento in corso...' : 'Dati aggiornati'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className={`w-3 h-3 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <Card className="bg-white/85 border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-slate-900">Elenco preset</CardTitle>
                            <CardDescription className="text-sm text-slate-600">
                                Dettagli sulle attività di default e driver/rischi ereditati.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto pb-6">
                            <div className="max-h-[60vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead>Attività default</TableHead>
                                            <TableHead>Driver default</TableHead>
                                            <TableHead>Rischi default</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {presets.map((preset) => {
                                            const actsPreview = preset.defaultActivities.slice(0, 3).map((a) => a.code);
                                            const remaining = Math.max(0, preset.defaultActivities.length - 3);
                                            return (
                                                <TableRow key={preset.id}>
                                                    <TableCell className="font-semibold text-slate-900">{preset.name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">{preset.tech_category}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {actsPreview.map((code) => (
                                                                <Badge key={code} variant="secondary" className="text-[11px]">
                                                                    {code}
                                                                </Badge>
                                                            ))}
                                                            {remaining > 0 && (
                                                                <Badge variant="outline" className="text-[11px] text-slate-600">+{remaining}</Badge>
                                                            )}
                                                            {actsPreview.length === 0 && <span className="text-xs text-slate-500">Nessuna</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {preset.driverDefaults.length > 0 ? preset.driverDefaults.map((d) => (
                                                                <Badge key={d.code} variant="outline" className="text-[11px]">
                                                                    {d.code}: {d.value}
                                                                </Badge>
                                                            )) : <span className="text-xs text-slate-500">Nessuno</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {preset.defaultRisks.length > 0 ? preset.defaultRisks.map((r) => (
                                                                <Badge key={r.code} variant="secondary" className="text-[11px] bg-orange-50 text-orange-700 border-orange-200">
                                                                    {r.code}
                                                                </Badge>
                                                            )) : <span className="text-xs text-slate-500">Nessuno</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="outline" size="sm" onClick={() => setSelected(preset)}>
                                                            Dettagli
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            {presets.length === 0 && !loading && (
                                <div className="py-6 text-center text-sm text-slate-500">Nessun preset disponibile.</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                {selected?.name}
                            </DialogTitle>
                            <DialogDescription className="text-slate-600">
                                {selected?.description}
                            </DialogDescription>
                        </DialogHeader>
                        {selected && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">{selected.tech_category}</Badge>
                                    <span className="text-xs text-slate-500">Preset code: {selected.code}</span>
                                </div>

                                <div className="grid md:grid-cols-2 gap-3">
                                    <Card className="border-slate-200">
                                        <CardHeader className="pb-1">
                                            <CardTitle className="text-sm font-semibold">Attività default</CardTitle>
                                            <CardDescription className="text-xs text-slate-500">In ordine di priorità (position)</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-1 max-h-72 overflow-y-auto">
                                            {selected.defaultActivities.length > 0 ? selected.defaultActivities.map((a, idx) => (
                                                <div key={a.id} className="flex items-start justify-between text-sm">
                                                    <div className="flex flex-col">
                                                        <div className="font-semibold text-slate-900">{idx + 1}. {a.name}</div>
                                                        <div className="text-xs text-slate-600">{a.code} · {a.group}</div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[11px]">{a.base_days}d</Badge>
                                                </div>
                                            )) : <div className="text-xs text-slate-500">Nessuna attività impostata</div>}
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-3">
                                        <Card className="border-slate-200">
                                            <CardHeader className="pb-1">
                                                <CardTitle className="text-sm font-semibold">Driver default</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-wrap gap-1">
                                                {selected.driverDefaults.length > 0 ? selected.driverDefaults.map((d) => (
                                                    <Badge key={d.code} variant="outline" className="text-[11px]">
                                                        {d.code}: {d.value}
                                                    </Badge>
                                                )) : <span className="text-xs text-slate-500">Nessuno</span>}
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200">
                                            <CardHeader className="pb-1">
                                                <CardTitle className="text-sm font-semibold">Rischi default</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-wrap gap-1">
                                                {selected.defaultRisks.length > 0 ? selected.defaultRisks.map((r) => (
                                                    <Badge key={r.code} variant="secondary" className="text-[11px] bg-orange-50 text-orange-700 border-orange-200">
                                                        {r.code}
                                                    </Badge>
                                                )) : <span className="text-xs text-slate-500">Nessuno</span>}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
