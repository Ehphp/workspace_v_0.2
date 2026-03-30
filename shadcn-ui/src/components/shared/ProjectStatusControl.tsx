import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { patchProject } from '@/lib/projects';
import { useToast } from '@/hooks/use-toast';
import { Lock, Unlock } from 'lucide-react';
import { Project } from '@/types/database';

interface ProjectStatusControlProps {
    project: Project;
    onStatusChange: () => void;
    canManage: boolean;
}

export function ProjectStatusControl({ project, onStatusChange, canManage }: ProjectStatusControlProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleStatusChange = async (newStatus: 'DRAFT' | 'REVIEW' | 'LOCKED') => {
        setIsLoading(true);
        try {
            await patchProject(project.id, { status: newStatus });
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
                {project.status === 'LOCKED' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                <span className="capitalize">{project.status.toLowerCase()}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={project.status}
                onValueChange={(val) => handleStatusChange(val as any)}
                disabled={isLoading}
            >
                <SelectTrigger className="w-[130px]">
                    <div className="flex items-center gap-2">
                        {project.status === 'LOCKED' ? (
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
