import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import authService, { Account, RegisterPayload } from '@services/authService';
import { UNAUTHORIZED_EVENT } from '@services/api';

interface AuthContextValue {
  account: Account | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = async () => {
    const token = authService.getToken();
    if (!token) {
      setAccount(null);
      return;
    }

    try {
      const result = await authService.me();
      if (result?.success && result.data) {
        setAccount(result.data);
      } else {
        setAccount(null);
        authService.clearToken();
      }
    } catch (error) {
      setAccount(null);
      authService.clearToken();
      throw error;
    }
  };

  useEffect(() => {
    // chunk 6: react-router handles navigation; we just clear local state
    // here and let App.tsx's UNAUTHORIZED_EVENT listener navigate.
    const handleUnauthorized = () => {
      authService.clearToken();
      setAccount(null);
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized as EventListener);

    const boot = async () => {
      try {
        await refreshMe();
      } finally {
        setIsLoading(false);
      }
    };
    void boot();

    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized as EventListener);
    };
  }, []);

  const login = async (identifier: string, password: string, rememberMe = false) => {
    const result = await authService.login(identifier, password, rememberMe);
    if (!result?.success || !result.data) {
      throw new Error(result?.message || (result as any)?.error || '登录失败');
    }
    setAccount(result.data.account);
  };

  const register = async (payload: RegisterPayload) => {
    const result = await authService.register(payload);
    if (!result?.success) {
      throw new Error(result?.message || result?.error || '注册失败');
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      authService.clearToken();
    } finally {
      setAccount(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      isAuthenticated: Boolean(account),
      isLoading,
      login,
      register,
      logout,
      refreshMe
    }),
    [account, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
