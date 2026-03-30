import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RequirementWizard } from './RequirementWizard';
import type { Project } from '@/types/database';

interface CreateRequirementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    project?: Project;
    onSuccess: () => void;
}

export function CreateRequirementDialog({
    open,
    onOpenChange,
    projectId,
    project,
    onSuccess,
}: CreateRequirementDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
                    <DialogTitle>New Requirement Wizard</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 bg-slate-50/30">
                    <RequirementWizard
                        isOpen={open}
                        projectId={projectId}
                        projectContext={project ? {
                            name: project.name,
                            description: project.description,
                            owner: project.owner,
                            defaultTechPresetId: project.technology_id || undefined,
                            projectType: project.project_type || undefined,
                            domain: project.domain || undefined,
                            scope: project.scope || undefined,
                            teamSize: project.team_size || undefined,
                            deadlinePressure: project.deadline_pressure || undefined,
                            methodology: project.methodology || undefined,
                        } : undefined}
                        onSuccess={() => {
                            onSuccess();
                            onOpenChange(false);
                        }}
                        onCancel={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
