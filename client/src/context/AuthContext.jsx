import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, TOKEN_KEY, USER_KEY } from '../api/client';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (_error) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const storeSession = useCallback((session) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get('/auth/me')
      .then(({ user: freshUser }) => {
        if (cancelled) return;
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, clearSession]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener('groundwork:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('groundwork:unauthorized', handleUnauthorized);
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const session = await api.post('/auth/login', credentials);
      storeSession(session);
      return session.user;
    },
    [storeSession]
  );

  const register = useCallback(
    async (details) => {
      const session = await api.post('/auth/register', details);
      storeSession(session);
      return session.user;
    },
    [storeSession]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
