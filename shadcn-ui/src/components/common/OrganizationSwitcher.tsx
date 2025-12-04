import { useEffect } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from '@/store/useAuthStore';
import { Building2, User } from 'lucide-react';

export function OrganizationSwitcher() {
    const {
        user,
        organizations,
        currentOrganization,
        setCurrentOrganization,
        fetchOrganizations,
        isLoading
    } = useAuthStore();

    useEffect(() => {
        if (user) {
            fetchOrganizations();
        }
    }, [fetchOrganizations, user]);

    if (isLoading || organizations.length === 0) {
        return <div className="h-9 w-[200px] animate-pulse bg-muted rounded-md" />;
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={currentOrganization?.id}
                onValueChange={setCurrentOrganization}
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
                </SelectContent>
            </Select>
        </div>
    );
}
