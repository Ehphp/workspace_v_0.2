import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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

interface DeleteRequirementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    requirementId: string;
    requirementTitle: string;
    onSuccess: () => void;
}

export function DeleteRequirementDialog({
    open,
    onOpenChange,
    requirementId,
    requirementTitle,
    onSuccess,
}: DeleteRequirementDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('requirements')
                .delete()
                .eq('id', requirementId);

            if (error) throw error;

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error deleting requirement:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Requirement?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{requirementTitle}</span>?
                        <br />
                        <br />
                        This will permanently delete the requirement and all its estimations. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete Requirement
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
