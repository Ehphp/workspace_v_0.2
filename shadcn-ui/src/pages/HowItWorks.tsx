import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const steps = [
  {
    icon: Wand2,
    title: 'Requirement Normalization',
    description: 'L\'AI analizza e normalizza i requisiti grezzi, estraendo le informazioni chiave e standardizzando il linguaggio.',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    border: 'border-blue-200',
  },
  {
    icon: Database,
    title: 'Company Presets',
    description: 'Applica i preset aziendali personalizzati: tecnologie standard, attività ricorrenti e metriche di produttività.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    border: 'border-indigo-200',
  },
  {
    icon: GitBranch,
    title: 'Complexity Drivers',
    description: 'Analisi tecnica approfondita dei driver di complessità basata su tecnologie, integrazioni e architettura.',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    border: 'border-purple-200',
  },
  {
    icon: Shield,
    title: 'Risk & Review',
    description: 'Identificazione dei rischi di progetto e processo di revisione manageriale prima della finalizzazione.',
    color: 'text-pink-600',
    bg: 'bg-pink-100',
    border: 'border-pink-200',
  },
  {
    icon: Lock,
    title: 'Lock & Export',
    description: 'Blocco della stima per proteggere i margini e export professionale per la presentazione al cliente.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
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

      <main className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative z-10">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm font-medium bg-white/80 backdrop-blur-sm border-slate-200 text-slate-700 shadow-sm">
              <Sparkles className="w-3 h-3 mr-2 text-blue-500 inline" />
              Come funziona
            </Badge>
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 drop-shadow-sm">
              Standardizzazione & <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x">
                Protezione dei Margini
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
              Un workflow di governance progettato per software agency che vogliono vendere meglio e consegnare con profitto.
            </p>
          </motion.div>
        </div>

        {/* Timeline Section */}
        <div ref={containerRef} className="relative mb-32">
          <div className="space-y-0">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="grid md:grid-cols-[1fr_auto_1fr] grid-cols-[auto_1fr] gap-x-4 md:gap-x-0"
              >
                {/* Left Side (Desktop) */}
                <div className={`hidden md:flex flex-col justify-center ${index % 2 !== 0 ? 'items-end pr-16' : ''}`}>
                  {index % 2 !== 0 && (
                    <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 group w-full max-w-md">
                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{step.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{step.description}</p>
                    </div>
                  )}
                </div>

                {/* Center Column (Line + Icon) */}
                <div className="flex flex-col items-center relative">
                  {/* Top Line Segment */}
                  <div className={`w-[2px] flex-1 ${index === 0 ? 'opacity-0' : ''} mb-3 rounded-full bg-gradient-to-b from-slate-200 to-slate-300`} />

                  {/* Icon */}
                  <div className="relative z-10">
                    <div className={`w-14 h-14 rounded-full bg-white border-2 ${step.border} shadow-lg flex items-center justify-center relative overflow-hidden group`}>
                      <div className={`absolute inset-0 ${step.bg} opacity-20 group-hover:opacity-40 transition-opacity`} />
                      <step.icon className={`w-6 h-6 ${step.color} relative z-10 transform group-hover:scale-110 transition-transform`} />
                    </div>
                  </div>

                  {/* Bottom Line Segment */}
                  <div className={`w-[2px] flex-1 ${index === steps.length - 1 ? 'opacity-0' : ''} mt-3 rounded-full bg-gradient-to-b from-slate-300 to-slate-200`} />
                </div>

                {/* Right Side (Desktop & Mobile Content) */}
                <div className={`flex flex-col justify-center pb-12 md:pb-24 ${index % 2 === 0 ? 'md:pl-16' : ''}`}>
                  {/* Desktop Content (Even) */}
                  <div className={`hidden md:block ${index % 2 === 0 ? '' : 'invisible'}`}>
                    <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 group w-full max-w-md">
                      <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">{step.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{step.description}</p>
                    </div>
                  </div>

                  {/* Mobile Content (Always visible on mobile) */}
                  <div className="md:hidden pt-2">
                    <div className="p-5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-md">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Designed for your Team Section */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Progettato per il tuo Team</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">Due ruoli chiave, un unico obiettivo: stimare con precisione e proteggere i margini.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group relative p-8 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                <Code2 className="w-32 h-32 text-blue-600" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100/80 flex items-center justify-center shadow-inner">
                  <Code2 className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Per il Tech Lead</h3>
                <p className="text-slate-600 font-medium">
                  Strumenti per garantire accuratezza tecnica, granularità nelle stime e supporto AI per l'analisi dei requisiti.
                </p>
                <ul className="space-y-3 pt-4">
                  <li className="flex items-center text-sm text-slate-700 font-medium">
                    <div className="p-1 rounded-full bg-blue-100 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    </div>
                    AI per normalizzazione requisiti
                  </li>
                  <li className="flex items-center text-sm text-slate-700 font-medium">
                    <div className="p-1 rounded-full bg-blue-100 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    </div>
                    Breakdown granulare per attività
                  </li>
                  <li className="flex items-center text-sm text-slate-700 font-medium">
                    <div className="p-1 rounded-full bg-blue-100 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    </div>
                    Driver di complessità tecnica
                  </li>
                </ul>
                <div className="pt-6">
                  <Link to={user ? "/dashboard" : "/register"}>
                    <Button variant="outline" className="w-full h-11 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300 transition-all">
                      {user ? "Vai alla Dashboard" : "Inizia ora"}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="group relative p-8 rounded-3xl bg-slate-900 text-white shadow-2xl shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-slate-900" />
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                <Building2 className="w-32 h-32 text-indigo-400" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <Building2 className="w-7 h-7 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold">Per l'Agency Owner</h3>
                <p className="text-indigo-100/90 font-medium">
                  Governance completa con sistema di locking, gestione ruoli team e protezione dei margini aziendali.
                </p>
                <ul className="space-y-3 pt-4">
                  <li className="flex items-center text-sm text-indigo-100">
                    <div className="p-1 rounded-full bg-indigo-500/30 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-indigo-300" />
                    </div>
                    Sistema di locking stime
                  </li>
                  <li className="flex items-center text-sm text-indigo-100">
                    <div className="p-1 rounded-full bg-indigo-500/30 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-indigo-300" />
                    </div>
                    Ruoli e permessi team
                  </li>
                  <li className="flex items-center text-sm text-indigo-100">
                    <div className="p-1 rounded-full bg-indigo-500/30 mr-3">
                      <CheckCircle2 className="w-3 h-3 text-indigo-300" />
                    </div>
                    Protezione margini aziendali
                  </li>
                </ul>
                <div className="pt-6">
                  <Link to={user ? "/dashboard" : "/register"}>
                    <Button className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-lg shadow-indigo-900/50 transition-all">
                      {user ? "Vai alla Dashboard" : "Inizia ora"}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CTA Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-8 py-12 border-t border-slate-200/60"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            {user ? "Inizia a standardizzare" : "Standardizza il tuo processo di vendita oggi"}
          </h2>
          <Link to={user ? "/dashboard" : "/register"}>
            <Button size="lg" className="rounded-full px-10 h-14 text-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              {user ? "Vai alla Dashboard" : "Inizia ora"} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
