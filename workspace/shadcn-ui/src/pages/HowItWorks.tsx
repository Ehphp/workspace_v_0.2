import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Wand2,
  Database,
  GitBranch,
  Shield,
  Lock,
  CheckCircle2,
  Code2,
  Building2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRef } from 'react';
import { RingParticlesBackground } from '@/components/RingParticlesBackground';

const steps = [
  {
    icon: Wand2,
    title: 'Descrivi il Requisito',
    description: 'Scrivi come parli. L\'AI capisce il contesto e valida automaticamente.',
    example: '"Integrazione CRM con notifiche push"',
    time: '10 sec',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  {
    icon: Database,
    title: 'Scegli la Tecnologia',
    description: 'Un click. L\'AI carica il tuo catalogo attività personalizzato.',
    example: 'Power Platform • .NET • React • Multi-stack',
    time: '5 sec',
    gradient: 'from-indigo-500 to-purple-500',
    bgGradient: 'from-indigo-50 to-purple-50',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-500',
  },
  {
    icon: GitBranch,
    title: 'Rispondi alle Domande',
    description: 'L\'AI ti fa 4-6 domande mirate. Nessun testo libero, solo click.',
    example: 'Complessità? Integrazioni? Scope?',
    time: '30 sec',
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-50 to-pink-50',
    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    icon: Shield,
    title: 'Ricevi la Stima',
    description: 'Breakdown dettagliato per fase. Ore già calcolate dal tuo catalogo.',
    example: 'Analisi • Sviluppo • Test • Deploy',
    time: '~2 min',
    gradient: 'from-pink-500 to-rose-500',
    bgGradient: 'from-pink-50 to-rose-50',
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
  },
  {
    icon: Lock,
    title: 'Blocca e Presenta',
    description: 'Aggiungi buffer di rischio, blocca i margini, esporta per il cliente.',
    example: 'PDF professionale in un click',
    time: '30 sec',
    gradient: 'from-emerald-500 to-teal-500',
    bgGradient: 'from-emerald-50 to-teal-50',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function HowItWorks() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative overflow-hidden">
      {/* Ring Particles Animated Background */}
      <RingParticlesBackground
        usePaintWorklet={false}
        enableMouseInteraction={true}
        config={{
          shape: 'ring',
          particleCount: 800,
          radius: 38,
          thickness: 18,
          particleSize: [1, 5],
          alphaRange: [0.5, 1.0],
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
        }}
      />

      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-[2]" />

      {/* Animated Background Blobs */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/3 -right-20 w-[30rem] h-[30rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
      />
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 100, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-1/3 w-[25rem] h-[25rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none z-[2]"
      />

      <Header />

      <main className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative z-10">
        <Tabs defaultValue="overview" className="space-y-12">
          <div className="text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-6 px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 shadow-lg shadow-blue-500/25">
                <Sparkles className="w-4 h-4 mr-2 inline animate-pulse" />
                Powered by GPT-4o
              </Badge>
              <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 drop-shadow-sm">
                Stop alle Stime "a Occhio" <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">
                  Inizia a Guadagnare
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium mb-6">
                L'AI ti fa le domande giuste. Tu rispondi con un click. In 3 minuti hai una stima professionale che protegge i tuoi margini.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10">
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">3 min</div>
                  <div className="text-sm text-slate-500 font-medium">Per stima completa</div>
                </div>
                <div className="w-px h-12 bg-slate-200 hidden md:block" />
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">0%</div>
                  <div className="text-sm text-slate-500 font-medium">Varianza tra stime</div>
                </div>
                <div className="w-px h-12 bg-slate-200 hidden md:block" />
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">100%</div>
                  <div className="text-sm text-slate-500 font-medium">Basato sul TUO catalogo</div>
                </div>
              </div>

              <TabsList className={`grid w-full max-w-md mx-auto ${user ? 'grid-cols-2' : 'grid-cols-1'} bg-white/50 backdrop-blur-sm border border-slate-200/60 p-1 rounded-full`}>
                <TabsTrigger value="overview" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                  Panoramica
                </TabsTrigger>
                {user && (
                  <TabsTrigger value="workflow" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                    Workflow Stati
                  </TabsTrigger>
                )}
              </TabsList>
            </motion.div>
          </div>

          <TabsContent value="overview" className="mt-0">
            {/* Modern Horizontal Flow */}
            <div ref={containerRef} className="relative mb-24 pt-8">
              {/* Desktop: Horizontal cards */}
              <div className="hidden lg:block">
                {/* Connection Line */}
                <div className="absolute top-[4.5rem] left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full opacity-20" />

                <div className="grid grid-cols-5 gap-4">
                  {steps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="relative"
                    >
                      {/* Step Number Circle */}
                      <div className="flex justify-center mb-4">
                        <div className={`w-16 h-16 rounded-2xl ${step.iconBg} flex items-center justify-center shadow-lg shadow-slate-900/10 relative z-10`}>
                          <step.icon className="w-7 h-7 text-white" />
                        </div>
                      </div>

                      {/* Card */}
                      <div className={`p-5 rounded-2xl bg-gradient-to-br ${step.bgGradient} border border-white/60 shadow-lg hover:shadow-xl transition-all duration-300 group h-full`}>
                        {/* Time Badge */}
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-bold text-slate-400">STEP {index + 1}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full bg-gradient-to-r ${step.gradient} text-white`}>
                            {step.time}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{step.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed mb-3">{step.description}</p>

                        {/* Example */}
                        <div className="pt-3 border-t border-slate-200/50">
                          <p className="text-xs text-slate-500 italic">{step.example}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Total Time */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="flex justify-center mt-12 relative z-20"
                >
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-default">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <span className="font-semibold">Tempo totale: ~3 minuti</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </div>

              {/* Mobile: Vertical cards */}
              <div className="lg:hidden space-y-4">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.08 }}
                    className={`p-5 rounded-2xl bg-gradient-to-br ${step.bgGradient} border border-white/60 shadow-lg`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${step.iconBg} flex items-center justify-center shadow-md flex-shrink-0`}>
                        <step.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-400">STEP {index + 1}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${step.gradient} text-white`}>
                            {step.time}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">{step.title}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Mobile Total Time */}
                <div className="flex justify-center pt-4">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white shadow-lg text-sm">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="font-semibold">~3 minuti totali</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI-Powered Estimation Flow Section */}
            <div className="mb-24">
              <div className="text-center mb-12">
                <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-200 text-blue-700">
                  <Sparkles className="w-3 h-3 mr-2 inline" />
                  La Differenza
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Perché Questa AI è Diversa</h2>
                <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                  Non è ChatGPT che "inventa" numeri. È un sistema che usa <strong>le tue regole</strong>, <strong>il tuo catalogo</strong>, <strong>i tuoi prezzi</strong>. L'AI decide solo quali attività includere.
                </p>
              </div>

              {/* AI Flow Cards */}
              <div className="space-y-8">
                {/* Step 1: Technical Interview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      1
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-3">L'AI Ti Fa le Domande Giuste</h3>
                      <p className="text-slate-600 mb-4 leading-relaxed">
                        Basta perdere tempo a scrivere documenti. L'AI capisce il requisito e ti fa <strong>solo le domande che contano</strong> per stimare correttamente. Rispondi con un click, non con un documento.
                      </p>
                      <div className="grid md:grid-cols-3 gap-4 mt-6">
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                          <div className="text-sm font-semibold text-blue-700 mb-1">Zero Testo Libero</div>
                          <div className="text-xs text-blue-600">Solo click su opzioni pronte</div>
                        </div>
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                          <div className="text-sm font-semibold text-indigo-700 mb-1">Domande Mirate</div>
                          <div className="text-xs text-indigo-600">Cambiano in base allo stack scelto</div>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                          <div className="text-sm font-semibold text-purple-700 mb-1">30 Secondi</div>
                          <div className="text-xs text-purple-600">Per rispondere a tutto</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Step 2: Activity Selection */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      2
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-3">Usa il TUO Catalogo Attività</h3>
                      <p className="text-slate-600 mb-4 leading-relaxed">
                        L'AI non inventa ore a caso. Seleziona attività <strong>dal catalogo che hai già configurato</strong> con le tue tariffe e i tuoi tempi standard. Il risultato? Stime coerenti con la tua storia.
                      </p>
                      <div className="bg-slate-900 rounded-xl p-5 text-sm mt-4">
                        <div className="text-slate-400 mb-3 text-xs uppercase tracking-wide">Esempio di output generato</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300">📋 Analisi requisiti</span>
                            <span className="text-emerald-400 font-semibold">4h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300">⚙️ Sviluppo backend API</span>
                            <span className="text-emerald-400 font-semibold">16h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300">🎨 Interfaccia utente</span>
                            <span className="text-emerald-400 font-semibold">8h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-300">🧪 Testing e QA</span>
                            <span className="text-emerald-400 font-semibold">4h</span>
                          </div>
                          <div className="border-t border-slate-700 pt-2 mt-3 flex justify-between items-center">
                            <span className="text-white font-semibold">Totale stimato</span>
                            <span className="text-yellow-400 font-bold text-lg">32h → 4 giorni</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Step 3: Deterministic Estimation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-3">Stesse Domande = Stessa Stima. Sempre.</h3>
                      <p className="text-slate-600 mb-4 leading-relaxed">
                        Non è magia, è ingegneria. <strong>Stesso requisito + stesse risposte = stessa stima</strong>. Oggi, domani, tra un anno. Puoi fidarti dei numeri che presenti al cliente.
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                          <div className="flex items-center gap-3 mb-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                            <span className="font-bold text-green-800">Testato: 0% Varianza</span>
                          </div>
                          <p className="text-sm text-green-700">
                            Abbiamo eseguito 5 stime identiche. Risultato: 5 output identici. Verificabile.
                          </p>
                        </div>
                        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                          <div className="flex items-center gap-3 mb-3">
                            <Shield className="w-6 h-6 text-blue-600" />
                            <span className="font-bold text-blue-800">Niente Invenzioni</span>
                          </div>
                          <p className="text-sm text-blue-700">
                            L'AI non può "inventare" attività. Può solo scegliere tra quelle nel tuo catalogo.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Why It Works */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="relative p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-3xl" />
                  <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-yellow-400" />
                      La Tecnologia Dietro le Quinte
                    </h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-lg font-semibold text-blue-300 mb-2">Risposte Vincolate</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          L'AI può rispondere SOLO con codici attività validi del tuo catalogo. Non può inventare.
                        </p>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-indigo-300 mb-2">Zero Casualità</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          Configurazione "deterministica": stessa domanda = stessa risposta. Sempre. Garantito.
                        </p>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-purple-300 mb-2">Regole, Non Opinioni</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          L'AI segue regole precise, non "pensa". Se menzioni X, include Y. Nessuna interpretazione.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* CTA */}
              <div className="text-center mt-12">
                <Link to={user ? "/dashboard" : "/register"}>
                  <Button size="lg" className="h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/25">
                    {user ? "Prova ora nella Dashboard" : "Inizia Gratuitamente"}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </TabsContent>

          {user && (
            <TabsContent value="workflow" className="mt-8 space-y-12">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Personal Space Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-2xl bg-green-100 text-green-600">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Spazio Personale</h2>
                  </div>
                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Massima flessibilità. Nello spazio personale non ci sono regole rigide. Puoi spostare un requisito da qualsiasi stato a qualsiasi altro. Ideale per il brainstorming e i progetti rapidi.
                  </p>
                  <ul className="space-y-3 text-sm text-slate-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Transizioni libere
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Nessun blocco approvativo
                    </li>
                  </ul>
                </motion.div>

                {/* Team Space Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-2xl bg-blue-100 text-blue-600">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Organizzazione Team</h2>
                  </div>
                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Workflow strutturato per la qualità. Le transizioni seguono regole precise e alcuni passaggi richiedono ruoli specifici (es. Admin/Editor) o condizioni (es. Stima presente).
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Workflow Sequenziale</div>
                    <div className="flex items-center justify-between text-sm md:text-base font-medium text-slate-700">
                      <span>Created</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span>Proposed</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span>Selected</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span>Scheduled</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Transition Table */}
              <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 overflow-hidden shadow-lg">
                <div className="p-8 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900">Regole di Transizione (Team)</h3>
                  <p className="text-slate-500 mt-1">Dettaglio di chi può fare cosa e quando.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold">
                      <tr>
                        <th className="px-6 py-4">Da</th>
                        <th className="px-6 py-4">A</th>
                        <th className="px-6 py-4">Azione</th>
                        <th className="px-6 py-4">Chi?</th>
                        <th className="px-6 py-4">Vincoli (Guards)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><Badge variant="outline">CREATED</Badge></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">PROPOSED</Badge></td>
                        <td className="px-6 py-4 font-medium text-slate-900">Proponi</td>
                        <td className="px-6 py-4">Tutti</td>
                        <td className="px-6 py-4 text-slate-400">-</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">PROPOSED</Badge></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">SELECTED</Badge></td>
                        <td className="px-6 py-4 font-medium text-slate-900">Seleziona/Approva</td>
                        <td className="px-6 py-4"><span className="font-semibold text-indigo-600">Admin, Editor</span></td>
                        <td className="px-6 py-4">Richiede permessi</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">SELECTED</Badge></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">SCHEDULED</Badge></td>
                        <td className="px-6 py-4 font-medium text-slate-900">Pianifica</td>
                        <td className="px-6 py-4">Admin, Editor</td>
                        <td className="px-6 py-4 flex items-center gap-2 text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit text-xs font-semibold">
                          <Lock className="w-3 h-3" /> Stima Obbligatoria
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">SCHEDULED</Badge></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">IN_PROGRESS</Badge></td>
                        <td className="px-6 py-4 font-medium text-slate-900">Inizia Lavoro</td>
                        <td className="px-6 py-4">Tutti</td>
                        <td className="px-6 py-4 text-slate-400">-</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">IN_PROGRESS</Badge></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">DONE</Badge></td>
                        <td className="px-6 py-4 font-medium text-slate-900">Completa</td>
                        <td className="px-6 py-4">Tutti</td>
                        <td className="px-6 py-4 text-slate-400">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-6 justify-center text-sm text-slate-600 bg-white/40 p-4 rounded-full border border-white/50 w-fit mx-auto">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span>Transizione Libera</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span>Ruolo Richiesto</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span>Dato Mancante (es. Stima)</span>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* CTA Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-8 py-12 border-t border-slate-200/60 mt-24"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            {user ? "La tua prossima stima ti aspetta" : "Smetti di perdere margini sulle stime"}
          </h2>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            {user ? "Prova subito con un requisito reale." : "Inizia gratis. Nessuna carta richiesta. Prima stima in 3 minuti."}
          </p>
          <Link to={user ? "/dashboard" : "/register"}>
            <Button size="lg" className="rounded-full px-10 h-14 text-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              {user ? "Crea una Stima" : "Prova Gratis Ora"} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </main >
    </div >
  );
}
