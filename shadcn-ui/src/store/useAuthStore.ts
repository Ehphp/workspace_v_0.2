import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Organization, OrganizationMember } from '@/types/database';

interface AuthState {
    user: any | null;
    organizations: Organization[];
    currentOrganization: Organization | null;
    userRole: 'admin' | 'editor' | 'viewer' | null;
    isLoading: boolean;

    // Actions
    setUser: (user: any) => void;
    fetchOrganizations: () => Promise<void>;
    setCurrentOrganization: (orgId: string) => void;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            organizations: [],
            currentOrganization: null,
            userRole: null,
            isLoading: false,

            setUser: (user) => set({ user }),

            fetchOrganizations: async () => {
                const { user } = get();
                if (!user) return;

                set({ isLoading: true });
                try {
                    // Fetch orgs where user is a member
                    const { data: members, error: memberError } = await supabase
                        .from('organization_members')
                        .select('*, organizations(*)')
                        .eq('user_id', user.id);

                    if (memberError) throw memberError;

                    const organizations = members.map((m: any) => m.organizations) as Organization[];

                    // Determine current org (restore from state or pick first)
                    let currentOrg = get().currentOrganization;
                    if (!currentOrg || !organizations.find(o => o.id === currentOrg?.id)) {
                        currentOrg = organizations[0] || null;
                    }

                    // Determine role in current org
                    const currentMember = members.find((m: any) => m.org_id === currentOrg?.id);
                    const userRole = currentMember ? currentMember.role : null;

                    set({ organizations, currentOrganization: currentOrg, userRole });
                } catch (error) {
                    console.error('Failed to fetch organizations:', error);
                } finally {
                    set({ isLoading: false });
                }
            },

            setCurrentOrganization: (orgId: string) => {
                const { organizations, user } = get();
                const org = organizations.find(o => o.id === orgId);
                if (org) {
                    // We need to re-fetch the role for this org, but we can optimize if we stored members
                    // For now, let's just trigger a fetch or store members in state. 
                    // Simpler: Just fetch members again or store them. 
                    // Let's assume we want to keep it simple and just update the role from a fresh fetch or derived.
                    // Actually, let's just re-run fetchOrganizations or better, store members map.
                    // For MVP, let's just set it and let the component trigger a refresh if needed, 
                    // BUT we need the role immediately.

                    // Let's do a quick fetch for the role to be safe
                    supabase
                        .from('organization_members')
                        .select('role')
                        .eq('org_id', orgId)
                        .eq('user_id', user.id)
                        .single()
                        .then(({ data }) => {
                            set({ currentOrganization: org, userRole: data?.role as any });
                        });
                }
            },

            signOut: async () => {
                await supabase.auth.signOut();
                set({ user: null, organizations: [], currentOrganization: null, userRole: null });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                currentOrganization: state.currentOrganization
            }), // Only persist the selected org preference
        }
    )
);
