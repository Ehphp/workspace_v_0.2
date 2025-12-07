import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';
import { RingParticlesBackground } from '@/components/RingParticlesBackground';
import { usePresetManagement, initialPresetForm, type PresetForm, type PresetView } from '@/hooks/usePresetManagement';
import { TechnologyDialog } from '@/components/configuration/presets/TechnologyDialog';
import { PresetPreviewDialog } from '@/components/configuration/presets/PresetPreviewDialog';
import { PresetTableRow } from '@/components/configuration/presets/PresetTableRow';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Plus, CheckCircle2, Sparkles, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function ConfigurationPresets() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const {
        loading,
        saving,
        presets,
        allActivities,
        allDrivers,
        allRisks,
        techCategories,
        savePreset,
        deletePreset,
    } = usePresetManagement(user?.id);

    // UI State
    const [viewFilter, setViewFilter] = useState<'ALL' | 'OOTB' | 'CUSTOM'>('ALL');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<PresetForm>(initialPresetForm);
    const [selectedPreview, setSelectedPreview] = useState<PresetView | null>(null);

    const particlesConfig = useMemo(() => ({
        shape: 'ring' as const,
        particleCount: 800,
        radius: 38,
        thickness: 18,
        particleSize: [1, 5] as [number, number],
        alphaRange: [0.5, 1.0] as [number, number],
        color: { h: 120, s: 80 },
        drift: 0.1,
        angularSpeed: 0.03,
        noiseFrequency: 0.9,
        noiseAmplitude: 6,
        seed: 42069,
        blendMode: 'normal' as GlobalCompositeOperation,
        repeatPattern: true,
        responsive: {
            maxParticlesMobile: 200,
            scaleWithDPR: true
        },
        accessibility: {
            prefersReducedMotion: true
        }
    }), []);

    const filteredPresets = useMemo(() => {
        let list = presets;
        if (viewFilter === 'OOTB') list = list.filter(p => !p.is_custom);
        if (viewFilter === 'CUSTOM') list = list.filter(p => p.is_custom);
        return list;
    }, [presets, viewFilter]);

    const handleCreate = () => {
        setEditingId(null);
        setForm(initialPresetForm);
        setIsDialogOpen(true);
    };

    const handleEdit = (preset: PresetView) => {
        if (!preset.is_custom || preset.created_by !== user?.id) {
            toast.error('Non puoi modificare questa tecnologia');
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
        toast.message('Tecnologia duplicata', { description: 'Modifica e salva la nuova tecnologia custom.' });
    };

    const handleSave = async (data: PresetForm) => {
        const success = await savePreset(data, editingId);
        if (success) {
            setIsDialogOpen(false);
        }
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
            {/* Ring Particles Animated Background */}
            <RingParticlesBackground
                usePaintWorklet={false}
                enableMouseInteraction={!isDialogOpen}
                config={particlesConfig}
            />

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
                            Tecnologie
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
                                {presets.length} tecnologie totali
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
                                Crea nuova tecnologia
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
                                    <h2 className="text-2xl font-bold mt-2 leading-tight text-slate-900">Elenco Tecnologie</h2>
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
                                                        Nessuna tecnologia trovata
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredPresets.map((preset) => (
                                                    <PresetTableRow
                                                        key={preset.id}
                                                        preset={preset}
                                                        userId={user?.id}
                                                        onPreview={setSelectedPreview}
                                                        onEdit={handleEdit}
                                                        onDuplicate={handleDuplicate}
                                                        onDelete={deletePreset}
                                                    />
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

            <TechnologyDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                initialData={form}
                // onFormChange is handled internally by useForm in TechnologyDialog
                onSave={async (data) => {
                    setForm(data); // Sync for edit mode if needed, though mostly for re-opening
                    await handleSave(data);
                }}
                saving={saving}
                isEditing={!!editingId}
                editingId={editingId}
                allActivities={allActivities}
                allDrivers={allDrivers}
                allRisks={allRisks}
                techCategories={techCategories}
            />

            <PresetPreviewDialog
                preset={selectedPreview}
                onOpenChange={() => setSelectedPreview(null)}
            />
        </div>
    );
}
