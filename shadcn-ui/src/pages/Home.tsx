import { useEffect, useState } from 'react';
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
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none"></div>

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
                <Link to="/lists">
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
      <main className="flex-1 min-h-0 relative z-10 overflow-y-auto">
        <div className="container mx-auto px-6 py-6 min-h-full flex items-center">
          <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto items-center h-full">
            {/* Left: Hero */}
            <div className="space-y-4 relative">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-xs font-medium text-blue-900">AI-Powered Estimation</span>
                </div>

                <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                  Syntero
                  <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                    AI-crafted requirements estimation
                  </span>
                </h2>

                <p className="text-base lg:text-lg text-slate-600 leading-relaxed">
                  Il nuovo spazio di lavoro per raccogliere requisiti, stimare e condividere risultati in pochi minuti, con automazioni AI e trasparenza delle formule.
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
                    98%
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Accuracy</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Formula-based</p>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300">
                  <div className="text-2xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    5min
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Fast Setup</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Quick process</p>
                </div>
                <div className="group bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300">
                  <div className="text-2xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    20+
                  </div>
                  <p className="text-xs font-semibold text-slate-900">Tech Stacks</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">All major tech</p>
                </div>
              </div>
            </div>

            {/* Right: Process Steps - Compatto */}
            <div className="space-y-4">
              <Card className="border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Advanced 5-Step Wizard</h3>
                      <p className="text-[10px] text-slate-500">For detailed control</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    Usa il processo completo in 5 step quando hai bisogno di configurare attività, driver e rischi nel dettaglio.
                  </p>

                  <div className="space-y-2">
                    {[
                      {
                        num: '1',
                        title: 'Describe Requirement',
                        desc: 'Define project with ID, title, description',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
                        color: 'from-blue-500 to-cyan-500'
                      },
                      {
                        num: '2',
                        title: 'Select Technology',
                        desc: 'Choose from 20+ tech presets',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
                        color: 'from-indigo-500 to-purple-500'
                      },
                      {
                        num: '3',
                        title: 'AI Suggestions',
                        desc: 'Get intelligent recommendations',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
                        color: 'from-purple-500 to-pink-500'
                      },
                      {
                        num: '4',
                        title: 'Configure Drivers',
                        desc: 'Fine-tune complexity multipliers',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
                        color: 'from-pink-500 to-rose-500'
                      },
                      {
                        num: '5',
                        title: 'View Results',
                        desc: 'Get detailed effort estimation',
                        icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2z" />,
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Secure</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Fast</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span className="font-medium">Accurate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quick Estimate Dialog */}
      <QuickEstimate open={showQuickEstimate} onOpenChange={setShowQuickEstimate} />
    </div>
  );
}
