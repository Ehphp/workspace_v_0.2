import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Zap, AlertTriangle, Sparkles } from 'lucide-react';

interface Requirement {
    id: string;
    req_id: string;
    title: string;
    description: string;
    technology_id: string | null;
    /** @deprecated Use technology_id */
    tech_preset_id?: string | null;
}

interface BulkEstimateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requirements: Requirement[];
    projectTechnologyId: string | null;
    onConfirm: () => void;
}

export function BulkEstimateDialog({
    open,
    onOpenChange,
    requirements,
    projectTechnologyId: projectTechPresetId,
    onConfirm,
}: BulkEstimateDialogProps) {
    const estimableRequirements = requirements.filter((req) => {
        const techId = req.technology_id || req.tech_preset_id || projectTechPresetId;
        return techId && req.description?.trim();
    });
    const skippedCount = requirements.length - estimableRequirements.length;

    const handleConfirm = () => {
        onOpenChange(false);
        onConfirm();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        Stima AI
                    </DialogTitle>
                    <DialogDescription>
                        L'AI analizzerà ogni requisito e genererà una stima dettagliata
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                        <span className="text-sm font-medium text-indigo-900">Requisiti da stimare</span>
                        <span className="text-lg font-bold text-indigo-600">{estimableRequirements.length}</span>
                    </div>

                    {skippedCount > 0 && (
                        <Alert variant="default" className="border-amber-200 bg-amber-50/50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                {skippedCount} requisit{skippedCount === 1 ? 'o verrà escluso' : 'i verranno esclusi'} (manca tecnologia o descrizione)
                            </AlertDescription>
                        </Alert>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                        Il progresso sarà visibile direttamente sui requisiti
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500">
                        Annulla
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={estimableRequirements.length === 0}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20"
                    >
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        Avvia Stima
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
