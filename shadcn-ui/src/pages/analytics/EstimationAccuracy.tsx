/**
 * EstimationAccuracy — Analytics page showing estimation accuracy metrics.
 *
 * Displays scatter plot (estimated vs actual), KPI cards, top deviations bar chart,
 * and accuracy breakdown by technology.
 *
 * Sprint 2 — S2-3c
 */

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Header } from '@/components/layout/Header';
import { AccuracyScatterChart } from '@/components/charts/AccuracyScatterChart';
import { DeviationBarChart } from '@/components/charts/DeviationBarChart';
import { TechnologyAccuracyChart } from '@/components/charts/TechnologyAccuracyChart';
import { useAccuracyData } from '@/hooks/useAccuracyData';
import {
    ArrowLeft,
    Target,
    TrendingDown,
    TrendingUp,
    BarChart3,
    Activity,
    RefreshCw,
    ClipboardCheck,
} from 'lucide-react';

export default function EstimationAccuracy() {
    const navigate = useNavigate();
    const {
        scatterData,
        averageDeviation,
        medianDeviation,
        totalWithActuals,
        overEstimatedCount,
        underEstimatedCount,
        byTechnology,
        loading,
        error,
        refresh,
    } = useAccuracyData();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
            <Header />

            {/* Page Header */}
            <div className="flex-shrink-0 border-b border-white/50 bg-white/60 backdrop-blur-xl">
                <div className="container mx-auto max-w-7xl px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="rounded-xl"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                                    Accuratezza Stime
                                </h1>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Confronto tra stime e consuntivi reali
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refresh}
                            disabled={loading}
                            className="rounded-xl"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Aggiorna
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="container mx-auto max-w-7xl px-6 py-6 space-y-6">

                    {/* Error state */}
                    {error && (
                        <Card className="border-red-200 bg-red-50/50">
                            <CardContent className="py-4 text-sm text-red-700">
                                {error}
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center space-y-3">
                                <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                                <p className="text-sm text-slate-500">Caricamento dati accuratezza…</p>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && totalWithActuals === 0 && (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <ClipboardCheck className="w-12 h-12 text-slate-300 mb-4" />
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                    Nessun consuntivo registrato
                                </h3>
                                <p className="text-sm text-slate-500 max-w-md">
                                    Per visualizzare le analisi di accuratezza, compila i dati nella tab
                                    "Consuntivo" dei singoli requisiti.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Dashboard content (only when data available) */}
                    {!loading && !error && totalWithActuals > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <KpiCard
                                    icon={Target}
                                    label="Con Consuntivo"
                                    value={totalWithActuals}
                                    gradient="from-white to-blue-50/80"
                                    iconGradient="from-blue-500 to-indigo-600"
                                    subtitle="stime"
                                />
                                <KpiCard
                                    icon={Activity}
                                    label="Scostamento Medio"
                                    value={`${averageDeviation}%`}
                                    gradient="from-white to-purple-50/80"
                                    iconGradient="from-purple-500 to-pink-600"
                                    subtitle="valore assoluto"
                                />
                                <KpiCard
                                    icon={BarChart3}
                                    label="Scostamento Mediano"
                                    value={`${medianDeviation}%`}
                                    gradient="from-white to-indigo-50/80"
                                    iconGradient="from-indigo-500 to-violet-600"
                                    subtitle="valore assoluto"
                                />
                                <KpiCard
                                    icon={TrendingDown}
                                    label="Sovrastimate"
                                    value={overEstimatedCount}
                                    gradient="from-white to-emerald-50/80"
                                    iconGradient="from-emerald-500 to-teal-600"
                                    subtitle="stima > effettivo"
                                />
                                <KpiCard
                                    icon={TrendingUp}
                                    label="Sottostimate"
                                    value={underEstimatedCount}
                                    gradient="from-white to-red-50/80"
                                    iconGradient="from-red-500 to-rose-600"
                                    subtitle="stima < effettivo"
                                />
                            </div>

                            {/* Charts row: Scatter (2/3) + Technology (1/3) */}
                            <div className="grid grid-cols-12 gap-4">
                                <Card className="col-span-12 lg:col-span-8">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-semibold text-slate-800">
                                            Stima vs Effettivo
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[380px]">
                                            <AccuracyScatterChart data={scatterData} />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="col-span-12 lg:col-span-4">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-semibold text-slate-800">
                                            Accuratezza per Tecnologia
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[380px]">
                                            <TechnologyAccuracyChart data={byTechnology} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Deviation bar chart (full width) */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-semibold text-slate-800">
                                        Top 10 Scostamenti
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[400px]">
                                        <DeviationBarChart data={scatterData} maxItems={10} />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
