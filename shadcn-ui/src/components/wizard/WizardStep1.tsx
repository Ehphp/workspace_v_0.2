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
      <div>
        <h2 className="text-2xl font-bold mb-2">Requirement Information</h2>
        <p className="text-muted-foreground">
          Start by providing basic information about the requirement you want to estimate.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reqId">Requirement ID</Label>
          <Input
            id="reqId"
            placeholder="e.g., HR-API-001"
            value={data.reqId}
            onChange={(e) => onUpdate({ reqId: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            A unique identifier for this requirement
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g., Email notification for candidate acceptance"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the functional and technical requirements..."
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={6}
          />
          <p className="text-sm text-muted-foreground">
            Provide enough context for AI to suggest relevant activities. Include what needs to be
            done, inputs/outputs, and any technical constraints.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Select Technology
        </Button>
      </div>
    </div>
  );
}