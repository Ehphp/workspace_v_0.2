import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/useAuthStore';
import { getOrganizationMembers, addMemberByEmail, removeMember, updateMemberRole } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash, UserPlus, Shield, User, Eye, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Member {
    user_id: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    joined_at: string;
}

const inviteSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['admin', 'editor', 'viewer']),
});

export function MembersList() {
    const { currentOrganization, userRole, user } = useAuthStore();
    const [members, setMembers] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof inviteSchema>>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            email: '',
            role: 'viewer',
        },
    });

    const fetchMembers = async () => {
        if (!currentOrganization) return;
        setIsLoading(true);
        try {
            const data = await getOrganizationMembers(currentOrganization.id);
            setMembers(data);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'Failed to load members.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [currentOrganization]);

    const onInvite = async (values: z.infer<typeof inviteSchema>) => {
        if (!currentOrganization) return;
        try {
            await addMemberByEmail(currentOrganization.id, values.email, values.role);
            toast({
                title: 'Member invited',
                description: `${values.email} has been added as ${values.role}.`,
            });
            setInviteOpen(false);
            form.reset();
            fetchMembers();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to invite member.',
                variant: 'destructive',
            });
        }
    };

    const onRemove = async (userId: string) => {
        if (!currentOrganization) return;
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await removeMember(currentOrganization.id, userId);
            toast({
                title: 'Member removed',
                description: 'The member has been removed from the organization.',
            });
            fetchMembers();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to remove member.',
                variant: 'destructive',
            });
        }
    };

    const onRoleChange = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
        if (!currentOrganization) return;
        try {
            await updateMemberRole(currentOrganization.id, userId, newRole);
            toast({
                title: 'Role updated',
                description: 'Member role has been updated.',
            });
            fetchMembers();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to update role.',
                variant: 'destructive',
            });
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">Admin</Badge>;
            case 'editor':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">Editor</Badge>;
            case 'viewer':
                return <Badge variant="outline" className="text-slate-600">Viewer</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    if (!currentOrganization || currentOrganization.type === 'personal') {
        return (
            <div className="text-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <User className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p>Members management is only available for Team Organizations.</p>
            </div>
        );
    }

    const canManage = userRole === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <h3 className="text-sm font-medium text-slate-500">
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                    </h3>
                </div>
                {canManage && (
                    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add Member
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Member</DialogTitle>
                                <DialogDescription>
                                    Invite a user by email to join this organization.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onInvite)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                        <Input placeholder="user@example.com" className="pl-9" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Role</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a role" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="admin">
                                                            <div className="flex items-center gap-2">
                                                                <Shield className="h-4 w-4 text-purple-500" />
                                                                <span>Admin</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="editor">
                                                            <div className="flex items-center gap-2">
                                                                <User className="h-4 w-4 text-blue-500" />
                                                                <span>Editor</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="viewer">
                                                            <div className="flex items-center gap-2">
                                                                <Eye className="h-4 w-4 text-slate-500" />
                                                                <span>Viewer</span>
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? 'Adding...' : 'Add Member'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[300px]">User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow key={member.user_id} className="hover:bg-slate-50/50">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                                                {member.email.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-slate-900">{member.email}</span>
                                            {member.user_id === user?.id && (
                                                <span className="text-[10px] text-slate-500">(You)</span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {getRoleBadge(member.role)}
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">
                                    {new Date(member.joined_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    {canManage && member.user_id !== user?.id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onRoleChange(member.user_id, 'admin')}>
                                                    <Shield className="mr-2 h-4 w-4 text-purple-500" />
                                                    Make Admin
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onRoleChange(member.user_id, 'editor')}>
                                                    <User className="mr-2 h-4 w-4 text-blue-500" />
                                                    Make Editor
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onRoleChange(member.user_id, 'viewer')}>
                                                    <Eye className="mr-2 h-4 w-4 text-slate-500" />
                                                    Make Viewer
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => onRemove(member.user_id)}
                                                >
                                                    <Trash className="mr-2 h-4 w-4" />
                                                    Remove
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {members.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <UserPlus className="h-8 w-8 mb-2 text-slate-300" />
                                        <p>No members found.</p>
                                        {canManage && <p className="text-xs mt-1">Invite someone to get started.</p>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}