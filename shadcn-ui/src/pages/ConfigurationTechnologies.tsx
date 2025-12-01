import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

            <main className="container mx-auto px-4 pt-4 pb-4 max-w-7xl relative z-10 h-[calc(100vh-80px)] flex flex-col">
                <div className="flex flex-col lg:flex-row gap-6 items-start h-full">
                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="space-y-5 relative lg:w-1/3 pt-4"
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
                            <Shield className="w-4 h-4 mr-2 text-blue-600" />
                            Configurazione
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                            Tecnologie
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                                il cuore del sistema
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed font-medium">
                            Gestisci le tecnologie disponibili per le stime. Definisci i blocchi costruttivi dei tuoi progetti.
                        </p>

                        {/* Form Card */}
                        <div className="mt-4 flex-1 min-h-0 overflow-hidden flex flex-col">
                            <Card className="bg-white/70 backdrop-blur-xl border-white/50 shadow-xl overflow-hidden flex flex-col h-full">
                                <CardHeader className="py-3 bg-white/50 border-b border-slate-100 flex-shrink-0">
                                    <CardTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                        {editTech ? (
                                            <>
                                                <Edit3 className="h-4 w-4 text-blue-600" />
                                                Modifica
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4 text-emerald-600" />
                                                Nuova
                                            </>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 overflow-y-auto flex-1">
                                    <form className="space-y-3" onSubmit={handleSubmit}>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="name" className="text-slate-700 text-xs font-semibold">Nome Tecnologia</Label>
                                            <Input
                                                id="name"
                                                value={form.name}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        name,
                                                        code: !editTech ? name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 20) : prev.code
                                                    }));
                                                }}
                                                placeholder="Es. React Native"
                                                required
                                                className="bg-white border-slate-200 focus:bg-white h-9 text-sm"
                                            />
                                            {!editTech && form.code && (
                                                <p className="text-[10px] text-slate-400 font-mono">Codice: {form.code}</p>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="description" className="text-slate-700 text-xs font-semibold">Descrizione (opzionale)</Label>
                                            <Textarea
                                                id="description"
                                                value={form.description}
                                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                                rows={2}
                                                className="bg-white border-slate-200 focus:bg-white text-sm resize-none"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="color" className="text-slate-700 text-xs font-semibold">Colore</Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    id="color"
                                                    type="color"
                                                    value={form.color}
                                                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                                                    className="w-8 p-0.5 h-8 bg-white border-slate-200 rounded-full overflow-hidden cursor-pointer"
                                                />
                                                <Input
                                                    value={form.color}
                                                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                                                    placeholder="#000000"
                                                    className="flex-1 bg-white border-slate-200 focus:bg-white h-8 text-sm font-mono"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2">
                                            {editTech && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 h-8 text-xs"
                                                    onClick={handleCancelEdit}
                                                >
                                                    Annulla
                                                </Button>
                                            )}
                                            <Button
                                                type="submit"
                                                size="sm"
                                                className={`flex-1 text-white shadow-md border-0 h-8 text-xs ${editTech ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                                disabled={saving}
                                            >
                                                {saving ? '...' : editTech ? 'Salva' : 'Crea'}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>

                    {/* Table Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.1, ease: 'easeInOut' }}
                        className="group relative p-6 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl overflow-hidden w-full lg:flex-1 h-full flex flex-col"
                    >
                        <div className="absolute -right-8 -top-8 text-indigo-500/5 pointer-events-none">
                            <Cpu className="w-40 h-40" />
                        </div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] uppercase tracking-[0.2em] text-indigo-700 font-semibold">
                                        Libreria
                                    </div>
                                    <h2 className="text-2xl font-bold mt-2 leading-tight text-slate-900">Elenco Tecnologie</h2>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadTechnologies}
                                    disabled={fetching}
                                    className="bg-white/50 border-slate-200 text-slate-600 hover:bg-white"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${fetching ? 'animate-spin' : ''}`} />
                                    Aggiorna
                                </Button>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white/50 flex-1 overflow-hidden flex flex-col min-h-0">
                                <div className="overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:thin]">
                                    <Table className="table-fixed w-full">
                                        <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur z-10 shadow-sm">
                                            <TableRow className="hover:bg-slate-100/50 border-slate-200">
                                                <TableHead className="text-slate-700 font-semibold">Codice</TableHead>
                                                <TableHead className="text-slate-700 font-semibold">Nome</TableHead>
                                                <TableHead className="text-slate-700 font-semibold">Colore</TableHead>
                                                <TableHead className="text-right text-slate-700 font-semibold">Azioni</TableHead>
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
                                                    <TableRow key={tech.id} className="hover:bg-slate-50/80 border-slate-100">
                                                        <TableCell className="font-mono text-xs font-semibold text-slate-600">{tech.code}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium text-slate-900">{tech.name}</div>
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
                                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                                    onClick={() => openEdit(tech)}
                                                                >
                                                                    <Edit3 className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
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
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>

            <AlertDialog open={!!deleteTech} onOpenChange={(open) => !open && setDeleteTech(null)}>
                <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900">Sei sicuro?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500">
                            Questa azione non può essere annullata. Eliminerà la tecnologia <strong>{deleteTech?.name}</strong>.
                            Assicurati che non ci siano attività collegate.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-200 text-slate-700">Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white shadow-md">
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
