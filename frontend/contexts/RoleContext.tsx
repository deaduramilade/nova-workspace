'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl, authHeaders as getAuthHeaders } from '../lib/api';

interface RoleContextValue {
  realRole: string;           // The actual role from the database
  testingRole: string | null; // Temporary role for testing (not persisted to DB)
  effectiveRole: string;      // testingRole || realRole
  isAdmin: boolean;
  isHR: boolean;
  isSupervisor: boolean;
  isSuperAdmin: boolean;
  realIsAdmin: boolean;
  realIsHR: boolean;
  realIsSupervisor: boolean;
  realIsSuperAdmin: boolean;
  setTestingRole: (role: string) => void;
  clearTestingRole: () => void;
  submitRoleRequest: (desiredRole: string) => Promise<boolean>;
  refreshRole: () => Promise<void>;
  loading: boolean;
  isTesting: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function getUserRoleFromStorage(): string {
  try {
    const raw = localStorage.getItem('nova_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.role ?? 'user';
    }
  } catch {
    /* ignore */
  }
  return 'user';
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [realRole, setRealRole] = useState<string>(getUserRoleFromStorage());
  const [testingRole, setTestingRoleState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('testing_role') || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const effectiveRole = testingRole || realRole;

  const isAdmin = ['admin', 'super_admin'].includes(effectiveRole);
  const isHR = ['hr', 'admin', 'super_admin'].includes(effectiveRole);
  const isSupervisor = ['supervisor', 'admin', 'super_admin', 'lead'].includes(effectiveRole);
  const isSuperAdmin = effectiveRole === 'super_admin';

  const realIsAdmin = ['admin', 'super_admin'].includes(realRole);
  const realIsHR = ['hr', 'admin', 'super_admin'].includes(realRole);
  const realIsSupervisor = ['supervisor', 'admin', 'super_admin', 'lead'].includes(realRole);
  const realIsSuperAdmin = realRole === 'super_admin';

  const isTesting = !!testingRole;

  const setTestingRole = (role: string) => {
    const normalized = role.toLowerCase();
    setTestingRoleState(normalized);
    try {
      localStorage.setItem('testing_role', normalized);
    } catch {}
  };

  const clearTestingRole = () => {
    setTestingRoleState(null);
    try {
      localStorage.removeItem('testing_role');
    } catch {}
  };

  const submitRoleRequest = useCallback(async (desiredRole: string): Promise<boolean> => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return false;
    }
    try {
      await axios.post(
        apiUrl('/admin/me/request-role'),
        { desired_role: desiredRole.toLowerCase() },
        { headers: getAuthHeaders() }
      );
      // After submitting, we can optionally refresh to see if it affects anything,
      // but since it's pending, realRole stays the same.
      return true;
    } catch (e: any) {
      console.error('Role request failed', e);
      return false;
    }
  }, []);

  const refreshRole = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setRealRole('user');
      clearTestingRole(); // clear testing on logout
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(apiUrl('/users/me'), {
        headers: getAuthHeaders(),
      });

      if (res.data) {
        // Merge with existing local data and persist
        const prevRaw = localStorage.getItem('nova_user');
        let merged = res.data;
        if (prevRaw) {
          try {
            const prev = JSON.parse(prevRaw);
            merged = { ...prev, ...res.data };
          } catch {
            /* ignore */
          }
        }
        localStorage.setItem('nova_user', JSON.stringify(merged));
        setRealRole(res.data.role ?? 'user');
      }
    } catch {
      // Fall back to whatever is in storage
      setRealRole(getUserRoleFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + sync role from storage
  useEffect(() => {
    const syncFromStorage = () => {
      setRealRole(getUserRoleFromStorage());
    };

    syncFromStorage();
    refreshRole();

    // Listen for storage changes (e.g. login/logout in another tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nova_user' || e.key === 'access_token') {
        syncFromStorage();
      }
      if (e.key === 'testing_role') {
        try {
          setTestingRoleState(localStorage.getItem('testing_role') || null);
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);
  }, [refreshRole]);

  const value: RoleContextValue = {
    realRole,
    testingRole,
    effectiveRole,
    isAdmin,
    isHR,
    isSupervisor,
    isSuperAdmin,
    realIsAdmin,
    realIsHR,
    realIsSupervisor,
    realIsSuperAdmin,
    setTestingRole,
    clearTestingRole,
    submitRoleRequest,
    refreshRole,
    loading,
    isTesting,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return ctx;
}
