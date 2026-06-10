"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { DashboardShell } from "../components/DashboardShell";
import { RequireAuth } from "../components/RequireAuth";
import {
  BallIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TicketIcon,
  UserIcon,
} from "../components/icons";
import { useSessionUser } from "../lib/useSessionUser";
import { backendUrl } from "../lib/backend";

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function formatDateTime(v: string | Date | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PurchaseRow = {
  purchaseId: string;
  cartonId: number | null;
  cartonTitle: string | null;
  numberDate: number | null;
  kind: "classic15" | "mega30";
  price: number;
  createdAt: string;
  purchaseDeadline: string | null;
  stats: {
    matchesCount: number;
    picksCount: number;
    aciertos: number;
    empates: number;
    fallos: number;
    pendientes: number;
    status: "EN_JUEGO" | "FINALIZADO";
    outcome: "GANADOR" | "PERDEDOR" | null;
    backendFailed?: boolean;
  };
  picks?: { matchId: number; pick: "1" | "X" | "2" }[];
};

type BackendCartonMatch = {
  index: number;
  has_result?: boolean;
  result?: "local" | "draw" | "visit" | null;
};

function resultToPick(r: BackendCartonMatch["result"]): "1" | "X" | "2" | null {
  if (r === "local") return "1";
  if (r === "draw") return "X";
  if (r === "visit") return "2";
  return null;
}

function statusBadge(status: PurchaseRow["stats"]["status"], outcome: PurchaseRow["stats"]["outcome"]) {
  // Si backend falló, evitamos mostrar ganaste/perdiste.
  // (Esto pasa en prod cuando Cloudflare bloquea el fetch server-to-server.)
  if (status === "EN_JUEGO") {
    return (
      <span className="rounded-full bg-lime-500/15 px-3 py-1 text-[10px] font-extrabold text-lime-200 ring-1 ring-lime-500/25">
        EN JUEGO
      </span>
    );
  }
  if (outcome === "GANADOR") {
    return (
      <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-extrabold text-amber-200 ring-1 ring-amber-500/25">
        GANADOR 🏆
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] font-extrabold text-red-200 ring-1 ring-red-500/25">
      PERDEDOR
    </span>
  );
}

function progressColor(outcome: PurchaseRow["stats"]["outcome"]) {
  if (outcome === "GANADOR") return "bg-amber-400";
  if (outcome === "PERDEDOR") return "bg-red-500";
  return "bg-lime-400";
}

export default function MisCartonesPage() {
  const { user } = useSessionUser();

  const [filter, setFilter] = useState<"ALL" | "EN_JUEGO" | "GANADOR" | "PERDEDOR">("ALL");
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/carton/purchases", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { ok?: boolean; message?: string; data?: PurchaseRow[] };
        if (cancelled) return;
        if (json.ok === false) throw new Error(json.message ?? "No se pudieron cargar tus cartones");
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        if (cancelled) return;
        setRows([]);
        setError(e instanceof Error ? e.message : "No se pudieron cargar tus cartones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // En prod, Cloudflare puede bloquear el fetch server-to-server desde Vercel.
  // Entonces /api/carton/purchases marca backendFailed y no puede calcular outcome.
  // Acá recalculamos client-side consultando el backend directo (CORS: *).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const needsFix = rows.filter((r) => r.cartonId != null && r.stats.backendFailed);
        if (needsFix.length === 0) return;

        const updates = await Promise.all(
          needsFix.map(async (r) => {
            const cartonId = r.cartonId!;
            const res = await fetch(backendUrl(`/api/prodes/cartones/matchs?carton_id=${encodeURIComponent(String(cartonId))}`), {
              cache: "no-store",
            });
            const json = (await res.json()) as { data?: BackendCartonMatch[] };
            const data = Array.isArray(json.data) ? json.data : [];

            const pickMap = new Map<number, "1" | "X" | "2">();
            for (const pk of r.picks ?? []) pickMap.set(pk.matchId, pk.pick);

            let aciertos = 0;
            let empates = 0;
            let fallos = 0;
            let pendientes = 0;
            for (const m of data) {
              const matchId = Number(m.index) + 1;
              const hasResult = Boolean(m.has_result) || m.result != null;
              if (!hasResult) {
                pendientes++;
                continue;
              }
              const resultPick = resultToPick(m.result ?? null);
              const userPick = pickMap.get(matchId) ?? null;
              if (resultPick && userPick && resultPick === userPick) {
                if (resultPick === "X") empates++;
                else aciertos++;
              } else {
                fallos++;
              }
            }

            const matchesCount = r.stats.matchesCount || data.length;
            const baseCount = matchesCount > 0 ? matchesCount : aciertos + empates + fallos + pendientes;
            const requiredToWin = Math.max(1, Math.ceil(baseCount * 0.8));
            const totalCorrect = aciertos + empates;

            const isExpired = r.purchaseDeadline ? new Date(r.purchaseDeadline).getTime() <= Date.now() : false;
            const status: PurchaseRow["stats"]["status"] = pendientes > 0 && !isExpired ? "EN_JUEGO" : "FINALIZADO";
            const outcome: PurchaseRow["stats"]["outcome"] =
              status === "FINALIZADO" ? (totalCorrect >= requiredToWin ? "GANADOR" : "PERDEDOR") : null;

            return {
              purchaseId: r.purchaseId,
              stats: {
                ...r.stats,
                aciertos,
                empates,
                fallos,
                pendientes,
                status,
                outcome,
                backendFailed: false,
              },
            };
          }),
        );

        if (cancelled) return;
        setRows((prev) =>
          prev.map((r) => {
            const u = updates.find((x) => x.purchaseId === r.purchaseId);
            return u ? { ...r, stats: u.stats } : r;
          }),
        );
      } catch {
        // si falla el backend, dejamos lo que vino del server
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    if (filter === "EN_JUEGO") return rows.filter((r) => r.stats.status === "EN_JUEGO");
    if (filter === "GANADOR") return rows.filter((r) => r.stats.outcome === "GANADOR");
    return rows.filter((r) => r.stats.outcome === "PERDEDOR");
  }, [rows, filter]);

  const summary = useMemo(() => {
    const total = rows.length;
    const enJuego = rows.filter((r) => r.stats.status === "EN_JUEGO").length;
    const ganadores = rows.filter((r) => r.stats.outcome === "GANADOR").length;
    const perdedores = rows.filter((r) => r.stats.outcome === "PERDEDOR").length;
    return { total, enJuego, ganadores, perdedores };
  }, [rows]);

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
              <div className="text-[11px] text-zinc-400">Mis Cartones</div>
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
                $ {formatMoneyARS(user.balance)},00
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
          { label: "Comprar Cartones", href: "/carton", icon: <PlusIcon /> },
          { label: "Mis Cartones", href: "/cartones", icon: <TicketIcon />, active: true },
          { label: "Agregar saldo", href: "/wallet", icon: <PlusIcon /> },
        ]}
        left={
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Mis Apuestas", href: "/account" },
                  { label: "Comprar Cartones", href: "/carton" },
                  { label: "Mis Cartones", href: "/cartones", active: true },
                  { label: "Métodos de pago", href: "/wallet" },
                  { label: "Cerrar sesión", href: "/logout" },
                ].map((it) => (
                  <a
                    key={it.label}
                    href={it.href}
                    className={
                      (
                        "flex items-center justify-between rounded-2xl px-3 py-2 ring-1 transition-colors " +
                        (it.active
                          ? "bg-lime-500/10 text-lime-200 ring-lime-500/25"
                          : "bg-zinc-950/20 text-zinc-200 ring-zinc-800 hover:bg-zinc-900")
                      ).trim()
                    }
                  >
                    <span>{it.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        }
        center={
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                      ▦
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold">Mis Cartones</div>
                      <div className="mt-1 text-[13px] text-zinc-400">
                        Acá podés ver todos tus cartones y su estado en tiempo real.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {[
                      { k: "ALL", label: "Todos" },
                      { k: "EN_JUEGO", label: "En juego" },
                      { k: "GANADOR", label: "Ganadores" },
                      { k: "PERDEDOR", label: "Perdedores" },
                    ].map((t) => {
                      const active = filter === (t.k as typeof filter);
                      const count =
                        t.k === "ALL"
                          ? summary.total
                          : t.k === "EN_JUEGO"
                            ? summary.enJuego
                            : t.k === "GANADOR"
                              ? summary.ganadores
                              : summary.perdedores;
                      return (
                        <button
                          key={t.k}
                          type="button"
                          onClick={() => setFilter(t.k as typeof filter)}
                          className={
                            (
                              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-[12px] font-semibold transition-colors " +
                              (active
                                ? "border-lime-500/25 bg-lime-500/15 text-lime-100"
                                : "border-zinc-800 bg-zinc-950/30 text-zinc-200 hover:bg-zinc-900")
                            ).trim()
                          }
                        >
                          {t.label}
                          <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px] text-zinc-100 ring-1 ring-zinc-800">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden sm:block">
                  <Link
                    href="/carton"
                    className="inline-flex items-center justify-center rounded-2xl bg-lime-500/80 px-4 py-3 text-[13px] font-extrabold text-zinc-950 hover:bg-lime-500"
                  >
                    Comprar cartón
                  </Link>
                </div>
              </div>
            </div>

            {loading ? (
              <Card className="border-zinc-800 bg-zinc-950/40 p-5">
                <div className="text-[13px] text-zinc-400">Cargando tus cartones...</div>
              </Card>
            ) : error ? (
              <Card className="border-amber-500/25 bg-amber-500/10 p-5">
                <div className="text-[13px] text-amber-200">{error}</div>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="border-zinc-800 bg-zinc-950/40 p-5">
                <div className="text-[13px] text-zinc-300">Aún no tenés cartones comprados.</div>
                <div className="mt-3">
                  <Link
                    href="/carton"
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-2 text-[13px] font-semibold text-lime-200 hover:bg-zinc-900"
                  >
                    Ver cartones disponibles
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {filtered.map((p) => {
                  const correct = p.stats.aciertos + p.stats.empates;
                  const pct = p.stats.matchesCount > 0 ? Math.round((correct / p.stats.matchesCount) * 100) : 0;
                    return (
                     <Card
                       key={p.purchaseId}
                       role="link"
                       tabIndex={0}
                       onClick={() => {
                          window.location.href = `/cartones/${encodeURIComponent(p.purchaseId)}`;
                       }}
                       onKeyDown={(e) => {
                         if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                            window.location.href = `/cartones/${encodeURIComponent(p.purchaseId)}`;
                         }
                       }}
                       className="cursor-pointer border-zinc-800 bg-gradient-to-b from-zinc-900/35 to-zinc-950/35 p-5 hover:bg-zinc-900/60"
                     >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-[16px] font-extrabold text-zinc-50">
                              Cartón {p.cartonId != null ? `#${String(p.cartonId).padStart(4, "0")}` : p.purchaseId}
                            </div>
                            {statusBadge(p.stats.status, p.stats.outcome)}
                          </div>

                          <div className="mt-2 grid gap-2 text-[12px] text-zinc-400 sm:grid-cols-3">
                            <div>Creado: {formatDateTime(p.createdAt)}</div>
                            <div>{p.stats.matchesCount || 15} partidos</div>
                            <div>Valor: $ {formatMoneyARS(p.price)},00</div>
                          </div>
                        </div>

                        <div className="grid flex-none grid-cols-3 gap-3 rounded-3xl border border-zinc-800 bg-black/10 p-4 text-center">
                          <div>
                            <div className="text-2xl font-extrabold text-lime-300 tabular-nums">{p.stats.aciertos}</div>
                            <div className="text-[11px] text-zinc-500">Aciertos</div>
                          </div>
                          <div>
                            <div className="text-2xl font-extrabold text-zinc-200 tabular-nums">{p.stats.empates}</div>
                            <div className="text-[11px] text-zinc-500">Empates</div>
                          </div>
                          <div>
                            <div className="text-2xl font-extrabold text-red-300 tabular-nums">{p.stats.fallos}</div>
                            <div className="text-[11px] text-zinc-500">Fallos</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
                          <div
                            className={
                              ("h-full " + progressColor(p.stats.outcome)).trim()
                            }
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        <div className="mt-2 flex flex-col justify-between gap-2 text-[12px] text-zinc-500 sm:flex-row">
                          <div>
                            {p.purchaseDeadline ? `Cierra el ${formatDateTime(p.purchaseDeadline)}` : ""}
                          </div>
                          <div className="font-semibold text-zinc-400">{pct}% de aciertos</div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                        <Link
                          href={`/cartones/${encodeURIComponent(p.purchaseId)}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-2 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver mi cartón
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">RESUMEN GENERAL</div>
              <div className="mt-4 space-y-3 text-[12px] text-zinc-200">
                {[ 
                  { k: "Total de cartones", v: summary.total },
                  { k: "En juego", v: summary.enJuego },
                  { k: "Ganadores", v: summary.ganadores },
                  { k: "Perdedores", v: summary.perdedores },
                ].map((x) => (
                  <div key={x.k} className="flex items-center justify-between">
                    <div className="text-zinc-400">{x.k}</div>
                    <div className="font-extrabold tabular-nums">{x.v}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-br from-lime-500/10 to-zinc-900/30 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">¿CÓMO FUNCIONA?</div>
              <div className="mt-3 text-[12px] text-zinc-500">
                Completá tus pronósticos, seguí los resultados y sumá aciertos para ganar premios.
              </div>
              <Link
                href="/carton"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-lime-500/20 px-3 py-2 text-[13px] font-semibold text-lime-200 ring-1 ring-lime-500/30 hover:bg-lime-500/25"
              >
                Ver cartones
              </Link>
            </Card>
          </div>
        }
      />
    </RequireAuth>
  );
}
