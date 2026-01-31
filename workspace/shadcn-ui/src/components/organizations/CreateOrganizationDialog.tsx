import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createTeamOrganization } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name must be less than 50 characters'),
});

interface CreateOrganizationDialogProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CreateOrganizationDialog({ trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: CreateOrganizationDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { fetchOrganizations, setCurrentOrganization } = useAuthStore();
    const { toast } = useToast();

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const newOrgId = await createTeamOrganization(values.name);
            await fetchOrganizations();
            setCurrentOrganization(newOrgId);
            toast({
                title: 'Organization created',
                description: `Team "${values.name}" has been created successfully.`,
            });
            if (setOpen) setOpen(false);
            form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to create organization. Please try again.',
                variant: 'destructive',
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Team Organization</DialogTitle>
                    <DialogDescription>
                        Create a new team to collaborate with others. You will be the admin.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Organization Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Acme Corp" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Creating...' : 'Create Team'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
