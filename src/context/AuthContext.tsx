import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, authApi } from '../api/auth';
import { tokenStore } from '../api/tokenStore';
import { setUnauthorizedCallback } from '../api/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (data: { email?: string; phoneNumber?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleUnauthorized = useCallback(async () => {
    await tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedCallback(handleUnauthorized);
    checkAuth();
    return () => {
      setUnauthorizedCallback(null);
    };
  }, [handleUnauthorized]);

  const checkAuth = async () => {
    try {
      const token = await tokenStore.hydrate();
      if (!token) {
        setUser(null);
        return;
      }
      const response = await authApi.getProfile();
      if (response.user && response.user.role === 'admin') {
        setUser(response.user);
      } else {
        await authApi.logout().catch(() => {});
        await tokenStore.clear();
        setUser(null);
      }
    } catch (error) {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: { email?: string; phoneNumber?: string; password: string }) => {
    const response = await authApi.login(data);
    if (response.user.role !== 'admin') {
      await authApi.logout().catch(() => {});
      throw new Error('Access denied. Admin privileges required.');
    }
    if (response.token) {
      await tokenStore.save(response.token);
    }
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      await tokenStore.clear();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
