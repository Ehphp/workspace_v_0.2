import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/supabase';
import { QuickEstimate } from '@/components/estimation/QuickEstimate';
import { SynteroMark } from '@/components/layout/SynteroMark';

export default function Home() {
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  useEffect(() => {
    const state = location.state as { openQuick?: boolean } | null;
    if (!state) return;

    if (state.openQuick) {
      setShowQuickEstimate(true);
    }

    if (state.openQuick) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 overflow-hidden relative">
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
      <header className="relative border-b border-white/20 backdrop-blur-md bg-white/80 shadow-sm flex-shrink-0 z-10">
        <div className="container mx-auto px-6 h-16 flex justify-between items-center">
          <SynteroMark subtitle="AI estimation workspace" />
          <div className="flex gap-2 items-center">
            <Link to="/how-it-works">
              <Button variant="ghost" size="sm" className="hover:bg-white/50">
                Come funziona
              </Button>
            </Link>
            {loading ? (
              <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
            ) : user ? (
              <>
                <span className="text-sm text-slate-600 mr-2">
                  {user.email}
                </span>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="hover:bg-white/50">
                    My Lists
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hover:bg-white/50"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="hover:bg-white/50">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 relative z-10 overflow-hidden">
        <div className="container mx-auto px-6 py-4 min-h-full flex items-center">
          <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto items-center h-full">
            {/* Left: Hero */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-4 relative"
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-xs font-medium text-blue-900">B2B SaaS for Software Agencies</span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                  Syntero
                  <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                    Requirements Estimation & Governance
                  </span>
                </h2>

                <p className="text-sm lg:text-base text-slate-600 leading-relaxed max-w-lg">
                  Standardizza il tuo processo di vendita con stime basate su AI, preset aziendali e governance completa per proteggere i margini del team.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="default"
                  onClick={() => setShowQuickEstimate(true)}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Estimate
                </Button>
                <Link to="/how-it-works">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  >
                    Guarda come funziona
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  >
                    Create Account
                  </Button>
                </Link>
              </div>

              {/* Stats - Compatti */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-blue-300/50 transition-all duration-300">
                  <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    AI
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Normalization</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Smart analysis</p>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300">
                  <div className="text-2xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Lock
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Governance</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Protect margins</p>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300">
                  <div className="text-2xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Team
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Collaboration</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Roles & permissions</p>
                </div>
              </div>
            </motion.div>

            {/* Right: Process Steps - Compatto */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="space-y-4"
            >
              <Card className="border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Governance Workflow</h3>
                      <p className="text-[10px] text-slate-500">Standardization & control</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    Il workflow di governance completo per standardizzare le stime, proteggere i margini e collaborare in team.
                  </p>

                  <div className="space-y-2">
                    {[
                      {
                        num: '1',
                        title: 'Requirement Normalization',
                        desc: 'AI analyzes and standardizes requirements',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
                        color: 'from-blue-500 to-cyan-500'
                      },
                      {
                        num: '2',
                        title: 'Company Presets',
                        desc: 'Apply standardized tech & activities',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />,
                        color: 'from-indigo-500 to-purple-500'
                      },
                      {
                        num: '3',
                        title: 'Complexity Drivers',
                        desc: 'Technical analysis & multipliers',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
                        color: 'from-purple-500 to-pink-500'
                      },
                      {
                        num: '4',
                        title: 'Risk & Review',
                        desc: 'Management review & risk identification',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
                        color: 'from-pink-500 to-rose-500'
                      },
                      {
                        num: '5',
                        title: 'Lock & Export',
                        desc: 'Protect margins, export for client',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
                        color: 'from-rose-500 to-orange-500'
                      },
                    ].map((step) => (
                      <div
                        key={step.num}
                        className="group flex gap-3 items-start p-2 rounded-lg hover:bg-white/80 transition-all duration-300 cursor-default"
                      >
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${step.color} shadow flex items-center justify-center`}>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {step.icon}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 mb-0.5">{step.title}</p>
                          <p className="text-[10px] text-slate-600 leading-tight">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Trust indicators */}
              <div className="flex items-center justify-center gap-8 pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Governed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                  <span className="font-medium">Team</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Locked</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Quick Estimate Dialog */}
      <QuickEstimate open={showQuickEstimate} onOpenChange={setShowQuickEstimate} />
    </div>
  );
}
