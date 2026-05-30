"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionUser } from "../lib/useSessionUser";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, refresh } = useSessionUser();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
      setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    // Solo redirigimos luego de verificar.
    if (checked && !user) router.replace("/login");
  }, [checked, router, user]);

  if (!checked || !user) return null;
  return <>{children}</>;
}
