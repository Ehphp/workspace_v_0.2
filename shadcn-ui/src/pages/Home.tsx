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

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
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
      <div className="h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="border-b bg-white">
          <div className="container mx-auto px-6 h-14 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-slate-900">
              Requirements Estimation System
            </h1>
            <div className="flex gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content - No Scroll */}
        <div className="flex-1 overflow-hidden">
          <div className="container mx-auto px-6 h-full flex items-center">
            <div className="grid md:grid-cols-2 gap-8 w-full items-center">
              {/* Left: Hero */}
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-slate-900">
                  Professional Requirements Estimation
                </h2>
                <p className="text-base text-slate-600">
                  Structured, repeatable estimation for multi-tech projects with AI-assisted activity selection and deterministic calculation engine.
                </p>
                
                <div className="flex gap-3 pt-2">
                  <Button size="default" onClick={handleStartWizard}>
                    Start Estimation
                  </Button>
                  <Link to="/register">
                    <Button size="default" variant="outline">
                      Create Account
                    </Button>
                  </Link>
                </div>

                {/* Key Features - Compact */}
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="text-center">
                    <div className="text-2xl mb-1">📊</div>
                    <p className="text-xs font-medium text-slate-900">Transparent</p>
                    <p className="text-xs text-slate-500">Formula-based</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎯</div>
                    <p className="text-xs font-medium text-slate-900">AI-Assisted</p>
                    <p className="text-xs text-slate-500">Smart suggestions</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-1">⚙️</div>
                    <p className="text-xs font-medium text-slate-900">Multi-Tech</p>
                    <p className="text-xs text-slate-500">All stacks</p>
                  </div>
                </div>
              </div>

              {/* Right: Process Steps */}
              <Card className="border-slate-200">
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold mb-3 text-slate-900">5-Step Process</h3>
                  <div className="space-y-2.5">
                    {[
                      { num: '1', title: 'Describe Requirement', desc: 'ID, title, and description' },
                      { num: '2', title: 'Select Technology', desc: 'Choose tech stack preset' },
                      { num: '3', title: 'AI Suggestions', desc: 'Get activity recommendations' },
                      { num: '4', title: 'Configure Drivers', desc: 'Set complexity and risks' },
                      { num: '5', title: 'View Results', desc: 'Get effort estimation' },
                    ].map((step) => (
                      <div key={step.num} className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                          {step.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{step.title}</p>
                          <p className="text-xs text-slate-500">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
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
                    className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${
                      index <= currentStep
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 ${
                      index <= currentStep ? 'text-primary font-medium' : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      index < currentStep ? 'bg-primary' : 'bg-slate-200'
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