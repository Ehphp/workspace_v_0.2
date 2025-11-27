import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Shield,
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
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
            {/* Background pattern - fixed layer */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

            {/* Header - flex-shrink-0 to maintain fixed height */}
            <div className="flex-shrink-0 relative z-10">
                <Header />
            </div>

            {/* Hero Section - flex-shrink-0 */}
            <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0 z-10">
                <div className="container mx-auto px-6 py-8 relative">
                    <div className="max-w-4xl mx-auto space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                            <Settings className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700">Configurazione</span>
                        </div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                            La tua Libreria
                        </h1>
                        <p className="text-slate-600 text-lg">
                            Gestisci le tue attività custom e i preset tecnologici personali
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content - NO SCROLL, tutto deve fittare */}
            <div className="relative flex-1 overflow-hidden flex items-center z-10">
                <div className="container mx-auto px-6 py-4 max-h-full w-full">
                    <div className="max-w-6xl mx-auto space-y-4">
                        {/* Welcome Card - Compatta */}
                        <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 border-0 shadow-2xl">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                        <Settings className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1 text-white">
                                        <h2 className="text-lg font-bold mb-1">Centro di configurazione</h2>
                                        <p className="text-sm text-blue-100 leading-tight">
                                            Crea attività custom per estendere il catalogo base e configura preset tecnologici
                                            per standardizzare le stime.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Cards - Compatte */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Custom Activities Card */}
                            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-amber-300 bg-white/90 backdrop-blur-sm cursor-pointer"
                                onClick={() => navigate('/configuration/activities')}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow group-hover:scale-110 transition-transform">
                                            <Wrench className="h-5 w-5 text-white" />
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Attività
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-900">
                                        Attività Personalizzate
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-600">
                                        Crea e gestisci le tue attività
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="space-y-1.5">
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Duplica e personalizza attività</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Crea da zero</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Gestione privata</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100">
                                        <Button
                                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow group"
                                            size="sm"
                                        >
                                            Gestisci attività
                                            <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Custom Presets Card */}
                            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-300 bg-white/90 backdrop-blur-sm cursor-pointer"
                                onClick={() => navigate('/configuration/presets')}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow group-hover:scale-110 transition-transform">
                                            <Layers className="h-5 w-5 text-white" />
                                        </div>
                                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Preset
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-900">
                                        I miei Preset
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-600">
                                        Visualizza e configura preset tecnologici
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="space-y-1.5">
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Visualizza preset disponibili</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Crea preset custom</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span className="font-medium text-slate-900">Standardizza stime</span>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100">
                                        <Button
                                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow group"
                                            size="sm"
                                        >
                                            Gestisci preset
                                            <ArrowRight className="h-3 w-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
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
