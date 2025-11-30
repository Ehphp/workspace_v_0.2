import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
    Wrench,
    Layers,
    ArrowRight,
    Sparkles,
    CheckCircle2,
    Settings,
} from 'lucide-react';

export default function Configuration() {
    const navigate = useNavigate();

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Animated Background Blobs */}
            <motion.div
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, -100, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/3 -right-20 w-[30rem] h-[30rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />
            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, 100, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="absolute bottom-0 left-1/3 w-[25rem] h-[25rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
            />

            {/* Header */}
            <div className="flex-shrink-0 relative z-10">
                <Header />
            </div>

            {/* Main Content Container - Centered vertically */}
            <div className="flex-1 relative z-10 flex flex-col justify-center min-h-0">
                <div className="container mx-auto px-6 h-full flex flex-col justify-center max-h-[900px]">

                    {/* Compact Hero */}
                    <div className="mb-6 space-y-2 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50/80 border border-amber-200/50 backdrop-blur-sm">
                            <Settings className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-xs font-semibold text-amber-700">Configurazione</span>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-sm">
                            La tua Libreria
                        </h1>
                        <p className="text-slate-600 text-base font-medium max-w-2xl">
                            Gestisci le tue attività custom e i preset tecnologici personali
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-6 items-stretch">
                        {/* Welcome Card - Spans 1 column on large screens */}
                        <Card className="lg:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-600 border-0 shadow-xl relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 mix-blend-overlay" />
                            <CardContent className="p-6 relative z-10">
                                <div className="flex flex-col items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
                                        <Settings className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="text-white space-y-2">
                                        <h2 className="text-xl font-bold">Centro di configurazione</h2>
                                        <p className="text-blue-100 text-sm leading-relaxed">
                                            Il tuo hub centrale per personalizzare l'esperienza di stima. Estendi le funzionalità base e crea standard riutilizzabili.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Cards - Spans 2 columns */}
                        <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                            {/* Custom Activities Card */}
                            <Card className="group hover:shadow-xl transition-all duration-300 border border-white/50 bg-white/60 backdrop-blur-md cursor-pointer hover:-translate-y-1 flex flex-col"
                                onClick={() => navigate('/configuration/activities')}>
                                <CardHeader className="pb-3 pt-5 px-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <Wrench className="h-5 w-5 text-white" />
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-2 py-0.5">
                                            Attività
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                        Attività Custom
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-600 line-clamp-1">
                                        Crea e gestisci le tue attività
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-between space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs text-slate-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>Duplica e personalizza</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>Crea da zero</span>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm group"
                                    >
                                        Gestisci
                                        <ArrowRight className="h-3 w-3 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Custom Presets Card */}
                            <Card className="group hover:shadow-xl transition-all duration-300 border border-white/50 bg-white/60 backdrop-blur-md cursor-pointer hover:-translate-y-1 flex flex-col"
                                onClick={() => navigate('/configuration/presets')}>
                                <CardHeader className="pb-3 pt-5 px-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <Layers className="h-5 w-5 text-white" />
                                        </div>
                                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] px-2 py-0.5">
                                            Preset
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                        I miei Preset
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-600 line-clamp-1">
                                        Configura preset tecnologici
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-between space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs text-slate-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>Visualizza preset</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>Standardizza stime</span>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full h-8 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-sm group"
                                    >
                                        Gestisci
                                        <ArrowRight className="h-3 w-3 ml-1.5 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
