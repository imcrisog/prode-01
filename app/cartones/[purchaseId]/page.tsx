"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "../../components/Card";
import { DashboardShell } from "../../components/DashboardShell";
import {
  BallIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TicketIcon,
  UserIcon,
} from "../../components/icons";
import { RequireAuth } from "../../components/RequireAuth";
import { useSessionUser } from "../../lib/useSessionUser";

type Pick = "1" | "X" | "2";

type PurchaseMatch = {
  index: number;
  local_name: string;
  visit_name: string;
  category?: string;
  timetoplay?: string;
  local_logo_url?: string;
  visit_logo_url?: string;
  result?: "local" | "draw" | "visit" | null;
  has_result?: boolean;
};

function imgUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://admin.vedo.com.ar${path}`;
}

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function CartonViewInner() {
  const { user } = useSessionUser();
  const params = useParams<{ purchaseId: string }>();
  const router = useRouter();

  const purchaseId = params?.purchaseId ? String(params.purchaseId) : "";
  const price = 1000;

  const [matches, setMatches] = useState<PurchaseMatch[]>([]);
  const [picks, setPicks] = useState<{ matchId: number; pick: Pick }[]>([]);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/carton/picks?purchaseId=${encodeURIComponent(purchaseId)}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          picks?: { matchId: number; pick: Pick }[];
          matches?: PurchaseMatch[];
          closed?: boolean;
        };
        if (cancelled) return;
        setMatches(Array.isArray(data.matches) ? data.matches : []);
        setPicks(Array.isArray(data.picks) ? data.picks : []);
        setClosed(Boolean(data.closed));
      } catch (e) {
        if (cancelled) return;
        setMatches([]);
        setPicks([]);
        setClosed(false);
        setError(e instanceof Error ? e.message : "No se pudo cargar tu cartón");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const pickMap = useMemo(() => {
    const m = new Map<number, Pick>();
    for (const p of picks) m.set(p.matchId, p.pick);
    return m;
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
              <div className="text-[11px] text-zinc-400">Mi Cartón</div>
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
          { label: "Mis Cartones", href: "/cartones", icon: <TicketIcon />, active: true },
          { label: "Comprar Cartones", href: "/carton", icon: <PlusIcon /> },
        ]}
        left={
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
            <div className="space-y-2 text-[13px] text-zinc-200">
              <Link
                href="/cartones"
                className="block rounded-2xl bg-lime-500/10 px-3 py-2 text-lime-200 ring-1 ring-lime-500/20"
              >
                Mis cartones
              </Link>
              <Link
                href="/carton"
                className="block rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800 hover:bg-zinc-900/60"
              >
                Comprar cartones
              </Link>
            </div>
          </div>
        }
        center={
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-extrabold">Mi cartón</div>
                  <div className="mt-1 text-[13px] text-zinc-400">purchaseId: {purchaseId || "-"}</div>
                </div>
                {closed ? (
                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] font-extrabold text-red-200 ring-1 ring-red-500/25">
                    CERRADO
                  </span>
                ) : (
                  <span className="rounded-full bg-lime-500/15 px-3 py-1 text-[10px] font-extrabold text-lime-200 ring-1 ring-lime-500/25">
                    ABIERTO
                  </span>
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => router.push("/cartones")}
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-900"
                >
                  ← Volver
                </button>
              </div>
            </div>

            <Card className="border-zinc-800 bg-zinc-950/40 p-6">
              {loading ? (
                <div className="text-[13px] text-zinc-400">Cargando...</div>
              ) : error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
                  {error}
                </div>
              ) : matches.length === 0 ? (
                <div className="text-[13px] text-zinc-400">No hay partidos.</div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => {
                    const pick = pickMap.get(m.index) ?? "1";
                    return (
                      <div
                        key={m.index}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3 text-[12px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-xl bg-zinc-900/50 ring-1 ring-zinc-800">
                              {imgUrl(m.local_logo_url) ? (
                                <Image
                                  src={imgUrl(m.local_logo_url)!}
                                  alt={m.local_name}
                                  width={28}
                                  height={28}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                "⚽"
                              )}
                            </div>
                            <div className="truncate font-semibold text-zinc-200">
                              {m.local_name} <span className="text-zinc-600">vs</span> {m.visit_name}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Pick</span>
                          <span className="grid h-9 w-12 place-items-center rounded-xl border border-zinc-700 bg-zinc-950/40 text-[12px] font-extrabold text-zinc-100">
                            {pick}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">TU CARTÓN</div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-[12px] text-zinc-400">Valor</div>
                <div className="text-[13px] font-semibold text-lime-300 tabular-nums">
                  ${formatMoneyARS(price)},00
                </div>
              </div>
              <div className="mt-3 text-[12px] text-zinc-500">
                {closed
                  ? "Este cartón está cerrado y no se puede modificar."
                  : "Este cartón todavía está abierto."}
              </div>
            </Card>
          </div>
        }
      />
    </RequireAuth>
  );
}

export default function CartonViewPage() {
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
      <CartonViewInner />
    </Suspense>
  );
}
