import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Plus,
    RefreshCw,
    Edit3,
    ArrowLeft,
    Trash2,
    Cpu,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Technology } from '@/types/database';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const initialForm = {
    code: '',
    name: '',
    description: '',
    color: '#000000',
    icon: '',
};

export default function ConfigurationTechnologies() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [technologies, setTechnologies] = useState<Technology[]>([]);
    const [saving, setSaving] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [form, setForm] = useState(initialForm);
    const [editTech, setEditTech] = useState<Technology | null>(null);
    const [deleteTech, setDeleteTech] = useState<Technology | null>(null);

    useEffect(() => {
        if (user) {
            loadTechnologies();
        }
    }, [user]);

    const loadTechnologies = async () => {
        setFetching(true);
        const { data, error } = await supabase
            .from('technologies')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error loading technologies', error);
            toast.error('Impossibile caricare le tecnologie');
        } else {
            setTechnologies(data || []);
        }
        setFetching(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.code.trim() || !form.name.trim()) {
            toast.error('Codice e Nome sono obbligatori');
            return;
        }

        setSaving(true);
        try {
            if (editTech) {
                // UPDATE
                const { error } = await supabase
                    .from('technologies')
                    .update({
                        name: form.name,
                        description: form.description,
                        color: form.color,
                        icon: form.icon,
                    })
                    .eq('id', editTech.id);

                if (error) throw error;

                toast.success('Tecnologia aggiornata');
                setEditTech(null);
            } else {
                // CREATE
                const { error } = await supabase.from('technologies').insert({
                    code: form.code.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                    name: form.name,
                    description: form.description,
                    color: form.color,
                    icon: form.icon,
                    sort_order: technologies.length * 10 + 10,
                });

                if (error) throw error;

                toast.success('Tecnologia creata');
            }

            setForm(initialForm);
            await loadTechnologies();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Errore sconosciuto';
            toast.error('Errore durante il salvataggio', { description: message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTech) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('technologies')
                .delete()
                .eq('id', deleteTech.id);

            if (error) throw error;

            toast.success('Tecnologia eliminata');
            setDeleteTech(null);
            await loadTechnologies();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Errore sconosciuto';
            toast.error('Impossibile eliminare', {
                description: 'Verifica che non ci siano attività collegate a questa tecnologia.'
            });
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (tech: Technology) => {
        setEditTech(tech);
        setForm({
            code: tech.code,
            name: tech.name,
            description: tech.description || '',
            color: tech.color || '#000000',
            icon: tech.icon || '',
        });
    };

    const handleCancelEdit = () => {
        setEditTech(null);
        setForm(initialForm);
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
            <div className="flex-shrink-0 relative z-10">
                <Header />
            </div>

            <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0 z-10">
                <div className="container mx-auto px-6 py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-0.5">
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200">
                            <Shield className="h-3 w-3 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-700">Configurazione</span>
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Tecnologie
                        </h1>
                        <p className="text-xs text-slate-600">
                            Gestisci le tecnologie disponibili per le stime.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            variant="outline"
                            onClick={loadTechnologies}
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

            <div className="relative flex-1 min-h-0 overflow-hidden z-10 flex flex-col">
                <div className="container mx-auto px-6 py-4 h-full flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
                    <div className="grid xl:grid-cols-3 gap-4 flex-1 min-h-0 pb-2">

                        {/* Form */}
                        <Card className="xl:col-span-1 bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl flex flex-col h-full overflow-hidden">
                            <CardHeader className="py-3 flex-shrink-0 bg-white/50 border-b border-slate-100">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                    {editTech ? (
                                        <>
                                            <Edit3 className="h-4 w-4 text-blue-600" />
                                            Modifica tecnologia
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 text-emerald-600" />
                                            Nuova tecnologia
                                        </>
                                    )}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    {editTech ? 'Modifica i dettagli.' : 'Aggiungi una nuova tecnologia al sistema.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-y-auto p-4">
                                <form className="space-y-3" onSubmit={handleSubmit}>
                                    <div className="space-y-2">
                                        <Label htmlFor="code">Codice</Label>
                                        <Input
                                            id="code"
                                            value={form.code}
                                            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                            placeholder="MY_TECH"
                                            required
                                            disabled={!!editTech}
                                        />
                                        <p className="text-[10px] text-slate-500">Il codice deve essere univoco e non modificabile.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nome</Label>
                                        <Input
                                            id="name"
                                            value={form.name}
                                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                            placeholder="My Technology"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Descrizione</Label>
                                        <Textarea
                                            id="description"
                                            value={form.description}
                                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="color">Colore (HEX)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="color"
                                                type="color"
                                                value={form.color}
                                                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                                                className="w-12 p-1 h-10"
                                            />
                                            <Input
                                                value={form.color}
                                                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                                                placeholder="#000000"
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        {editTech && (
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
                                            className={`flex-1 ${editTech ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                            disabled={saving}
                                        >
                                            {saving ? 'Salvataggio...' : editTech ? 'Salva modifiche' : 'Crea tecnologia'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Table */}
                        <div className="xl:col-span-2 h-full flex flex-col overflow-hidden">
                            <Card className="bg-white/85 backdrop-blur-md border-slate-200/70 shadow-xl flex flex-col h-full overflow-hidden">
                                <CardHeader className="py-3 flex-shrink-0 bg-white/50 border-b border-slate-100">
                                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                        <Cpu className="h-4 w-4 text-slate-700" />
                                        Elenco Tecnologie
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                                    <div className="flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                                    <TableHead>Codice</TableHead>
                                                    <TableHead>Nome</TableHead>
                                                    <TableHead>Colore</TableHead>
                                                    <TableHead className="text-right">Azioni</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {fetching ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                            Caricamento...
                                                        </TableCell>
                                                    </TableRow>
                                                ) : technologies.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                            Nessuna tecnologia trovata
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    technologies.map((tech) => (
                                                        <TableRow key={tech.id}>
                                                            <TableCell className="font-mono text-xs font-semibold">{tech.code}</TableCell>
                                                            <TableCell>
                                                                <div className="font-medium">{tech.name}</div>
                                                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{tech.description}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                                                                        style={{ backgroundColor: tech.color || '#ccc' }}
                                                                    />
                                                                    <span className="text-xs font-mono text-slate-500">{tech.color}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                                        onClick={() => openEdit(tech)}
                                                                    >
                                                                        <Edit3 className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                                                                        onClick={() => setDeleteTech(tech)}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
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

            <AlertDialog open={!!deleteTech} onOpenChange={(open) => !open && setDeleteTech(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Questa azione non può essere annullata. Eliminerà la tecnologia <strong>{deleteTech?.name}</strong>.
                            Assicurati che non ci siano attività collegate.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
