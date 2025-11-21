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

export default function Admin() {
    const navigate = useNavigate();

    return (
        <div className="relative h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

            {/* Fixed Header */}
            <Header />

            {/* Hero Section */}
            <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0">
                <div className="container mx-auto px-6 py-8 relative">
                    <div className="max-w-4xl mx-auto space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                            <Shield className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700">Amministrazione</span>
                        </div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                            Catalogo Personalizzato
                        </h1>
                        <p className="text-slate-600 text-lg">
                            Gestisci le tue attività custom e i preset tecnologici personalizzati
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative flex-1 overflow-y-auto">
                <div className="container mx-auto px-6 py-12">
                    <div className="max-w-6xl mx-auto">
                        {/* Welcome Card */}
                        <Card className="mb-8 bg-gradient-to-br from-blue-600 to-indigo-600 border-0 shadow-2xl">
                            <CardContent className="p-8">
                                <div className="flex items-start gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                                        <Settings className="h-8 w-8 text-white" />
                                    </div>
                                    <div className="flex-1 text-white">
                                        <h2 className="text-2xl font-bold mb-2">Centro di personalizzazione</h2>
                                        <p className="text-blue-100 leading-relaxed">
                                            Crea attività custom per estendere il catalogo base e configura preset tecnologici
                                            per standardizzare le stime dei tuoi progetti. Tutte le personalizzazioni sono
                                            salvate e disponibili per tutti i tuoi requisiti.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Cards */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Custom Activities Card */}
                            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-amber-300 bg-white/90 backdrop-blur-sm cursor-pointer"
                                onClick={() => navigate('/admin/activities')}>
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                            <Wrench className="h-7 w-7 text-white" />
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Attività
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-2xl font-bold text-slate-900">
                                        Custom Activities
                                    </CardTitle>
                                    <CardDescription className="text-base text-slate-600">
                                        Crea, modifica e gestisci attività personalizzate
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Duplica attività OOTB</span>
                                                <p className="text-slate-500 text-xs">Personalizza le attività di sistema esistenti</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Crea da zero</span>
                                                <p className="text-slate-500 text-xs">Definisci nome, peso e categoria tecnologica</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Filtra e gestisci</span>
                                                <p className="text-slate-500 text-xs">Visualizza per tecnologia, fase e origine</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <Button
                                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg group"
                                            size="lg"
                                        >
                                            Gestisci attività
                                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Custom Presets Card */}
                            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-300 bg-white/90 backdrop-blur-sm cursor-pointer"
                                onClick={() => navigate('/presets')}>
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                            <Layers className="h-7 w-7 text-white" />
                                        </div>
                                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Preset
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-2xl font-bold text-slate-900">
                                        Technology Presets
                                    </CardTitle>
                                    <CardDescription className="text-base text-slate-600">
                                        Visualizza e configura preset tecnologici
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Visualizza preset disponibili</span>
                                                <p className="text-slate-500 text-xs">Esplora Power Platform, Backend, Frontend e più</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Attività predefinite</span>
                                                <p className="text-slate-500 text-xs">Ogni preset include attività, driver e risk consigliati</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 text-sm">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-medium text-slate-900">Standardizza stime</span>
                                                <p className="text-slate-500 text-xs">Applica template per velocizzare il processo</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <Button
                                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg group"
                                            size="lg"
                                        >
                                            Esplora preset
                                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Info Section */}
                        <Card className="mt-8 border-blue-200 bg-blue-50/50 backdrop-blur-sm">
                            <CardContent className="p-6">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <Shield className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-900 mb-1">Note sulla personalizzazione</h3>
                                        <ul className="text-sm text-slate-600 space-y-1">
                                            <li>• Le attività custom sono visibili solo a te e possono essere modificate in qualsiasi momento</li>
                                            <li>• I preset tecnologici sono condivisi nel sistema e forniscono template standardizzati</li>
                                            <li>• Tutte le modifiche ai pesi delle attività influenzano immediatamente i calcoli delle stime</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
