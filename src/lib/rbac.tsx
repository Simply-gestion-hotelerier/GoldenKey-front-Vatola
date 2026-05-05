import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

export type Role =
  | 'admin' | 'manager' | 'reception' | 'housekeeping'
  | 'serveur' | 'cuisine' | 'bar' | 'spa' | 'compta';

type BackendRole =
  | 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING'
  | 'KITCHEN' | 'WAITER' | 'BARTENDER' | 'CASHIER' | 'GUEST';

function mapBackendRoleToUi(role: BackendRole): Role {
  switch (role) {
    case 'ADMIN': return 'admin';
    case 'MANAGER': return 'manager';
    case 'RECEPTION': return 'reception';
    case 'HOUSEKEEPING': return 'housekeeping';
    case 'WAITER': return 'serveur';
    case 'KITCHEN': return 'cuisine';
    case 'BARTENDER': return 'bar';
    case 'CASHIER': return 'compta';
    case 'GUEST': return 'reception';
    default: return 'manager';
  }
}

export interface User {
  id: string;
  username: string;
  role: Role;
  permissions?: string[];
  avatar?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  role: Role;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => void;
  hasScope: (scope: string) => boolean;
  hasScopes: (scopes: string | string[]) => boolean; // ✅ ajouté
  updateUser: (updates: Partial<User>) => void;
  setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const me = await api.get<{
          id: number;
          email: string;
          name?: string;
          role: BackendRole;
          scopes: string[];
        }>("/auth/me");

        const u: User = {
          id: String(me.id),
          username: me.email.split('@')[0],
          role: mapBackendRoleToUi(me.role),
          name: me.name,
          email: me.email,
          permissions: me.scopes,
        };

        setUser(u);
        localStorage.setItem('userData', JSON.stringify(u));
        setIsAuthenticated(true);

      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      const res = await api.post<{
        token: string;
        user: {
          id: number;
          email: string;
          name?: string;
          role: BackendRole;
          scopes: string[];
        };
      }>(
        '/auth/login',
        { email: credentials.username, password: credentials.password }
      );

      const u: User = {
        id: String(res.user.id),
        username: res.user.email.split('@')[0],
        role: mapBackendRoleToUi(res.user.role),
        name: res.user.name,
        email: res.user.email,
        permissions: res.user.scopes,
      };

      localStorage.setItem('authToken', res.token);
      localStorage.setItem('userData', JSON.stringify(u));

      setUser(u);
      setIsAuthenticated(true);

      return { success: true, user: u };

    } catch {
      return { success: false, error: 'Identifiants invalides' };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setIsAuthenticated(false);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;

    const updated = { ...user, ...updates };
    setUser(updated);

    localStorage.setItem('userData', JSON.stringify(updated));

    window.dispatchEvent(
      new CustomEvent('userProfileUpdated', { detail: updated })
    );
  };

  const setRole = (newRole: Role) => {
    if (!user) return;

    const updated = { ...user, role: newRole };
    setUser(updated);

    localStorage.setItem('userData', JSON.stringify(updated));
  };

  // ✅ Scope simple
  const hasScope = (scope: string): boolean => {
    if (!user || !user.permissions) return false;
    if (user.permissions.includes('*')) return true;
    return user.permissions.includes(scope);
  };

  // ✅ Scope multiple (ALIGNÉ BACKEND)
  const hasScopes = (required: string | string[]): boolean => {
    if (!user || !user.permissions) return false;

    const req = Array.isArray(required) ? required : [required];

    if (user.permissions.includes('*')) return true;

    return req.every((scope) => user.permissions!.includes(scope));
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    hasScope,
    hasScopes, // ✅ exposé
    updateUser,
    setRole,
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

// ✅ Hook permissions amélioré
export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (permission: string) =>
    !!user?.permissions?.includes('*') ||
    !!user?.permissions?.includes(permission);

  const hasScopes = (required: string | string[]) => {
    if (!user?.permissions) return false;

    const req = Array.isArray(required) ? required : [required];

    if (user.permissions.includes('*')) return true;

    return req.every((s) => user.permissions!.includes(s));
  };

  const hasRole = (role: Role) => user?.role === role;

  return { hasPermission, hasScopes, hasRole };
};

export const useUserProfile = () => {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState(user);

  useEffect(() => {
    setCurrentUser(user);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.id === user?.id) {
        setCurrentUser(detail);
      }
    };

    window.addEventListener('userProfileUpdated', handler as EventListener);

    return () =>
      window.removeEventListener('userProfileUpdated', handler as EventListener);
  }, [user]);

  return currentUser;
};

export const getUserData = (username: string): any => {
  try {
    const data = localStorage.getItem('userData');
    if (!data) return null;

    const parsed = JSON.parse(data);

    if (
      parsed &&
      parsed.username &&
      parsed.username.toLowerCase() === username.toLowerCase()
    ) {
      return parsed;
    }

    return parsed;
  } catch {
    return null;
  }
};