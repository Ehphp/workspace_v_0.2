import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
    SelectGroup,
    SelectLabel
} from "@/components/ui/select";
import { useAuthStore } from '@/store/useAuthStore';
import { Building2, User, Plus, Settings } from 'lucide-react';
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog';

export function OrganizationSwitcher() {
    const navigate = useNavigate();
    const {
        user,
        organizations,
        currentOrganization,
        setCurrentOrganization,
        fetchOrganizations,
        isLoading
    } = useAuthStore();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchOrganizations();
        }
    }, [fetchOrganizations, user]);

    if (isLoading || organizations.length === 0) {
        return <div className="h-9 w-[200px] animate-pulse bg-muted rounded-md" />;
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Select
                    value={currentOrganization?.id}
                    onValueChange={(val) => {
                        if (val === 'create_new') {
                            setCreateDialogOpen(true);
                        } else if (val === 'settings') {
                            navigate('/organization');
                        } else {
                            setCurrentOrganization(val);
                        }
                    }}
                >
                    <SelectTrigger className="w-[200px]">
                        <div className="flex items-center gap-2">
                            {currentOrganization?.type === 'personal' ? (
                                <User className="h-4 w-4" />
                            ) : (
                                <Building2 className="h-4 w-4" />
                            )}
                            <SelectValue placeholder="Select Organization" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Organizations</SelectLabel>
                            {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                    <div className="flex items-center gap-2">
                                        {org.type === 'personal' ? (
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span>{org.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectItem value="settings" className="cursor-pointer">
                            <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                <span>Settings</span>
                            </div>
                        </SelectItem>
                        <SelectItem value="create_new" className="cursor-pointer">
                            <div className="flex items-center gap-2 text-primary font-medium">
                                <Plus className="h-4 w-4" />
                                <span>Create Team</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <CreateOrganizationDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </>
    );
}
