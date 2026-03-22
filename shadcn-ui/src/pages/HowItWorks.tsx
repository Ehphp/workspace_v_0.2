import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import {
  Wand2,
  Database,
  GitBranch,
  Shield,
  Lock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Brain,
  Layers,
  FileSearch,
  SlidersHorizontal
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { RingParticlesBackground } from '@/components/RingParticlesBackground';

const steps = [
  {
    icon: Wand2,
    title: 'Descrivi il Requisito',
    description: 'Scrivi come parli. L\'AI capisce il contesto e, se vuoi, normalizza automaticamente il testo.',
    example: '"Integrazione CRM con notifiche push"',
    time: '10 sec',
    gradient: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  {
    icon: Database,
    title: 'Scegli la Tecnologia',
    description: 'Un click. L\'AI carica il tuo catalogo attività personalizzato.',
    example: 'Power Platform • .NET • React • Multi-stack',
    time: '5 sec',
    gradient: 'from-indigo-500 to-purple-500',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-purple-500',
  },
  {
    icon: Brain,
    title: 'Understanding AI',
    description: 'L\'AI analizza obiettivo, perimetro, attori e complessità. Revisioni e confermi.',
    example: 'Obiettivo • Perimetro • Attori • Complessità',
    time: '~15 sec',
    gradient: 'from-cyan-500 to-blue-500',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-500',
  },
  {
    icon: Layers,
    title: 'Impact Map',
    description: 'L\'AI mappa i layer architetturali impattati: frontend, logica, dati, integrazioni.',
    example: 'Frontend • Logic • Data • Integration',
    time: '~15 sec',
    gradient: 'from-violet-500 to-indigo-500',
    iconBg: 'bg-gradient-to-br from-violet-500 to-indigo-500',
  },
  {
    icon: FileSearch,
    title: 'Blueprint Tecnico',
    description: 'L\'AI decompone componenti, integrazioni, entità dati e scope di testing.',
    example: 'Componenti • API • Entità • Test',
    time: '~15 sec',
    gradient: 'from-purple-500 to-pink-500',
    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    icon: GitBranch,
    title: 'Interview Tecnica',
    description: 'Se l\'AI ha dubbi, ti fa 1-3 domande mirate. Se è già sicura, salta direttamente alla stima.',
    example: 'Planner AI: SKIP o ASK?',
    time: '0-30 sec',
    gradient: 'from-pink-500 to-rose-500',
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
  },
  {
    icon: SlidersHorizontal,
    title: 'Driver e Rischi',
    description: 'Seleziona attività, driver di complessità e rischi dal tuo catalogo.',
    example: 'Attività • Moltiplicatori • Buffer rischio',
    time: '~30 sec',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
  },
  {
    icon: Shield,
    title: 'Risultati e Salvataggio',
    description: 'Review finale della stima con breakdown per attività. Salva e presenta al cliente.',
    example: 'Ore totali • Breakdown • Salvataggio',
    time: '~30 sec',
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
  },
];

export default function HowItWorks() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 relative overflow-hidden">
      {/* Ring Particles Animated Background */}
      <RingParticlesBackground
        usePaintWorklet={false}
        enableMouseInteraction={true}
        config={{
          shape: 'disk',
          particleCount: 800,
          radius: 38,
          thickness: 18,
          particleSize: [1, 5],
          alphaRange: [0.5, 1.0],
          color: { h: 120, s: 80 },
          drift: 0.1,
          angularSpeed: 0.13,
          noiseFrequency: 1.9,
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

      <main className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative z-10">
        <Tabs defaultValue="overview" className="space-y-12">
          <div className="text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-xs font-medium text-blue-900">AI Estimation Pipeline</span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
                Come funziona Syntero
                <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                  Dal requisito alla stima verificabile
                </span>
              </h1>
              <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-6">
                Una pipeline AI strutturata produce artefatti intermedi — understanding, impact map, blueprint — che guidano un motore deterministico fino alla stima finale rivedibile.
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10">
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-blue-300/50 transition-all duration-300 text-center">
                  <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">AI</div>
                  <div className="text-xs font-semibold text-slate-900">Artifacts</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Understanding, impact map, blueprint</div>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300 text-center">
                  <div className="text-2xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">Σ</div>
                  <div className="text-xs font-semibold text-slate-900">Deterministic</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Calcolo replicabile e verificabile</div>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300 text-center">
                  <div className="text-2xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent">✓</div>
                  <div className="text-xs font-semibold text-slate-900">Reviewable</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Storico, confronto e consuntivo</div>
                </div>
              </div>

              {user && (
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/50 backdrop-blur-sm border border-slate-200/60 p-1 rounded-full">
                  <TabsTrigger value="overview" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                    Panoramica
                  </TabsTrigger>
                  <TabsTrigger value="workflow" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm">
                    Workflow Stati
                  </TabsTrigger>
                </TabsList>
              )}
            </motion.div>
          </div>

          <TabsContent value="overview" className="mt-0">
            {/* Modern Horizontal Flow */}
            <div className="relative mb-16 pt-8">
              {/* Desktop: Horizontal cards */}
              <div className="hidden lg:block">
                {/* Connection Line */}
                <div className="absolute top-[4.5rem] left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full opacity-20" />

                <div className="grid grid-cols-4 gap-3">
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
                      <div className="flex justify-center mb-3">
                        <div className={`w-12 h-12 rounded-xl ${step.iconBg} flex items-center justify-center shadow-lg shadow-slate-900/10 relative z-10`}>
                          <step.icon className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {/* Card */}
                      <div className="p-3 rounded-xl bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-300 group h-full">
                        {/* Time Badge */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-slate-400">STEP {index + 1}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${step.gradient} text-white`}>
                            {step.time}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 mb-1 leading-tight">{step.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{step.description}</p>

                        {/* Example */}
                        <div className="pt-2 border-t border-slate-200/50">
                          <p className="text-[10px] text-slate-500 italic">{step.example}</p>
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
                    <span className="font-semibold">~3 minuti per un requisito tipico</span>
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
                    className="p-5 rounded-xl bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-sm"
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
                    <span className="font-semibold">~3 min per requisito tipico</span>
                  </div>
                </div>
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
                  className="p-8 rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-lg"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-green-100 text-green-600">
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
                  className="p-8 rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-lg"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
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
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 overflow-hidden shadow-lg">
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
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
            {user ? "La tua prossima stima ti aspetta" : "Prova Syntero con un requisito reale"}
          </h2>
          <p className="text-base text-slate-600 max-w-xl mx-auto">
            {user ? "Crea una stima dalla dashboard." : "Crea un account e lancia la tua prima stima."}
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
