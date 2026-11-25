import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string; verificationChannel: "email" | "sms" }) => Promise<{ verificationSent: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("fueliq_token"));
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        const userData = json.data?.user || json.data || json.user;
        if (!userData?.id) throw new Error("Account details were missing from the response");
        setUser(userData);
      } else if (res.status === 401 || res.status === 404) {
        localStorage.removeItem("fueliq_token");
        setToken(null);
        setUser(null);
      } else {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message || "Unable to load account details");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void fetchUser(token).catch((error) => {
        console.error("Unable to refresh the signed-in user:", error);
      });
    } else {
      setIsLoading(false);
    }
  }, [token, fetchUser]);

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token);
    }
  }, [token, fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Login failed");
    }
    const json = await res.json();
    const authData = json.data || json;
    const tokenValue = authData.token || authData.accessToken;
    if (!tokenValue) {
      throw new Error("Login response did not include a token");
    }
    if (!authData.user?.id) {
      throw new Error("Login response did not include account details");
    }
    localStorage.setItem("fueliq_token", tokenValue);
    setUser(authData.user);
    setToken(tokenValue);
  };

  const register = async (regData: { name: string; email: string; password: string; phone: string; verificationChannel: "email" | "sms" }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Registration failed");
    }
    const json = await res.json();
    const authData = json.data || json;
    const tokenValue = authData.token || authData.accessToken;
    if (!tokenValue) {
      throw new Error("Registration response did not include a token");
    }
    if (!authData.user?.id) {
      throw new Error("Registration response did not include account details");
    }
    localStorage.setItem("fueliq_token", tokenValue);
    setUser(authData.user);
    setToken(tokenValue);
    return { verificationSent: Boolean(authData.verificationSent) };
  };

  const logout = () => {
    localStorage.removeItem("fueliq_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
