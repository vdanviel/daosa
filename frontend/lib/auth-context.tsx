'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, ApiError, User } from './api';

export type { User };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  /** CPF ou CNPJ validado no backend. */
  document: string;
  password: string;
}

const TOKEN_STORAGE_KEY = 'auth_token';
/** Chave antiga de cache de usuário — removida apenas para limpar dados legados. */
const LEGACY_USER_STORAGE_KEY = 'auth_user';

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  token: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!currentToken) return;

    const userData = await api.user.me();
    setUser(userData);
  }, []);

  const loadSession = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);

    if (storedToken) {
      setToken(storedToken);
      try {
        await refreshUser();
      } catch (err) {
        // Token expirado/inválido (401/403) limpa a sessão; erro de rede mantém o token.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession();
        }
      }
    }
    setLoading(false);
  }, [refreshUser, clearSession]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (email: string, password: string) => {
    const data = await api.user.login({ email, password });

    // Somente o token é persistido; o usuário fica só em estado (buscado via /user/me).
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  };

  const register = async (formData: RegisterData) => {
    await api.user.register(formData);

    // O registro não retorna token — autentica em seguida.
    await login(formData.email, formData.password);
  };

  const logout = async () => {
    // O backend não possui endpoint de logout; o JWT é invalidado apenas pela expiração.
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
