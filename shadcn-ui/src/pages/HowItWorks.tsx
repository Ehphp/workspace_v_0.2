import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

const quickActions = [
  { title: 'Stima rapida', desc: 'Descrizione + stack e ottieni subito giorni stimati', cta: 'Prova la stima rapida', state: { openQuick: true } },
  { title: 'Wizard avanzato', desc: 'Configura attivita, driver e rischi in 5 step', cta: 'Apri il wizard avanzato', state: { openWizard: true } },
];

const pillars = [
  { title: 'Velocita', desc: 'Stima iniziale in pochi minuti con input minimi', badge: 'Fast' },
  { title: 'Trasparenza', desc: 'Formula visibile e breakdown per attivita e driver', badge: 'Clear' },
  { title: 'Flessibilita', desc: 'Passa dal quick al wizard completo quando serve', badge: 'Flexible' },
];

const carouselSteps = [
  {
    num: '1',
    title: 'Describe Requirement',
    desc: 'Inserisci titolo e descrizione dettagliata del requisito da stimare',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
    color: 'from-blue-500 to-cyan-500',
    bg: 'from-blue-50 to-cyan-50',
  },
  {
    num: '2',
    title: 'Select Technology',
    desc: 'Scegli tra 20+ preset tecnologici o personalizza il tuo stack',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
    color: 'from-indigo-500 to-purple-500',
    bg: 'from-indigo-50 to-purple-50',
  },
  {
    num: '3',
    title: 'AI Suggestions',
    desc: 'Ricevi suggerimenti intelligenti sulle attivita da OpenAI (temperature 0)',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
    color: 'from-purple-500 to-pink-500',
    bg: 'from-purple-50 to-pink-50',
  },
  {
    num: '4',
    title: 'Configure Drivers & Risks',
    desc: 'Affina i moltiplicatori di complessita e i fattori di rischio',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
    color: 'from-pink-500 to-rose-500',
    bg: 'from-pink-50 to-rose-50',
  },
  {
    num: '5',
    title: 'View Results',
    desc: 'Ottieni la stima dettagliata con calcoli trasparenti e breakdown completo',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    color: 'from-rose-500 to-orange-500',
    bg: 'from-rose-50 to-orange-50',
  },
];

export default function HowItWorks() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSteps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSteps.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSteps.length) % carouselSteps.length);
  };

  const currentStep = carouselSteps[currentSlide];

  return (
    <div className="relative h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>

      <Header />

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0">
          <div className="container mx-auto px-6 py-8 relative">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">Come funziona</span>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                Stima rapida o wizard avanzato
              </h1>
              <p className="text-slate-600 text-lg">
                Usa la stima rapida con AI e preset tecnologici, o passa al wizard completo per controllare ogni dettaglio
              </p>
            </div>
          </div>
        </div>

        {/* Main Content - inside scroll, no outer scrollbar */}
        <div className="flex-1 min-h-0">
          <div className="container mx-auto px-4 py-4 h-full">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-4 h-full items-stretch">
              {/* Left Column - Info Cards */}
              <div className="space-y-3 flex flex-col h-full min-h-0">
                <div className="space-y-3 overflow-y-auto pr-2 no-scrollbar">
                  {/* Quick Actions Card */}
                  <Card className="border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-lg min-h-[110px]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Azioni rapide</CardTitle>
                      <CardDescription>Apri subito la modalita che ti serve</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {quickActions.map((item) => (
                        <div key={item.title} className="p-3 rounded-xl border border-slate-100 flex items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{item.desc}</p>
                          </div>
                          <Link to="/" state={item.state}>
                            <Button size="sm" variant="ghost" className="text-blue-700 hover:bg-blue-50 flex-shrink-0">
                              Apri
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Pillars Card */}
                  <Card className="border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-lg min-h-[110px]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Perche Synntero</CardTitle>
                      <CardDescription>I pilastri del nostro sistema di stima</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pillars.map((pillar) => (
                        <div key={pillar.title} className="p-3 rounded-xl border border-slate-100 bg-slate-50/70">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-slate-900 text-white">{pillar.badge}</Badge>
                            <p className="text-sm font-semibold text-slate-900">{pillar.title}</p>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{pillar.desc}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Example Card */}
                  <Card className="border-slate-200/70 bg-gradient-to-br from-blue-50 via-white to-emerald-50 backdrop-blur shadow-lg min-h-[110px]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Esempio rapido</CardTitle>
                      <CardDescription>Portale utenti con login e reset password</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">AI: Auth + UI + Email</Badge>
                        <Badge variant="secondary">12.5 gg</Badge>
                        <Badge variant="secondary">React + Node</Badge>
                      </div>
                      <p className="text-xs leading-relaxed">
                        Scrivi il requisito, scegli il preset e il sistema propone attivita e calcola i giorni.
                        Per rischi o driver passa al wizard avanzato.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3 pt-1">
                        <Link to="/" state={{ openQuick: true }}>
                          <Button size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 w-full">
                            Prova ora
                          </Button>
                        </Link>
                        <Link to="/register">
                          <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 w-full">
                            Registrati
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right Column - Carousel */}
              <div className="h-full min-h-0">
                <Card className="border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-xl overflow-hidden flex flex-col h-full min-h-0">
                  <CardHeader className="pb-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl">Wizard in 5 step</CardTitle>
                        <CardDescription className="mt-1">Processo guidato per stime dettagliate</CardDescription>
                      </div>
                      <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
                        Advanced
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    {/* Carousel Container */}
                    <div className="relative flex-1 min-h-0 flex flex-col">
                      {/* Main Slide */}
                      <div className={`bg-gradient-to-br ${currentStep.bg} p-4 flex-1 min-h-0 flex flex-col justify-between gap-6 transition-all duration-500`}>
                        <div className="space-y-6">
                          {/* Step Header */}
                          <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${currentStep.color} shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform duration-300`}>
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {currentStep.icon}
                              </svg>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-slate-500 mb-1">Step {currentStep.num} di 5</div>
                              <h3 className="text-2xl font-bold text-slate-900 mb-2">{currentStep.title}</h3>
                              <p className="text-sm text-slate-700 leading-relaxed">{currentStep.desc}</p>
                            </div>
                          </div>

                          {/* Progress Dots */}
                          <div className="flex items-center gap-2 pt-4">
                            {carouselSteps.map((_, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide
                                  ? `w-8 bg-gradient-to-r ${currentStep.color}`
                                  : 'w-2 bg-slate-300 hover:bg-slate-400'
                                  }`}
                                aria-label={`Vai allo step ${idx + 1}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            onClick={prevSlide}
                            variant="outline"
                            size="sm"
                            className="border-slate-300 hover:bg-white/80"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Precedente
                          </Button>
                          <div className="text-xs text-slate-500 font-medium">
                            Auto-play ogni 4s
                          </div>
                          <Button
                            onClick={nextSlide}
                            variant="outline"
                            size="sm"
                            className="border-slate-300 hover:bg-white/80"
                          >
                            Successivo
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>

                      {/* Quick Steps Overview */}
                      <div className="p-2 bg-slate-50/50 border-t border-slate-100 flex-shrink-0">
                        <div className="flex items-center justify-between text-xs">
                          {carouselSteps.map((step, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${idx === currentSlide ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${step.color} flex items-center justify-center shadow ${idx === currentSlide ? 'ring-2 ring-offset-2 ring-slate-300' : ''
                                }`}>
                                <span className="text-white font-bold text-xs">{step.num}</span>
                              </div>
                              <span className="text-[10px] font-medium text-slate-600 max-w-[60px] text-center leading-tight">
                                {step.title.split(' ')[0]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* CTA Section */}
                    <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="font-bold text-lg">Pronto a iniziare?</p>
                          <p className="text-sm text-blue-100">Prova il wizard completo con tutti i 5 step</p>
                        </div>
                        <Link to="/" state={{ openWizard: true }}>
                          <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                            Apri Wizard
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
