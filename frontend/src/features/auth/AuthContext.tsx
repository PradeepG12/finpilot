import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, setAccessToken } from '@/lib/api';
import { ApiResponse, User } from '@/types/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Bootstrap check: attempt refresh cookie
    apiClient
      .post<ApiResponse<{ access: string }>>('/auth/refresh/')
      .then((res) => {
        setAccessToken(res.data.data.access);
        return apiClient.get<ApiResponse<User>>('/auth/me/');
      })
      .then((res) => {
        setUser(res.data.data);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<ApiResponse<{ access: string; user: User }>>('/auth/login/', {
      email,
      password,
    });
    setAccessToken(res.data.data.access);
    setUser(res.data.data.user);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout/');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : null));
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get<ApiResponse<User>>('/auth/me/');
      setUser(res.data.data);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
