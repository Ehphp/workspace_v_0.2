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
        isLoading,
        isSwitchingOrg
    } = useAuthStore();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

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
                    onValueChange={async (val) => {
                        if (val === 'create_new') {
                            setCreateDialogOpen(true);
                        } else if (val === 'settings') {
                            navigate('/organization');
                        } else {
                            await setCurrentOrganization(val);
                        }
                        setIsOpen(false);
                    }}
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    disabled={isSwitchingOrg}
                >
                    <SelectTrigger className={`h-10 bg-gradient-to-br from-white to-slate-50/80 hover:from-slate-50 hover:to-slate-100/80 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out rounded-lg backdrop-blur-sm overflow-hidden ${isOpen ? 'w-[220px] border-slate-200/60' : 'w-[44px] border-transparent'} ${isSwitchingOrg ? 'opacity-70 cursor-wait' : ''
                        }`}>
                        <div className={`flex items-center w-full ${isOpen ? 'gap-3 justify-start' : 'justify-center'}`}>
                            <div className={`flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 ${currentOrganization?.type === 'personal'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-purple-50 text-purple-600'
                                } transition-colors`}>
                                {currentOrganization?.type === 'personal' ? (
                                    <User className="h-4 w-4" />
                                ) : (
                                    <Building2 className="h-4 w-4" />
                                )}
                            </div>
                            <span className={`font-medium text-slate-700 text-sm truncate transition-all duration-300 ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                                }`}>
                                {currentOrganization?.name || 'Select Organization'}
                            </span>
                        </div>
                    </SelectTrigger>
                    <SelectContent className="w-[260px] border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl p-2">
                        <SelectGroup>
                            <SelectLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Workspaces</SelectLabel>
                            <div className="space-y-1 mb-2">
                                {organizations.map((org) => (
                                    <SelectItem
                                        key={org.id}
                                        value={org.id}
                                        className="rounded-lg cursor-pointer hover:bg-slate-50 transition-all duration-150 py-2.5 px-3 focus:bg-blue-50/50 focus:text-blue-900"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${org.type === 'personal'
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'bg-purple-50 text-purple-600'
                                                } transition-colors`}>
                                                {org.type === 'personal' ? (
                                                    <User className="h-4 w-4" />
                                                ) : (
                                                    <Building2 className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{org.name}</span>
                                                <span className="text-xs text-slate-500">
                                                    {org.type === 'personal' ? 'Personal Workspace' : 'Team Organization'}
                                                </span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </div>
                        </SelectGroup>
                        <SelectSeparator className="bg-slate-100 my-2" />
                        <div className="space-y-1">
                            <SelectItem value="settings" className="rounded-lg cursor-pointer hover:bg-slate-50 transition-all duration-150 py-2.5 px-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-600">
                                        <Settings className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-700">Organization Settings</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="create_new" className="rounded-lg cursor-pointer hover:bg-blue-50 transition-all duration-150 py-2.5 px-3">
                                <div className="flex items-center gap-3 text-blue-600">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    <span className="font-semibold">Create New Team</span>
                                </div>
                            </SelectItem>
                        </div>
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
