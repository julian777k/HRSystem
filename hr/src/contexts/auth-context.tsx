'use client';

import { createContext, use, useEffect, useState, useCallback, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  positionName: string;
  tenantId: string;
  customPermissions?: string | null;
}

interface TenantTrial {
  status: string;
  trialExpiresAt: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  tenantTrial: TenantTrial | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenantTrial: null,
  loading: true,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenantTrial, setTenantTrial] = useState<TenantTrial | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        setUser(null);
        setTenantTrial(null);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        setTenantTrial(data.tenantTrial || null);
      }
    } catch {
      // Network error — keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuth();
  }, [fetchAuth]);

  return (
    <AuthContext.Provider value={{ user, tenantTrial, loading, refreshAuth: fetchAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return use(AuthContext);
}
