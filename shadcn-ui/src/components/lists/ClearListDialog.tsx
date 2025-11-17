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

interface ClearListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listId: string;
    listName: string;
    requirementCount?: number;
    onSuccess: () => void;
}

export function ClearListDialog({
    open,
    onOpenChange,
    listId,
    listName,
    requirementCount = 0,
    onSuccess,
}: ClearListDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleClear = async () => {
        setLoading(true);
        try {
            // Delete all requirements in this list
            const { error } = await supabase.from('requirements').delete().eq('list_id', listId);

            if (error) throw error;

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error clearing list:', error);
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
                        Are you sure you want to clear all requirements from <span className="font-semibold">{listName}</span>?
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
