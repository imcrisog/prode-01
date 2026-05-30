"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useSessionUser } from "../../lib/useSessionUser";

type PaymentInfo = {
  id: string;
  status?: string;
  transaction_amount?: number;
  external_reference?: string;
  metadata?: {
    depositId?: string;
    kind?: string;
    userId?: string;
    amount?: number;
  };
};

function MpSuccessInner() {
  const { user, refresh } = useSessionUser();
  const router = useRouter();
  const sp = useSearchParams();

  const depositId = useMemo(() => {
    return sp.get("depositId") ?? sp.get("external_reference") ?? undefined;
  }, [sp]);

  const paymentId = useMemo(() => {
    return sp.get("payment_id") ?? sp.get("collection_id") ?? sp.get("id") ?? undefined;
  }, [sp]);

  const [status, setStatus] = useState<"idle" | "verifying" | "credited" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    if (!depositId || !paymentId) return;

    let cancelled = false;

    (async () => {
      try {
        setStatus("verifying");
        setError(null);

        const res = await fetch("/api/wallet/add", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            depositId,
            paymentId,
            userId: user.id,
          }),
        });

        if (!res.ok) throw new Error(await res.text());

        const data = (await res.json()) as {
          approved?: boolean;
          payment?: PaymentInfo;
        };

        if (cancelled) return;
        if (data.payment) setPayment(data.payment);

        if (!data.approved) {
          throw new Error("Pago no aprobado todavía");
        }

        await refresh();
        setStatus("credited");
        window.setTimeout(() => router.replace("/wallet"), 900);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [depositId, paymentId, refresh, router, user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Depósito</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Resultado de Mercado Pago (sandbox)
        </p>
      </div>

      <Card>
        {!user ? (
          <div className="space-y-3">
            <div className="text-sm">Necesitás iniciar sesión para acreditar.</div>
            <Button asChild>
              <Link href="/login">Ir a login</Link>
            </Button>
          </div>
        ) : !depositId ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Falta parámetro depositId.
          </div>
        ) : !paymentId ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Falta parámetro payment_id.
          </div>
        ) : status === "verifying" ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Verificando pago...</div>
        ) : status === "credited" ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Saldo acreditado</div>
            <div className="text-xs text-zinc-500">payment_id: {paymentId}</div>
            <Button asChild>
              <Link href="/wallet">Volver a billetera</Link>
            </Button>
          </div>
        ) : status === "error" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? "No se pudo acreditar"}
            </div>
            {payment ? (
              <pre className="overflow-auto rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-50">
                {JSON.stringify(payment, null, 2)}
              </pre>
            ) : null}
            <Button variant="secondary" asChild>
              <Link href="/wallet">Ir a billetera</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">Listo. Podés volver a la app.</div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function MpSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Depósito</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Cargando...
            </p>
          </div>
          <Card>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">Cargando...</div>
          </Card>
        </div>
      }
    >
      <MpSuccessInner />
    </Suspense>
  );
}
