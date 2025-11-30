import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
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
        <div className="min-h-screen bg-slate-50 font-sans overflow-hidden relative">
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

            <Header />

            <main className="container mx-auto px-4 py-10 lg:py-12 max-w-6xl relative z-10">
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                    {/* Hero */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center lg:text-left space-y-5 relative"
                    >
                        <Badge variant="secondary" className="w-fit mx-auto lg:mx-0 px-4 py-1.5 text-sm font-semibold bg-white/80 backdrop-blur-sm border-slate-200 text-slate-700 shadow-sm">
                            <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                            Configurazione
                        </Badge>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                            La tua libreria
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                                personalizzabile
                            </span>
                        </h1>
                        <p className="text-lg text-slate-600 max-w-3xl leading-relaxed font-medium mx-auto lg:mx-0">
                            Gestisci le tue attivita custom e i preset tecnologici personali. Un hub unico per standardizzare il modo in cui il team stima.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Standard condivisi
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/80 border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                Workflow guidati
                            </div>
                        </div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.14, rotate: [0, 4, -3, 0] }}
                            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                            className="hidden lg:block absolute -right-10 -top-10 w-56 h-56 rounded-[32px] bg-gradient-to-br from-indigo-400/60 via-blue-400/50 to-purple-500/40 blur-3xl"
                        />
                    </motion.div>

                    {/* Configuration Hub */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        whileHover={{ scale: 1.01 }}
                        className="group relative p-8 rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-900/30 overflow-hidden min-h-[320px] flex"
                    >
                        <motion.div
                            initial={{ opacity: 0.12, scale: 1 }}
                            animate={{ opacity: [0.12, 0.2, 0.12], scale: [1, 1.03, 1] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950"
                        />
                        <div className="absolute -right-8 -top-6 text-indigo-300/15 group-hover:text-indigo-200/25 transition-colors duration-300">
                            <Settings className="w-36 h-36" />
                        </div>
                        <div className="relative z-10 space-y-5 flex flex-col justify-between w-full">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold uppercase tracking-[0.2em]">
                                Hub
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-bold leading-tight">Centro di configurazione</h2>
                                <p className="text-indigo-100/80 text-base leading-relaxed max-w-2xl">
                                    Personalizza l'esperienza di stima, crea template riutilizzabili e porta coerenza su attivita e preset.
                                </p>
                            </div>
                            <ul className="space-y-3 text-sm text-indigo-100/90">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                    <span>Unifica preset e attivita in standard condivisi</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                    <span>Crea modelli riutilizzabili per le stime</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                    <span>Controllo granulare su driver, rischi e tecnologie</span>
                                </li>
                            </ul>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Button
                                    className="bg-white text-slate-900 hover:bg-slate-100 border-0 shadow-md"
                                    onClick={() => navigate('/configuration/activities')}
                                >
                                    Apri attivita
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-indigo-300 text-white hover:bg-indigo-800/60 hover:text-white"
                                    onClick={() => navigate('/configuration/presets')}
                                >
                                    Vai ai preset
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
