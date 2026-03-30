import { useState } from 'react';
import { clearProjectRequirements } from '@/lib/projects';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface ClearProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    projectName: string;
    requirementCount?: number;
    onSuccess: () => void;
}

export function ClearProjectDialog({
    open,
    onOpenChange,
    projectId,
    projectName,
    requirementCount = 0,
    onSuccess,
}: ClearProjectDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleClear = async () => {
        setLoading(true);
        try {
            // Delete all requirements in this project
            await clearProjectRequirements(projectId);

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error clearing project:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Requirements?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to clear all requirements from <span className="font-semibold">{projectName}</span>?
                        <br />
                        <br />
                        This will delete {requirementCount} requirement(s). The project itself will remain but will be empty. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleClear}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Clear All
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
