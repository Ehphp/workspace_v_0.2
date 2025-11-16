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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1 text-slate-900">Requirement Information</h2>
        <p className="text-sm text-slate-600">
          Provide basic information about the requirement you want to estimate.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reqId" className="text-sm font-medium">Requirement ID</Label>
          <Input
            id="reqId"
            placeholder="e.g., HR-API-001"
            value={data.reqId}
            onChange={(e) => onUpdate({ reqId: e.target.value })}
            className="h-9"
          />
          <p className="text-xs text-slate-500">
            A unique identifier for this requirement
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm font-medium">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Email notification for candidate acceptance"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the functional and technical requirements..."
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-slate-500">
            Provide context for AI to suggest relevant activities including what needs to be done, inputs/outputs, and technical constraints.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!canProceed} size="sm">
          Next: Select Technology
        </Button>
      </div>
    </div>
  );
}