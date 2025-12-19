import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useAuth] Initializing auth state...');

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        console.log('[useAuth] Initial session:', session ? 'Found' : 'None', error ? `Error: ${error.message}` : '');
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useAuth] Error getting session:', err);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] Auth state changed:', event, session ? 'Session exists' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('[useAuth] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  return { user, session, loading };
}