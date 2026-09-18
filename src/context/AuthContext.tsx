import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, authApi } from '../api/auth';
import { api } from '../api/api';

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { user } = await authApi.getProfile();
      if (user.role === 'admin') {
        setUser(user);
      } else {
        await authApi.logout();
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: { email?: string; phoneNumber?: string; password: string }) => {
    const response = await authApi.login(data);
    if (response.user.role !== 'admin') {
      await authApi.logout();
      throw new Error('Access denied. Admin privileges required.');
    }
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
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
