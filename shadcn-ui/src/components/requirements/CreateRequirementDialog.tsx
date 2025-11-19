import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        state: 'PROPOSED',
        business_owner: '',
    });

    const generateNextReqId = async (): Promise<string> => {
        // Get all existing requirements for this list to find the next number
        const { data: existingReqs } = await supabase
            .from('requirements')
            .select('req_id')
            .eq('list_id', listId)
            .order('created_at', { ascending: false });

        if (!existingReqs || existingReqs.length === 0) {
            return 'REQ-001';
        }

        // Extract numbers from existing IDs (e.g., "REQ-001" -> 1)
        const numbers = existingReqs
            .map(req => {
                const match = req.req_id.match(/REQ-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => num > 0);

        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        const nextNumber = maxNumber + 1;

        // Format as REQ-XXX with leading zeros
        return `REQ-${nextNumber.toString().padStart(3, '0')}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // Generate next requirement ID
            const generatedReqId = await generateNextReqId();

            const { error } = await supabase.from('requirements').insert({
                list_id: listId,
                req_id: generatedReqId,
                title: formData.title,
                description: formData.description,
                priority: formData.priority,
                state: formData.state,
                business_owner: formData.business_owner,
                tech_preset_id: null,
                labels: [],
            });

            if (error) {
                console.error('Error creating requirement:', error);
                toast({
                    title: 'Error',
                    description: error.message || 'Failed to create requirement',
                    variant: 'destructive',
                });
                return;
            }

            toast({
                title: 'Success',
                description: `Requirement ${generatedReqId} created successfully`,
            });

            setFormData({
                title: '',
                description: '',
                priority: 'MEDIUM',
                state: 'PROPOSED',
                business_owner: '',
            });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating requirement:', error);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Requirement</DialogTitle>
                    <DialogDescription>
                        Add a new requirement to start the estimation process
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="Brief requirement title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Detailed requirement description..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="business_owner">Business Owner</Label>
                            <Input
                                id="business_owner"
                                placeholder="John Doe"
                                value={formData.business_owner}
                                onChange={(e) => setFormData({ ...formData, business_owner: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(value) => setFormData({ ...formData, priority: value })}
                            >
                                <SelectTrigger id="priority">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Select
                            value={formData.state}
                            onValueChange={(value) => setFormData({ ...formData, state: value })}
                        >
                            <SelectTrigger id="state">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PROPOSED">Proposed</SelectItem>
                                <SelectItem value="SELECTED">Selected</SelectItem>
                                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                <SelectItem value="DONE">Done</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Requirement
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
