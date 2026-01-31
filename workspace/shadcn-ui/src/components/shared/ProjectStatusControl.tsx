import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { updateListStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock } from 'lucide-react';
import { List } from '@/types/database';

interface ProjectStatusControlProps {
    list: List;
    onStatusChange: () => void;
    canManage: boolean;
}

export function ProjectStatusControl({ list, onStatusChange, canManage }: ProjectStatusControlProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleStatusChange = async (newStatus: 'DRAFT' | 'REVIEW' | 'LOCKED') => {
        setIsLoading(true);
        try {
            await updateListStatus(list.id, newStatus);
            toast({
                title: 'Status updated',
                description: `Project status changed to ${newStatus}.`,
            });
            onStatusChange();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to update status.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!canManage) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {list.status === 'LOCKED' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                <span className="capitalize">{list.status.toLowerCase()}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={list.status}
                onValueChange={(val) => handleStatusChange(val as any)}
                disabled={isLoading}
            >
                <SelectTrigger className="w-[130px]">
                    <div className="flex items-center gap-2">
                        {list.status === 'LOCKED' ? (
                            <Lock className="h-4 w-4 text-orange-500" />
                        ) : (
                            <Unlock className="h-4 w-4 text-green-500" />
                        )}
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="REVIEW">Review</SelectItem>
                    <SelectItem value="LOCKED">Locked</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
