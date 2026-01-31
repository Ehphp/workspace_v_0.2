import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Organization, OrganizationMember } from '@/types/database';

// Cache structure to store user roles per organization
interface MembershipCache {
    [orgId: string]: 'admin' | 'editor' | 'viewer';
}

interface AuthState {
    user: any | null;
    organizations: Organization[];
    currentOrganization: Organization | null;
    userRole: 'admin' | 'editor' | 'viewer' | null;
    isLoading: boolean;
    isSwitchingOrg: boolean; // New: track org switch state
    membershipCache: MembershipCache; // New: cache roles per org

    // Actions
    setUser: (user: any) => void;
    fetchOrganizations: () => Promise<void>;
    setCurrentOrganization: (orgId: string) => Promise<void>; // Now async
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
            isSwitchingOrg: false,
            membershipCache: {},

            setUser: (user) => set({ user }),

            fetchOrganizations: async () => {
                const { user } = get();
                if (!user) {
                    console.log('[useAuthStore] fetchOrganizations: No user found');
                    return;
                }

                console.log('[useAuthStore] Fetching organizations for user:', user.id);
                set({ isLoading: true });
                try {
                    // Fetch orgs where user is a member
                    const { data: members, error: memberError } = await supabase
                        .from('organization_members')
                        .select('*, organizations(*)')
                        .eq('user_id', user.id);

                    if (memberError) {
                        console.error('[useAuthStore] Error fetching members:', memberError);
                        throw memberError;
                    }

                    console.log('[useAuthStore] Found members:', members?.length);

                    const organizations = members.map((m: any) => m.organizations) as Organization[];
                    console.log('[useAuthStore] Mapped organizations:', organizations.length);

                    // Build membership cache for instant role lookups
                    const membershipCache: MembershipCache = {};
                    members.forEach((m: any) => {
                        membershipCache[m.org_id] = m.role;
                    });

                    // Determine current org (restore from state or pick first)
                    let currentOrg = get().currentOrganization;
                    if (!currentOrg || !organizations.find(o => o.id === currentOrg?.id)) {
                        currentOrg = organizations[0] || null;
                    }

                    console.log('[useAuthStore] Current organization:', currentOrg?.id);

                    // Determine role in current org from cache
                    const userRole = currentOrg ? membershipCache[currentOrg.id] || null : null;

                    console.log('[useAuthStore] User role:', userRole);

                    set({ organizations, currentOrganization: currentOrg, userRole, membershipCache });
                } catch (error) {
                    console.error('[useAuthStore] Failed to fetch organizations:', error);
                } finally {
                    set({ isLoading: false });
                }
            },

            setCurrentOrganization: async (orgId: string) => {
                const { organizations, user, membershipCache } = get();
                const org = organizations.find(o => o.id === orgId);

                if (!org || !user) return;

                // First, check if we have the role in cache
                let role = membershipCache[orgId];

                if (role) {
                    // Instant switch - role is cached
                    console.log('[useAuthStore] Switching org (cached):', orgId, 'role:', role);
                    set({ currentOrganization: org, userRole: role });
                } else {
                    // Need to fetch role - show loading state
                    console.log('[useAuthStore] Switching org (fetching role):', orgId);
                    set({ isSwitchingOrg: true, userRole: null }); // Clear role during fetch

                    try {
                        const { data, error } = await supabase
                            .from('organization_members')
                            .select('role')
                            .eq('org_id', orgId)
                            .eq('user_id', user.id)
                            .single();

                        if (error) throw error;

                        role = data?.role as 'admin' | 'editor' | 'viewer';

                        // Update cache and state atomically
                        set({
                            currentOrganization: org,
                            userRole: role,
                            membershipCache: { ...get().membershipCache, [orgId]: role }
                        });
                    } catch (error) {
                        console.error('[useAuthStore] Failed to fetch role for org:', error);
                        // Fallback to viewer for safety
                        set({ currentOrganization: org, userRole: 'viewer' });
                    } finally {
                        set({ isSwitchingOrg: false });
                    }
                }
            },

            signOut: async () => {
                await supabase.auth.signOut();
                set({
                    user: null,
                    organizations: [],
                    currentOrganization: null,
                    userRole: null,
                    membershipCache: {},
                    isSwitchingOrg: false
                });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                currentOrganization: state.currentOrganization,
                membershipCache: state.membershipCache // Persist cache for faster startup
            }),
        }
    )
);
