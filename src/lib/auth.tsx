import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  // Public pages never ask who is signed in; only the dashboard and sign-in screens do.
  const needsAuth = pathname.startsWith("/dashboard") || pathname.startsWith("/auth");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  async function refresh() {
    setBusy(true);
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
      setBusy(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (needsAuth && !loaded) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAuth]);

  const loading = needsAuth && (!loaded || busy);

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
