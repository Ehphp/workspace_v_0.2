/**
 * AI Wizard Test Page
 * 
 * Temporary page for testing AI wizard components during development.
 * This page can be accessed via /test/ai-wizard route.
 */

import { Header } from '@/components/layout/Header';
import { QuestionGenerationTest } from '@/components/configuration/presets/ai-wizard/QuestionGenerationTest';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function AiWizardTestPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />

            <main className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/configuration/presets')}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Torna ai Preset
                    </Button>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-amber-800">
                            <strong>⚠️ Pagina di Test:</strong> Questa pagina è per testare il sistema AI Wizard durante lo sviluppo.
                            Verrà rimossa nella versione finale.
                        </p>
                    </div>
                </div>

                <QuestionGenerationTest />
            </main>
        </div>
    );
}
