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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Requirements Estimation System
            </h1>
            <div className="flex gap-2">
              <Link to="/login">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold tracking-tight">
                Estimate Requirements with
                <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  AI-Assisted Precision
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Structured, repeatable estimation for multi-tech projects. AI suggests activities,
                deterministic engine calculates effort.
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Button size="lg" onClick={handleStartWizard} className="text-lg px-8">
                Start Free Estimation
              </Button>
              <Link to="/register">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Create Account
                </Button>
              </Link>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 mt-16">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">🧮</div>
                  <h3 className="font-semibold text-lg mb-2">Deterministic Calculation</h3>
                  <p className="text-sm text-muted-foreground">
                    Transparent formula: Base Days × Drivers × (1 + Contingency). No black box.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">🤖</div>
                  <h3 className="font-semibold text-lg mb-2">AI-Assisted Selection</h3>
                  <p className="text-sm text-muted-foreground">
                    AI suggests relevant activities based on your description. You stay in control.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">🧩</div>
                  <h3 className="font-semibold text-lg mb-2">Multi-Technology</h3>
                  <p className="text-sm text-muted-foreground">
                    Power Platform, Java, React, .NET, and more. One tool for all your stacks.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* How It Works */}
            <div className="mt-16 text-left max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold mb-6 text-center">How It Works</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold">Describe Your Requirement</h4>
                    <p className="text-sm text-muted-foreground">
                      Provide ID, title, and functional/technical description
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold">Select Technology</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose from Power Platform, Backend API, React, or other presets
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold">Get AI Suggestions</h4>
                    <p className="text-sm text-muted-foreground">
                      AI analyzes and suggests relevant activities. Refine manually if needed.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold">Configure Drivers & Risks</h4>
                    <p className="text-sm text-muted-foreground">
                      Set complexity, environments, reuse level, and identify risks
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    5
                  </div>
                  <div>
                    <h4 className="font-semibold">Get Your Estimation</h4>
                    <p className="text-sm text-muted-foreground">
                      View total days, breakdown, and export to PDF/CSV
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Requirements Estimation</h1>
          <Button variant="ghost" onClick={handleReset}>
            ← Back to Home
          </Button>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      index <= currentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 ${
                      index <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wizard Content */}
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8">
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
  );
}