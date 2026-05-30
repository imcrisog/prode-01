"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "./localdb";

export function useSessionUser() {
  // Importante para evitar hydration mismatch:
  // en SSR no existe localStorage, así que siempre empezamos en null.
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as {
        user: { id: string; name?: string; email?: string; balance?: number } | null;
      };
      if (!data.user) {
        setUser(null);
        return;
      }
      setUser({
        id: data.user.id,
        name: data.user.name ?? "",
        email: data.user.email ?? "",
        password: "",
        balance: data.user.balance ?? 0,
        createdAt: Date.now(),
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Refresco inicial en el cliente
    window.setTimeout(() => refresh(), 0);
  }, [refresh]);

  return { user, refresh };
}
