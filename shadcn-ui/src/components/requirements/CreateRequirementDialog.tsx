import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RequirementWizard } from './RequirementWizard';

interface CreateRequirementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listId: string;
    onSuccess: () => void;
}

export function CreateRequirementDialog({
    open,
    onOpenChange,
    listId,
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
