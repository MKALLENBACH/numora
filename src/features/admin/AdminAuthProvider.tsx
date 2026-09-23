"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getAdminSupabaseBrowserClient } from "@/lib/supabase/browser";

import { adminClient, AdminClientError } from "./admin-client";
import type { AdminAuthStatus, AdminSession } from "./types";

type AdminAuthContextValue = {
  status: AdminAuthStatus;
  session: AdminSession | null;
  message: string | null;
  login: (email: string, password: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<AdminSession | null>;
  clearMessage: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [status, setStatus] = useState<AdminAuthStatus>("loading");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const operationRef = useRef(0);

  const refresh = useCallback(async () => {
    const operation = ++operationRef.current;
    setSession(null);
    setStatus("loading");
    try {
      const restored = await adminClient.restore();
      if (operation !== operationRef.current) return null;
      setSession(restored);
      setStatus("authenticated");
      setMessage(null);
      return restored;
    } catch (error) {
      if (operation !== operationRef.current) return null;
      setSession(null);
      if (error instanceof AdminClientError && error.code === "ACCESS_DENIED") {
        setStatus("denied");
        setMessage(error.message);
      } else {
        setStatus("anonymous");
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restoreTimer = window.setTimeout(() => {
      if (active) void refresh();
    }, 0);

    const supabase = getAdminSupabaseBrowserClient();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        operationRef.current += 1;
        setSession(null);
        setStatus("anonymous");
      } else if (event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          if (active) void refresh();
        }, 0);
      }
    }).data.subscription;

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && active) void refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && active) void refresh();
    };
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      operationRef.current += 1;
      window.clearTimeout(restoreTimer);
      subscription?.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  const value = useMemo<AdminAuthContextValue>(() => ({
    status,
    session,
    message,
    async login(email, password) {
      const operation = ++operationRef.current;
      setMessage(null);
      setSession(null);
      setStatus("loading");
      try {
        const authenticated = await adminClient.login(email, password);
        if (operation === operationRef.current) {
          setSession(authenticated);
          setStatus("authenticated");
        }
        return authenticated;
      } catch (error) {
        if (operation === operationRef.current) {
          setSession(null);
          setStatus(error instanceof AdminClientError && error.code === "ACCESS_DENIED"
            ? "denied"
            : "anonymous");
        }
        throw error;
      }
    },
    async logout() {
      const operation = ++operationRef.current;
      setSession(null);
      setStatus("loading");
      await adminClient.logout();
      if (operation === operationRef.current) setStatus("anonymous");
    },
    refresh,
    clearMessage: () => setMessage(null),
  }), [message, refresh, session, status]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return context;
}
