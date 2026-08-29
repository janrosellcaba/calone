import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthUser = {
  username: string;
};

type AuthMeResponse = {
  authenticated: boolean;
  username: string;
};

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    inviteCode: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await apiFetch<AuthMeResponse>("/auth/me");
      setUser({ username: me.username });
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiFetch<AuthMeResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser({ username: result.username });
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (username: string, password: string, inviteCode: string) => {
      const result = await apiFetch<AuthMeResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password, inviteCode }),
      });
      setUser({ username: result.username });
      setStatus("authenticated");
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    await apiFetch<void>("/auth/account", { method: "DELETE" });
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, deleteAccount }),
    [status, user, login, register, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
