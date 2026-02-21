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

            <main className="container mx-auto px-4 pt-4 pb-4 max-w-6xl relative z-10 h-[calc(100vh-64px)] flex flex-col">
                {/* Main Content Card - Full Width */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="group relative p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl overflow-hidden w-full h-full flex flex-col"
                >
                    <div className="absolute -right-8 -top-8 text-indigo-500/5 pointer-events-none">
                        <Layers className="w-40 h-40" />
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
                                    <h1 className="text-base font-semibold text-slate-900">Gestione Tecnologie</h1>
                                    <p className="text-xs text-slate-500">Configura i template di stima predefiniti per ogni tecnologia.</p>
                                </div>
                            </div>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm text-xs h-8"
                                onClick={handleCreate}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1.5" />
                                Nuova Tecnologia
                            </Button>
                        </div>

                        {/* Stats & Filters Row */}
                        <div className="flex items-center justify-between py-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    {presets.length} totali
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    {presets.filter(p => p.is_custom).length} custom
                                </div>
                            </div>
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
                        </div>

                        {/* Table Section */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/30 flex-1 overflow-hidden flex flex-col min-h-0">
                            <div className="overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:thin]">
                                <Table className="table-fixed w-full">
                                    <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm">
                                        <TableRow className="hover:bg-slate-100/50 border-slate-200">
                                            <TableHead className="text-slate-700 font-semibold text-xs w-[30%]">Nome</TableHead>
                                            <TableHead className="text-slate-700 font-semibold text-xs w-[15%]">Categoria</TableHead>
                                            <TableHead className="text-slate-700 font-semibold text-xs w-[30%] hidden md:table-cell">Contenuto</TableHead>
                                            <TableHead className="text-right text-slate-700 font-semibold text-xs w-[25%]">Azioni</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPresets.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Layers className="w-8 h-8 opacity-30" />
                                                        <p className="text-sm">Nessuna tecnologia trovata</p>
                                                    </div>
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
            </main>

            <TechnologyDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                initialData={form}
                onSave={async (data) => {
                    setForm(data);
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
