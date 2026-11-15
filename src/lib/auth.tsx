import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

type AuthState = {
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  needsBootstrap: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const me = await api.get<{ userId: string; isAdmin: boolean }>("/auth/me");
      setIsAuthenticated(true);
      setIsAdmin(me.isAdmin);
      setNeedsBootstrap(false);
    } catch {
      setIsAuthenticated(false);
      setIsAdmin(false);
      try {
        const status = await api.get<{ needsBootstrap: boolean }>("/auth/bootstrap-status");
        setNeedsBootstrap(status.needsBootstrap);
      } catch {
        setNeedsBootstrap(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ loading, isAuthenticated, isAdmin, needsBootstrap, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
