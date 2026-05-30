"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        router.replace("/login");
      }
    })();
  }, [router]);
  return null;
}
