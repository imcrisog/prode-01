"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/Card";
import { DashboardShell } from "../../components/DashboardShell";
import {
  BallIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TicketIcon,
  UserIcon,
  ChevronRightIcon,
} from "../../components/icons";
import { RequireAuth } from "../../components/RequireAuth";
import { useSessionUser } from "../../lib/useSessionUser";

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function CartonConfirmInner() {
  const { user } = useSessionUser();
  const sp = useSearchParams();
  const router = useRouter();

  const purchaseId = sp.get("purchaseId") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<{ matchId: number; pick: "1" | "X" | "2" }[]>([]);

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!purchaseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/carton/picks?purchaseId=${encodeURIComponent(purchaseId)}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          picks?: { matchId: number; pick: "1" | "X" | "2" }[];
        };
        if (cancelled) return;
        setPicks(data.picks ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseId, user]);

  const summary = useMemo(() => {
    let local = 0;
    let draw = 0;
    let away = 0;
    for (const p of picks) {
      if (p.pick === "1") local++;
      if (p.pick === "X") draw++;
      if (p.pick === "2") away++;
    }
    return { local, draw, away, total: picks.length };
  }, [picks]);

  if (!user) return null;

  return (
    <RequireAuth>
      <DashboardShell
        brand={
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800">
              <Image
                src="/logo-prode.png"
                alt="PRODE"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">PRODE</div>
              <div className="text-[11px] text-zinc-400">Confirmación</div>
            </div>
          </div>
        }
        topNav={
          <div className="flex items-center gap-5 text-[13px]">
            <Link className="text-zinc-300 hover:text-zinc-50" href="/">
              Inicio
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/#envivo">
              En Vivo
              <span className="ml-2 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold text-red-200 ring-1 ring-red-500/25">
                LIVE
              </span>
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/#proximos">
              Próximos
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/account">
              Mis Apuestas
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/#stats">
              Estadísticas
            </Link>
            <Link className="text-zinc-300 hover:text-zinc-50" href="/#promo">
              Promociones
            </Link>
          </div>
        }
        topRight={
          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <div className="text-[11px] text-zinc-400">Saldo disponible</div>
              <div className="text-[13px] font-semibold text-lime-300 tabular-nums">
                ${formatMoneyARS(user.balance)}
              </div>
            </div>
            <Link
              href="/wallet"
              className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/15 text-lime-300 ring-1 ring-lime-500/25 hover:bg-lime-500/20"
              title="Cargar saldo"
            >
              <PlusIcon />
            </Link>
            <Link
              href="/account"
              className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900"
              title="Cuenta"
            >
              <UserIcon />
            </Link>
          </div>
        }
        navItems={[
          { label: "Inicio", href: "/", icon: <HomeIcon /> },
          {
            label: "En Vivo",
            href: "/#envivo",
            icon: <LiveIcon />,
            badge: (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/25">
                LIVE
              </span>
            ),
          },
          { label: "Fútbol", href: "/bet", icon: <BallIcon /> },
          { label: "Mis Apuestas", href: "/account", icon: <TicketIcon /> },
          { label: "Comprar Cartones", href: "/carton", icon: <PlusIcon />, active: true },
          { label: "Agregar saldo", href: "/wallet", icon: <PlusIcon /> },
        ]}
        left={
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
            <div className="space-y-2 text-[13px] text-zinc-200">
              <Link
                href="/carton"
                className="block rounded-2xl bg-lime-500/10 px-3 py-2 text-lime-200 ring-1 ring-lime-500/20"
              >
                Comprar cartones
              </Link>
              <Link
                href="/wallet"
                className="block rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800 hover:bg-zinc-900/60"
              >
                Agregar saldo
              </Link>
              <Link
                href="/logout"
                className="block rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800 hover:bg-zinc-900/60"
              >
                Cerrar sesión
              </Link>
            </div>
          </div>
        }
        center={
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="text-2xl font-extrabold">Confirmación</div>
              <div className="mt-2 text-[13px] text-zinc-400">
                Paso 3 (demo). purchaseId: <span className="text-zinc-200">{purchaseId || "-"}</span>
              </div>
            </div>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-6">
              {loading ? (
                <div className="text-[13px] text-zinc-400">Cargando pronósticos...</div>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
                  {error}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-[13px] text-zinc-400">
                    Pronósticos guardados: <span className="text-zinc-200">{summary.total}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                      <div className="text-[12px] text-zinc-400">Local (1)</div>
                      <div className="mt-1 text-xl font-extrabold text-lime-300 tabular-nums">
                        {summary.local}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                      <div className="text-[12px] text-zinc-400">Empate (X)</div>
                      <div className="mt-1 text-xl font-extrabold text-zinc-200 tabular-nums">
                        {summary.draw}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                      <div className="text-[12px] text-zinc-400">Visitante (2)</div>
                      <div className="mt-1 text-xl font-extrabold text-blue-200 tabular-nums">
                        {summary.away}
                      </div>
                    </div>
                  </div>
                  <div className="text-[12px] text-zinc-500">
                    (Demo) El próximo paso sería cerrar la confirmación y bloquear cambios cuando
                    arranque el primer partido.
                  </div>
                </div>
              )}
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-500/80 px-6 py-3 text-[13px] font-extrabold text-zinc-950 hover:bg-lime-500"
                disabled={closing || !purchaseId}
                onClick={async () => {
                  if (!purchaseId) return;
                  try {
                    setClosing(true);
                    setCloseError(null);
                    const res = await fetch("/api/carton/close", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ purchaseId }),
                    });
                    if (!res.ok) throw new Error(await res.text());
                    router.replace("/cartones");
                  } catch (e) {
                    setCloseError(e instanceof Error ? e.message : "No se pudo cerrar el cartón");
                  } finally {
                    setClosing(false);
                  }
                }}
              >
                {closing ? "Cerrando..." : "Volver a cartones"}
                <ChevronRightIcon className="h-4 w-4" />
              </button>

              {closeError ? (
                <div className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
                  {closeError}
                </div>
              ) : null}
            </Card>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-xs font-extrabold tracking-wide text-zinc-200">PAGOS 100% SEGUROS</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  🛡️
                </div>
                <div className="text-[12px] text-zinc-500">
                  Tus transacciones están protegidas con los más altos estándares de seguridad.
                </div>
              </div>
              <div className="mt-4">
                <Image
                  src="/MP_RGB_HANDSHAKE_color_horizontal.svg"
                  alt="Mercado Pago"
                  width={180}
                  height={40}
                />
              </div>
            </Card>
          </div>
        }
      />
    </RequireAuth>
  );
}

export default function CartonConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-zinc-950 text-zinc-50">
          <div className="mx-auto max-w-[1400px] px-4 py-10">
            <Card className="border-zinc-800 bg-zinc-950/40">
              <div className="text-sm text-zinc-300">Cargando...</div>
            </Card>
          </div>
        </div>
      }
    >
      <CartonConfirmInner />
    </Suspense>
  );
}
