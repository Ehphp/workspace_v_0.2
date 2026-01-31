import { MembersList } from '@/components/organizations/MembersList';
import { useAuthStore } from '@/store/useAuthStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Building2, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function OrganizationSettings() {
    const { currentOrganization } = useAuthStore();

    if (!currentOrganization) {
        return <div>Please select an organization.</div>;
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-slate-200 z-20 relative">
                <Header />
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="container mx-auto max-w-5xl py-8 px-6 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organization Settings</h1>
                        <p className="text-slate-500 mt-2">
                            Manage your organization profile, settings, and team members.
                        </p>
                    </div>

                    <div className="grid gap-6">
                        {/* Organization Profile Card */}
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                                            {currentOrganization.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-xl">{currentOrganization.name}</CardTitle>
                                        <CardDescription className="mt-1 flex items-center gap-2">
                                            {currentOrganization.type === 'personal' ? (
                                                <>
                                                    <User className="h-3.5 w-3.5" />
                                                    Personal Workspace
                                                </>
                                            ) : (
                                                <>
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    Team Organization
                                                </>
                                            )}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-slate-500">Organization Name</span>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium text-slate-900">
                                            {currentOrganization.name}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-sm font-medium text-slate-500">Organization ID</span>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono text-slate-600 truncate">
                                            {currentOrganization.id}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Members Section */}
                        {currentOrganization.type === 'team' && (
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="border-b border-slate-100 pb-4">
                                    <CardTitle>Team Members</CardTitle>
                                    <CardDescription>
                                        Manage who has access to this organization and their roles.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <MembersList />
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}