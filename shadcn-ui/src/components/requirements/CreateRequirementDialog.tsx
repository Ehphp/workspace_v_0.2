import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RequirementWizard } from './RequirementWizard';
import type { List } from '@/types/database';

interface CreateRequirementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listId: string;
    list?: List;
    onSuccess: () => void;
}

export function CreateRequirementDialog({
    open,
    onOpenChange,
    listId,
    list,
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
                        listId={listId}
                        projectContext={list ? {
                            name: list.name,
                            description: list.description,
                            owner: list.owner,
                            defaultTechPresetId: list.tech_preset_id || undefined,
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
