import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep1Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function WizardStep1({ data, onUpdate, onNext }: WizardStep1Props) {
  const canProceed = data.reqId && data.title && data.description;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Requirement Information</h2>
            <p className="text-sm text-slate-600">
              Provide basic information about the requirement you want to estimate
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="reqId" className="text-sm font-semibold text-slate-900">Requirement ID</Label>
          <Input
            id="reqId"
            placeholder="e.g., HR-API-001"
            value={data.reqId}
            onChange={(e) => onUpdate({ reqId: e.target.value })}
            className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            A unique identifier for this requirement
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold text-slate-900">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Email notification for candidate acceptance"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold text-slate-900">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the functional and technical requirements..."
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={5}
            className="resize-none border-slate-300 focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500 flex items-start gap-1">
            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Provide context for AI to suggest relevant activities including what needs to be done, inputs/outputs, and technical constraints</span>
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Next: Select Technology</span>
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}