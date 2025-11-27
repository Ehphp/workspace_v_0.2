import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Shield, Clock, User as UserIcon } from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 overflow-hidden">
            <Header />

            <main className="container mx-auto px-6 py-8 flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Account</Badge>
                            <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
                            <p className="text-sm text-slate-600">Dettagli del tuo account e preferenze base.</p>
                        </div>
                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-white">Gestione sicurezza</Button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-md md:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <UserIcon className="h-5 w-5 text-blue-600" />
                                    Dati utente
                                </CardTitle>
                                <CardDescription>Informazioni di base del profilo.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 bg-slate-50/60">
                                    <Mail className="h-4 w-4 text-slate-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">Email</p>
                                        <p className="text-sm font-semibold text-slate-900 truncate">{user?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 bg-slate-50/60">
                                    <Shield className="h-4 w-4 text-amber-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">User ID</p>
                                        <p className="text-sm font-mono text-slate-800 break-all">{user?.id}</p>
                                    </div>
                                </div>
                                {user?.created_at && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/70 bg-slate-50/60">
                                        <Clock className="h-4 w-4 text-emerald-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-500">Registrato il</p>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {new Date(user.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Preferenze</CardTitle>
                                <CardDescription>Impostazioni in arrivo.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-slate-600">
                                    Stiamo preparando notifiche, lingua e opzioni di esportazione.
                                </p>
                                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                                    Attiva notifiche
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
