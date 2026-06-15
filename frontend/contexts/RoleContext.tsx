'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl, authHeaders as getAuthHeaders } from '../lib/api';

interface RoleContextValue {
  currentRole: string;
  isAdmin: boolean;
  isHR: boolean;
  isSupervisor: boolean;
  refreshRole: () => Promise<void>;
  loading: boolean;
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
  const [currentRole, setCurrentRole] = useState<string>(getUserRoleFromStorage());
  const [loading, setLoading] = useState(true);

  const isAdmin = currentRole === 'admin';
  const isHR = ['hr', 'admin'].includes(currentRole);
  const isSupervisor = ['supervisor', 'admin', 'lead'].includes(currentRole);

  const refreshRole = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setCurrentRole('user');
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
        setCurrentRole(res.data.role ?? 'user');
      }
    } catch {
      // Fall back to whatever is in storage
      setCurrentRole(getUserRoleFromStorage());
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + sync role from storage
  useEffect(() => {
    const syncFromStorage = () => {
      setCurrentRole(getUserRoleFromStorage());
    };

    syncFromStorage();
    refreshRole();

    // Listen for storage changes (e.g. login/logout in another tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nova_user' || e.key === 'access_token') {
        syncFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => window.removeEventListener('storage', onStorage);
  }, [refreshRole]);

  const value: RoleContextValue = {
    currentRole,
    isAdmin,
    isHR,
    isSupervisor,
    refreshRole,
    loading,
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
