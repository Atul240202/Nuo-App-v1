import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, setSessionToken, getSessionToken } from '../utils/api';

export interface NuoUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  personalization?: any;
  calendar_synced?: boolean;
  google_calendar_tokens?: any;
}

interface AuthContextValue {
  user: NuoUser | null;
  loading: boolean;
  refresh: () => Promise<NuoUser | null>;
  setAuth: (token: string, user: NuoUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => null,
  setAuth: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<NuoUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<NuoUser | null> => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setUser(null);
        return null;
      }
      const resp = await apiFetch('/api/auth/me');
      if (!resp.ok) {
        setUser(null);
        return null;
      }
      const data = (await resp.json()) as NuoUser;
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const setAuth = useCallback(async (token: string, u: NuoUser) => {
    await setSessionToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    await setSessionToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, refresh, setAuth, logout }),
    [user, loading, refresh, setAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
