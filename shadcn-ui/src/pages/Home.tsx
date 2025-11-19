import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useWizardState } from '@/hooks/useWizardState';
import { WizardStep1 } from '@/components/wizard/WizardStep1';
import { WizardStep2 } from '@/components/wizard/WizardStep2';
import { WizardStep3 } from '@/components/wizard/WizardStep3';
import { WizardStep4 } from '@/components/wizard/WizardStep4';
import { WizardStep5 } from '@/components/wizard/WizardStep5';
import { QuickEstimate } from '@/components/estimation/QuickEstimate';

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const { data, updateData, resetData } = useWizardState();

  const steps = [
    { title: 'Requirement', component: WizardStep1 },
    { title: 'Technology', component: WizardStep2 },
    { title: 'Activities', component: WizardStep3 },
    { title: 'Drivers & Risks', component: WizardStep4 },
    { title: 'Results', component: WizardStep5 },
  ];

  const handleStartWizard = () => {
    resetData();
    setCurrentStep(0);
    setShowWizard(true);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    resetData();
    setCurrentStep(0);
    setShowWizard(false);
  };

  const CurrentStepComponent = steps[currentStep].component;

  if (!showWizard) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>

        {/* Header with glassmorphism */}
        <header className="relative border-b border-white/20 backdrop-blur-md bg-white/80 shadow-sm">
          <div className="container mx-auto px-6 h-16 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Requirements Estimator
              </h1>
            </div>
            <div className="flex gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="hover:bg-white/50">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-6 py-16">
            <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto items-center">
              {/* Left: Hero */}
              <div className="space-y-8 relative">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-xs font-medium text-blue-900">AI-Powered Estimation</span>
                  </div>

                  <h2 className="text-5xl font-bold text-slate-900 leading-tight">
                    Professional
                    <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Requirements Estimation
                    </span>
                  </h2>

                  <p className="text-lg text-slate-600 leading-relaxed">
                    Ottieni una stima veloce con pochi dati e passa al wizard avanzato quando ti serve il massimo controllo su attività, driver e rischi.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => setShowQuickEstimate(true)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Estimate
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleStartWizard}
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Advanced Wizard
                  </Button>
                  <Link to="/register">
                    <Button
                      size="lg"
                      variant="ghost"
                      className="text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    >
                      Create Account
                    </Button>
                  </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-blue-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                      98%
                    </div>
                    <p className="text-xs font-semibold text-slate-900">Accuracy</p>
                    <p className="text-xs text-slate-500 mt-1">Formula-based calculations</p>
                  </div>
                  <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-3xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                      5min
                    </div>
                    <p className="text-xs font-semibold text-slate-900">Fast Setup</p>
                    <p className="text-xs text-slate-500 mt-1">Quick estimation process</p>
                  </div>
                  <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-3xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                      20+
                    </div>
                    <p className="text-xs font-semibold text-slate-900">Tech Stacks</p>
                    <p className="text-xs text-slate-500 mt-1">All major technologies</p>
                  </div>
                </div>
              </div>

              {/* Right: Process Steps */}
              <div className="space-y-6">
                <Card className="border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Advanced 5-Step Wizard</h3>
                        <p className="text-xs text-slate-500 mt-0.5">For detailed control</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                      Usa il processo completo in 5 step quando hai bisogno di configurare attività, driver e rischi nel dettaglio.
                    </p>

                    <div className="space-y-3">
                      {[
                        {
                          num: '1',
                          title: 'Describe Requirement',
                          desc: 'Define your project with ID, title, and detailed description',
                          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
                          color: 'from-blue-500 to-cyan-500'
                        },
                        {
                          num: '2',
                          title: 'Select Technology',
                          desc: 'Choose from 20+ tech stack presets or customize your own',
                          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
                          color: 'from-indigo-500 to-purple-500'
                        },
                        {
                          num: '3',
                          title: 'AI Suggestions',
                          desc: 'Get intelligent activity recommendations powered by AI',
                          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
                          color: 'from-purple-500 to-pink-500'
                        },
                        {
                          num: '4',
                          title: 'Configure Drivers',
                          desc: 'Fine-tune complexity multipliers and risk factors',
                          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
                          color: 'from-pink-500 to-rose-500'
                        },
                        {
                          num: '5',
                          title: 'View Results',
                          desc: 'Get detailed effort estimation with transparent calculations',
                          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
                          color: 'from-rose-500 to-orange-500'
                        },
                      ].map((step) => (
                        <div
                          key={step.num}
                          className="group flex gap-4 items-start p-4 rounded-xl hover:bg-white/80 transition-all duration-300 hover:shadow-md cursor-default"
                        >
                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {step.icon}
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <p className="text-sm font-bold text-slate-900 mb-1">{step.title}</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
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
        </div>

        {/* Quick Estimate Dialog */}
        <QuickEstimate open={showQuickEstimate} onOpenChange={setShowQuickEstimate} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 h-14 flex justify-between items-center">
          <h1 className="text-base font-semibold text-slate-900">Requirements Estimation</h1>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            ← Back to Home
          </Button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${index <= currentStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-slate-200 text-slate-500'
                      }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 ${index <= currentStep ? 'text-primary font-medium' : 'text-slate-500'
                      }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-slate-200'
                      }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wizard Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-4">
          <Card className="max-w-4xl mx-auto border-slate-200">
            <CardContent className="p-5">
              <CurrentStepComponent
                data={data}
                onUpdate={updateData}
                onNext={handleNext}
                onBack={handleBack}
                onReset={handleReset}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}