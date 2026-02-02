'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';
import db from '@/lib/db';
import syncEngine from '@/lib/sync/engine';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user profile
  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setUser(data as UserProfile);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError('Failed to load user profile');
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          await loadUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user && mounted) {
          await loadUserProfile(session.user.id);
        } else if (mounted) {
          setUser(null);
        }

        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Load and return user profile directly for immediate use
        const { data: profile, error: profileError } = await supabase
          .from('members')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile) {
          setUser(profile as UserProfile);
          return { success: true, user: data.user, profile: profile as UserProfile };
        }
      }

      return { success: false, error: 'No user returned' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setLoading(true);

    try {
      // Check for pending sync items first
      const pendingItems = await db.getPendingSyncItems();
      if (pendingItems.length > 0) {
        // Try to sync one last time
        const result = await syncEngine.sync();
        if (!result.success) {
          // If sync failed, warn the user (return false so UI can handle it)
          throw new Error(`Cannot logout: ${pendingItems.length} items pending sync. Please check your connection and try "Sync Now" first.`);
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get redirect path based on role
  const getRedirectPath = useCallback((role?: UserRole): string => {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'secretary':
        return '/secretary/checkin';
      case 'member':
        return '/member/qr';
      default:
        return '/auth/login';
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signOut,
    getRedirectPath,
  };
}

export default useAuth;
