"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "./components/Card";
import { DashboardShell } from "./components/DashboardShell";
import { RequireAuth } from "./components/RequireAuth";
import {
  BallIcon,
  ChevronRightIcon,
  ChartIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TennisIcon,
  BasketballIcon,
  HockeyIcon,
  StarIcon,
  TrophyIcon,
  UserIcon,
} from "./components/icons";
import { settleExpiredMatches } from "./lib/localdb";
import { useSessionUser } from "./lib/useSessionUser";
import { backendUrl } from "./lib/backend";

type BackendCarton = {
  id?: number;
  title?: string | null;
  number_date: number;
  type: "classic1" | "classic5" | "1" | "5" | string;
  price_ars: number;
  purchase_deadline?: string | null;
  prize_first?: string | number | null;
  prize_second?: string | number | null;
  prize_third?: string | number | null;
  matches?: BackendCartonMatch[];
};

type BackendCartonMatch = {
  local_name?: string;
  visit_name?: string;
  category?: string;
  timetoplay?: string;
  local_logo_url?: string;
  visit_logo_url?: string;
};

type BackendTeam = { name?: string };

type BackendMatch = {
  // /api/prodes/cartones/matchs
  local_name?: string;
  visit_name?: string;
  local_logo_url?: string;
  visit_logo_url?: string;
  category?: string;
  timetoplay?: string | null;
  has_result?: boolean;
  is_closed?: boolean;
  result?: unknown;

  // compat/fallbacks (otros endpoints)
  local?: BackendTeam;
  visit?: BackendTeam;
  category_obj?: { name?: string };
  localTeam?: string;
  visitante?: string;
  home?: string;
  away?: string;
  date?: string;
  hour?: string;
  starts_at?: string;
};

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
};

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function cartonTitle(type: string) {
  const t = String(type);
  if (t === "classic1" || t === "1") return "Cartón PRODE Clásico";
  if (t === "classic5" || t === "5") return "Cartón Mega";
  return "Cartón";
}

function cartonAccent(type: string) {
  const t = String(type);
  if (t === "classic1" || t === "1") return "from-lime-500/15 to-zinc-950/40";
  if (t === "classic5" || t === "5") return "from-fuchsia-500/15 to-zinc-950/40";
  return "from-blue-500/15 to-zinc-950/40";
}

function effectiveCartonMatchesCount(c: BackendCarton) {
  // Respetar a rajatabla lo que viene: si hay 0 => 0, si hay 1 => 1, etc.
  if (Array.isArray(c.matches)) return c.matches.length;
  return 0;
}

function parsePrize(v: BackendCarton["prize_first"]) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatDeadline(v?: string | null) {
  if (!v) return null;
  // intentamos mostrar algo legible sin depender de libs
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(deadline?: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "Cerrado";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin - days * 60 * 24) / 60);
  const mins = totalMin % 60;
  return `${days}d ${hours}h ${mins}m`;
}

function imgUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  // la API suele devolver /storage/... (path absoluto)
  return `https://admin.vedo.com.ar${path}`;
}

function teamAbbr(team: string) {
  return team
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function parseStartDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function matchStatusLabel(start: Date | null) {
  if (!start) return null;
  const ms = start.getTime() - Date.now();
  if (ms > 0) return "PRÓXIMO";
  return "EN JUEGO";
}

function formatWhenShort(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(kind: PurchaseRow["kind"]) {
  if (kind === "mega30") return "Cartón Mega";
  return "Cartón Clásico";
}

export default function HomePage() {
  const { user, refresh } = useSessionUser();

  // Defaults de “accesibilidad práctica” (adultos mayores):
  // - Texto un poco más grande
  // - Botones con mayor área táctil
  // - Focus visible
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

  // Re-render “en tiempo real” para que el filtrado por deadline se actualice solo.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const [cartones, setCartones] = useState<BackendCarton[]>([]);
  const [cartonesLoaded, setCartonesLoaded] = useState(false);
  const [cartonesError, setCartonesError] = useState<string | null>(null);
  const [matchesState, setMatchesState] = useState<{
    loading: boolean;
    error: string | null;
    data: BackendMatch[];
  }>({ loading: false, error: null, data: [] });

  const [currentPurchaseState, setCurrentPurchaseState] = useState<{
    loading: boolean;
    error: string | null;
    row: PurchaseRow | null;
  }>({ loading: false, error: null, row: null });

  useEffect(() => {
    settleExpiredMatches();
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setCurrentPurchaseState({ loading: true, error: null, row: null });
        const res = await fetch("/api/carton/purchases?limit=1", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { ok?: boolean; message?: string; data?: PurchaseRow[] };
        if (cancelled) return;
        if (json.ok === false) throw new Error(json.message ?? "No se pudo cargar tu cartón actual");
        const row = Array.isArray(json.data) ? (json.data[0] ?? null) : null;
        setCurrentPurchaseState({ loading: false, error: null, row });
      } catch (e) {
        if (cancelled) return;
        setCurrentPurchaseState({
          loading: false,
          error: e instanceof Error ? e.message : "No se pudo cargar tu cartón actual",
          row: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(backendUrl("/api/prode/cartones"), { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; message?: string; data?: BackendCarton[] };
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setCartones([]);
          setCartonesError(json.message ?? "No se pudieron cargar los cartones");
          return;
        }
        setCartones(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (cancelled) return;
        setCartones([]);
        setCartonesError("No se pudieron cargar los cartones");
      } finally {
        if (!cancelled) setCartonesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCartones = useMemo(() => {
    const now = nowTick; // dependemos del tick
    return cartones.filter((c) => {
      if (!c.purchase_deadline) return true;
      const d = new Date(String(c.purchase_deadline));
      if (Number.isNaN(d.getTime())) return true;
      return d.getTime() > now;
    });
  }, [cartones, nowTick]);

  const featuredCartones = useMemo(() => openCartones.slice(0, 3), [openCartones]);
  const featuredCartonesFixed = useMemo(() => {
    // Layout 1:1: siempre 3 columnas. Los faltantes van “bloqueados”.
    const arr = [...featuredCartones];
    while (arr.length < 3) arr.push(null as unknown as BackendCarton);
    return arr.slice(0, 3);
  }, [featuredCartones]);
  const featuredNumberDate = featuredCartones[0]?.number_date;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!featuredNumberDate) {
        setMatchesState({ loading: false, error: null, data: [] });
        return;
      }
      try {
        setMatchesState({ loading: true, error: null, data: [] });
        // Importante: en prod evitamos el proxy /api/* porque Cloudflare puede bloquear requests server-side.
        // Pegamos directo al backend (CORS permite *).
        const res = await fetch(
          backendUrl(
            `/api/prodes/cartones/matchs?number_date=${encodeURIComponent(String(featuredNumberDate))}&is_closed=false`,
          ),
          { cache: "no-store" },
        );
        const json = (await res.json()) as { ok?: boolean; message?: string; data?: BackendMatch[] };
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setMatchesState({
            loading: false,
            error: json.message ?? "No se pudieron cargar los partidos",
            data: [],
          });
          return;
        }
        const data = Array.isArray(json.data) ? json.data : [];
        if (data.length === 0) {
          setMatchesState({
            loading: false,
            error:
              "No hay partidos destacados (API /api/prode/matchs devolvió una lista vacía).",
            data: [],
          });
          return;
        }
        setMatchesState({ loading: false, error: null, data });
      } catch (e) {
        if (cancelled) return;
        setMatchesState({
          loading: false,
          error: e instanceof Error ? e.message : "No se pudieron cargar los partidos",
          data: [],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featuredNumberDate]);

  return (
    <RequireAuth>
      {!user ? (
        <div className="min-h-dvh bg-zinc-950 text-zinc-50">
          <div className="mx-auto max-w-[1400px] px-4 py-10">
            <Card className="border-zinc-800 bg-zinc-950/40">
              <div className="text-[13px] text-zinc-300">Cargando sesión...</div>
            </Card>
          </div>
        </div>
      ) : (
      <DashboardShell
        brand={
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800">
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
              <div className="text-lg font-extrabold tracking-tight">PRODE</div>
              <div className="text-[12px] font-semibold text-zinc-400">Inicio</div>
            </div>
          </div>
        }
        topNav={
          <div className="flex items-center gap-6 text-[14px]">
            <Link
              className={
                ("border-b-2 border-lime-400 pb-2 font-extrabold text-lime-200 hover:text-lime-100 " +
                  focusRing).trim()
              }
              href="/"
            >
              Inicio
            </Link>

            <Link className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#envivo">
              En Vivo
              <span className="ml-2 rounded-md bg-red-500/25 px-2 py-0.5 text-[10px] font-extrabold text-red-200 ring-1 ring-red-500/30">
                LIVE
              </span>
            </Link>
            <Link className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#proximos">
              Próximos
            </Link>
            <Link className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/account">
              Mis Apuestas
            </Link>
            <Link className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/carton">
              Comprar Cartones
            </Link>
            <Link className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/cartones">
              Mis Cartones
            </Link>
            <a className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="#stats">
              Estadísticas
            </a>
            <a className={("pb-2 text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="#promo">
              Promociones
            </a>
          </div>
        }
        topRight={
          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 sm:block">
              <div className="text-[12px] font-semibold text-zinc-400">Saldo disponible</div>
              <div className="text-[15px] font-extrabold text-lime-300 tabular-nums">
                $ {formatMoneyARS(user.balance)},00
              </div>
            </div>
            <Link
              href="/wallet"
              className={
                (
                  "inline-flex min-h-[48px] w-12 items-center justify-center gap-2 rounded-2xl bg-lime-500/15 px-0 text-lime-200 ring-1 ring-lime-500/25 hover:bg-lime-500/20 sm:w-auto sm:px-4 " +
                  focusRing
                ).trim()
              }
              title="Añadir saldo"
              aria-label="Añadir saldo"
            >
              <PlusIcon />
              <span className="hidden text-[15px] font-extrabold sm:inline">Añadir saldo</span>
            </Link>
            <Link
              href="/account"
              className={
                (
                  "grid h-12 w-12 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900 " +
                  focusRing
                ).trim()
              }
              title="Cuenta"
              aria-label="Cuenta"
            >
              <UserIcon />
            </Link>
          </div>
        }
        navItems={[
          { label: "Inicio", href: "/", icon: <HomeIcon />, active: true },
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
          { label: "Tenis", href: "/#tenis", icon: <TennisIcon /> },
          { label: "Básquet", href: "/#basquet", icon: <BasketballIcon /> },
          { label: "Hockey", href: "/#hockey", icon: <HockeyIcon /> },
          { label: "Apuestas Especiales", href: "/#especiales", icon: <StarIcon /> },
          { label: "Ligas y Torneos", href: "/#ligas", icon: <TrophyIcon /> },
        ]}
        left={
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">MIS JUEGOS</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Mis Apuestas", href: "/account" },
                  { label: "Mis Cartones", href: "/cartones" },
                  { label: "Historial", href: "/account" },
                  { label: "Mi Perfil", href: "/account" },
                ].map((it) => (
                  <Link
                    key={it.label}
                    href={it.href}
                    className="flex items-center justify-between rounded-2xl bg-zinc-950/20 px-3 py-2 text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-900"
                  >
                    <span>{it.label}</span>
                    <span className="text-zinc-500">›</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">LIGAS POPULARES</div>
              <div className="mt-2 space-y-2 text-[13px] text-zinc-200">
                {[
                  { label: "Liga Profesional", sub: "Argentina", flag: "🇦🇷" },
                  { label: "Copa de la Liga", sub: "Argentina", flag: "🇦🇷" },
                  { label: "La Liga", sub: "España", flag: "🇪🇸" },
                  { label: "Premier League", sub: "Inglaterra", flag: "🏴" },
                  { label: "Champions League", sub: "Europa", flag: "⚽" },
                ].map((l) => (
                  <div
                    key={l.label}
                    className="flex items-center gap-3 rounded-2xl bg-zinc-950/20 px-3 py-2 ring-1 ring-zinc-800"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-zinc-900/60">
                      {l.flag}
                    </div>
                    <div className="leading-tight">
                      <div className="text-[13px] font-semibold text-zinc-200">{l.label}</div>
                      <div className="text-[11px] text-zinc-500">{l.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
        center={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5 sm:p-6 shadow-[0_0_0_1px_rgba(24,24,27,0.55),0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[20px] font-extrabold tracking-tight sm:text-[22px]">
                    CARTONES MÁS COMPRADOS
                  </div>
                  <div className="mt-2 text-[14px] leading-relaxed text-zinc-400">
                    Jugá, acertá los resultados y ganá increíbles premios.
                  </div>
                </div>
                <Link
                  href="/carton"
                  className={
                    (
                      "inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-5 py-3 text-[15px] font-extrabold text-lime-200 hover:bg-zinc-900 sm:w-auto " +
                      focusRing
                    ).trim()
                  }
                >
                  Ver todos los cartones <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </Card>

            <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
              {cartonesLoaded && cartonesError ? (
                <Card className="lg:col-span-3 border-amber-500/25 bg-amber-500/10 px-4 py-3">
                  <div className="text-[13px] text-amber-200">{cartonesError}</div>
                </Card>
              ) : null}

              {cartonesLoaded && !cartonesError && featuredCartones.length === 0 ? (
                <Card className="lg:col-span-3 border-amber-500/25 bg-amber-500/10 px-4 py-3">
                  <div className="text-[13px] text-amber-200">
                    No hay cartones disponibles (API /api/prode/cartones devolvió una lista vacía).
                  </div>
                </Card>
              ) : null}

              {featuredCartonesFixed.map((c, idx) => {
                const isBlocked = !c || typeof c !== "object" || (c as BackendCarton).number_date == null;
                if (isBlocked) {
                  const label = idx === 1 ? "Cartón Experto" : idx === 2 ? "Cartón Mega" : "Cartón";
                  const accent = idx === 1 ? "from-sky-500/15 to-zinc-950/40" : "from-fuchsia-500/15 to-zinc-950/40";
                  return (
                    <Card
                      key={`blocked-${idx}`}
                      className={
                        (
                          "relative border-zinc-800 bg-gradient-to-b p-0 overflow-hidden opacity-70 " +
                          accent
                        ).trim()
                      }
                    >
                      <div className="absolute inset-0 bg-zinc-950/30" />
                      <div className="relative p-5 sm:p-6">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-900/50 px-3 py-1.5 text-[12px] font-extrabold text-zinc-200 ring-1 ring-zinc-800">
                          🔒 BLOQUEADO
                        </div>
                        <div className="mt-4 text-[18px] font-extrabold text-zinc-200">{label}</div>
                        <div className="mt-2 text-[14px] leading-relaxed text-zinc-400">Disponible próximamente</div>

                        <div className="mt-5 grid gap-3 text-[14px] text-zinc-300">
                          <div className="flex items-center justify-between">
                            <span>Partidos</span>
                            <span className="font-extrabold text-zinc-200">—</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Opciones por partido</span>
                            <span className="font-extrabold text-zinc-200">1 · X · 2</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Deporte</span>
                            <span className="font-extrabold text-zinc-200">Fútbol</span>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-zinc-800 pt-5">
                          <div className="text-[11px] font-semibold tracking-wide text-zinc-500">
                            PREMIOS
                          </div>
                          <div className="mt-4 space-y-3 text-[15px] text-zinc-300">
                            <div className="flex items-center justify-between">
                              <span>🥇 1°</span>
                              <span className="font-extrabold">—</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>🥈 2°</span>
                              <span className="font-semibold">—</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>🥉 3°</span>
                              <span className="font-semibold">—</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_1fr] border-t border-zinc-800">
                        <div className="px-5 py-4 text-[15px] font-extrabold text-zinc-300 tabular-nums">
                          —
                        </div>
                        <button
                          type="button"
                          disabled
                          className="flex min-h-[48px] items-center justify-center gap-2 bg-zinc-900/50 px-5 py-4 text-[15px] font-extrabold text-zinc-500"
                        >
                          🛒 Comprar
                        </button>
                      </div>
                    </Card>
                  );
                }

                return (
                <Card
                  key={`${c.type}-${c.number_date}-${idx}`}
                  className={
                    (
                      "border-zinc-800 bg-gradient-to-b p-0 overflow-hidden shadow-[0_0_0_1px_rgba(24,24,27,0.5),0_30px_80px_rgba(0,0,0,0.55)] " +
                      cartonAccent(c.type)
                    ).trim()
                  }
                >
                  <div className="p-5 sm:p-6">
                    {idx === 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-lime-500/15 px-3 py-1.5 text-[12px] font-extrabold text-lime-200 ring-1 ring-lime-500/25">
                        🔥 MÁS POPULAR
                      </div>
                    ) : null}

                    <div className="mt-4 text-[18px] font-extrabold text-zinc-50 sm:text-[20px]">
                      {c.title ? c.title : cartonTitle(c.type)}
                    </div>
                    <div className="mt-2 text-[14px] font-semibold text-zinc-300">Fecha {c.number_date}</div>

                    {c.purchase_deadline ? (
                      <div className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                        Cierra: {formatDeadline(c.purchase_deadline) ?? c.purchase_deadline}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3 text-[15px] text-zinc-200">
                      <div className="flex items-center justify-between">
                        <span>Partidos</span>
                        <span className="font-extrabold text-zinc-50">
                          {effectiveCartonMatchesCount(c)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Opciones por partido</span>
                        <span className="font-extrabold text-zinc-50">1 · X · 2</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Deporte</span>
                        <span className="font-extrabold text-zinc-50">Fútbol</span>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-zinc-800 pt-5">
                      <div className="text-[12px] font-semibold tracking-wide text-zinc-300">
                        PREMIOS
                      </div>
                      <div className="mt-4 space-y-3 text-[15px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-200">🥇 1°</span>
                          <span className="font-extrabold text-amber-200 tabular-nums">
                            $ {formatMoneyARS(parsePrize(c.prize_first))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-200">🥈 2°</span>
                          <span className="font-extrabold text-zinc-50 tabular-nums">
                            $ {formatMoneyARS(parsePrize(c.prize_second))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-200">🥉 3°</span>
                          <span className="font-extrabold text-zinc-50 tabular-nums">
                            $ {formatMoneyARS(parsePrize(c.prize_third))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(c.matches) && c.matches.length ? (
                      <div className="mt-6 border-t border-zinc-800 pt-4">
                        <div className="text-[12px] font-semibold tracking-wide text-zinc-300">
                          PARTIDO DESTACADO
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                          <div className="flex flex-none items-center gap-2">
                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-950/50 ring-1 ring-zinc-800">
                              {imgUrl(c.matches[0]?.local_logo_url) ? (
                                <Image
                                  src={imgUrl(c.matches[0]!.local_logo_url)!}
                                  alt={c.matches[0]?.local_name ?? "Local"}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <span className="text-[12px] font-extrabold text-zinc-300">
                                  {teamAbbr(c.matches[0]?.local_name ?? "-")}
                                </span>
                              )}
                            </div>
                            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-950/50 ring-1 ring-zinc-800">
                              {imgUrl(c.matches[0]?.visit_logo_url) ? (
                                <Image
                                  src={imgUrl(c.matches[0]!.visit_logo_url)!}
                                  alt={c.matches[0]?.visit_name ?? "Visitante"}
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <span className="text-[12px] font-extrabold text-zinc-300">
                                  {teamAbbr(c.matches[0]?.visit_name ?? "-")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-extrabold leading-snug text-zinc-100">
                              <span className="block truncate sm:inline">
                                {c.matches[0]?.local_name ?? "-"}
                              </span>
                              <span className="hidden sm:inline"> <span className="text-zinc-500">vs</span> </span>
                              <span className="block truncate sm:inline">
                                {c.matches[0]?.visit_name ?? "-"}
                              </span>
                              <span className="mt-0.5 block text-[12px] font-semibold text-zinc-400 sm:hidden">
                                vs
                              </span>
                            </div>
                            <div className="mt-1 text-[13px] leading-snug text-zinc-400">
                              {c.matches[0]?.category ?? ""}
                              {c.matches[0]?.timetoplay ? ` · ${c.matches[0]?.timetoplay}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-[1fr_1fr] border-t border-zinc-800">
                    <div className="px-5 py-4 text-[15px] font-extrabold text-zinc-50 tabular-nums">
                      $ {formatMoneyARS(c.price_ars)},00
                    </div>
                    <Link
                      href="/carton"
                      className={
                        (
                          "flex min-h-[52px] items-center justify-center gap-2 bg-lime-500/80 px-5 py-4 text-[16px] font-extrabold text-zinc-950 hover:bg-lime-500 " +
                          focusRing
                        ).trim()
                      }
                      aria-label="Comprar cartón"
                    >
                      🛒 Comprar
                    </Link>
                  </div>
                </Card>
                );
              })}
            </div>

            <section id="envivo" className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[15px] font-extrabold tracking-wide text-zinc-200">
                  🔥 PARTIDOS DESTACADOS
                </div>
                <Link
                  className={("text-[14px] font-semibold text-lime-300 hover:underline " + focusRing).trim()}
                  href="/bet"
                >
                  Ver todos
                </Link>
              </div>

              {matchesState.loading ? (
                <Card className="border-zinc-800 bg-zinc-950/40 p-5">
                  <div className="text-[13px] text-zinc-400">Cargando partidos...</div>
                </Card>
              ) : matchesState.error ? (
                <Card className="border-amber-500/25 bg-amber-500/10 p-5">
                  <div className="text-[13px] text-amber-200">{matchesState.error}</div>
                </Card>
              ) : (
                <div className="relative">
                  <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
                    {matchesState.data.slice(0, 6).map((m, idx) => {
                      const a =
                        (m.local?.name ?? m.local_name ?? m.home ?? m.localTeam ?? "-") as string;
                      const b =
                        (m.visit?.name ?? m.visit_name ?? m.away ?? m.visitante ?? "-") as string;
                      const when =
                        (m.timetoplay ??
                          m.starts_at ??
                          (m.date && m.hour ? `${m.date} - ${m.hour}` : m.date) ??
                          "") as string;

                      const start = parseStartDate(when);
                      const status = matchStatusLabel(start);

                      return (
                        <Card
                          key={`${a}-${b}-${idx}`}
                          className="min-w-[320px] snap-start border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5"
                        >
                          <div className="flex items-center justify-between gap-3 text-[12px] text-zinc-300">
                            {status ? (
                              <span
                                className={
                                  (
                                    "rounded-md px-2 py-1 text-[10px] font-extrabold tracking-wide ring-1 " +
                                    (status === "EN JUEGO"
                                      ? "bg-lime-500/15 text-lime-200 ring-lime-500/25"
                                      : "bg-blue-500/15 text-blue-200 ring-blue-500/25")
                                  ).trim()
                                }
                              >
                                {status}
                              </span>
                            ) : (
                              <span />
                            )}
                            <span className="truncate">
                              {(typeof m.category === "string" && m.category ? `${m.category} · ` : "")}
                              {when ? formatWhenShort(when) : ""}
                            </span>
                          </div>

                          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center">
                            <div className="flex min-w-0 flex-col items-center gap-2">
                              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {imgUrl(m.local_logo_url) ? (
                                  <Image
                                    src={imgUrl(m.local_logo_url)!}
                                    alt={a}
                                    width={56}
                                    height={56}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[12px] font-extrabold text-zinc-200">
                                    {teamAbbr(a)}
                                  </span>
                                )}
                              </div>
                              <div className="w-full truncate text-center text-[14px] font-semibold text-zinc-200">
                                {a}
                              </div>
                            </div>

                            <div className="text-center text-[28px] font-extrabold tabular-nums text-zinc-50">
                              <span>0</span>
                              <span className="mx-2 text-zinc-500">-</span>
                              <span>0</span>
                            </div>

                            <div className="flex min-w-0 flex-col items-center gap-2">
                              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {imgUrl(m.visit_logo_url) ? (
                                  <Image
                                    src={imgUrl(m.visit_logo_url)!}
                                    alt={b}
                                    width={56}
                                    height={56}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[12px] font-extrabold text-zinc-200">
                                    {teamAbbr(b)}
                                  </span>
                                )}
                              </div>
                              <div className="w-full truncate text-center text-[14px] font-semibold text-zinc-200">
                                {b}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-3 gap-3">
                            {[
                              { k: "1", v: "1.85" },
                              { k: "X", v: "2.60" },
                              { k: "2", v: "3.70" },
                            ].map((o) => (
                              <div
                                key={o.k}
                                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-center"
                              >
                                <div className="text-[12px] font-semibold text-zinc-400">{o.k}</div>
                                <div className="mt-1 text-[16px] font-extrabold tabular-nums text-lime-300">
                                  {o.v}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-950 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-950 to-transparent" />
                </div>
              )}
            </section>

            {/* Footer features (visual) */}
            <div className="grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/30 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { t: "ANÁLISIS INTELIGENTE", d: "Modelos predictivos avanzados" },
                { t: "ESTADÍSTICAS EN VIVO", d: "Datos al instante" },
                { t: "APUESTAS SEGURAS", d: "Juego responsable" },
                { t: "PAGOS 100% SEGUROS", d: "Con Mercado Pago" },
              ].map((x) => (
                <div key={x.t} className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                    <ChartIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[14px] font-extrabold text-zinc-200">{x.t}</div>
                    <div className="mt-1 text-[13px] leading-relaxed text-zinc-400">{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        right={
          <div className="space-y-4 pb-6 lg:pb-8">
            <Card className="border-zinc-800 bg-gradient-to-br from-lime-500/10 to-zinc-900/30 p-5">
              <div className="text-[12px] font-semibold tracking-wide text-zinc-200">
                SALDO DISPONIBLE
              </div>
              <div className="mt-2 text-[28px] font-extrabold leading-none text-lime-300 tabular-nums">
                $ {formatMoneyARS(user.balance)},00
              </div>
              <Link
                href="/wallet"
                className={
                  (
                    "mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-lime-500/80 px-4 py-3 text-[16px] font-extrabold text-zinc-950 hover:bg-lime-500 " +
                    focusRing
                  ).trim()
                }
              >
                Añadir saldo
              </Link>
              <div className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                Cargá crédito para comprar cartones y apostar.
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[15px] font-extrabold text-zinc-200">TU CARTÓN ACTUAL</div>

              {currentPurchaseState.loading ? (
                <div className="mt-4 text-[14px] text-zinc-300">Cargando tu cartón...</div>
              ) : currentPurchaseState.error ? (
                <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-amber-200">
                  {currentPurchaseState.error}
                </div>
              ) : !currentPurchaseState.row ? (
                <>
                  <div className="mt-4 text-[14px] leading-relaxed text-zinc-300">
                    Todavía no tenés un cartón activo.
                  </div>
                  <Link
                    href="/carton"
                    className={
                      ("mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-lime-500/80 px-4 py-3 text-[16px] font-extrabold text-zinc-950 hover:bg-lime-500 " +
                        focusRing).trim()
                    }
                  >
                    Comprar un cartón
                  </Link>
                </>
              ) : (
                <>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                      ▦
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-zinc-300">
                        {currentPurchaseState.row.cartonTitle ?? kindLabel(currentPurchaseState.row.kind)}
                      </div>
                      <div className="mt-1 text-[28px] font-extrabold leading-none text-zinc-50">
                        {currentPurchaseState.row.stats.matchesCount || "—"} PARTIDOS
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                        <span
                          className={
                            (
                              "rounded-full px-3 py-1 font-extrabold ring-1 " +
                              (currentPurchaseState.row.stats.status === "EN_JUEGO"
                                ? "bg-lime-500/15 text-lime-200 ring-lime-500/25"
                                : "bg-blue-500/15 text-blue-200 ring-blue-500/25")
                            ).trim()
                          }
                        >
                          {currentPurchaseState.row.stats.status === "EN_JUEGO" ? "EN JUEGO" : "FINALIZADO"}
                        </span>

                        {currentPurchaseState.row.stats.outcome ? (
                          <span
                            className={
                              (
                                "rounded-full px-3 py-1 font-extrabold ring-1 " +
                                (currentPurchaseState.row.stats.outcome === "GANADOR"
                                  ? "bg-amber-500/15 text-amber-200 ring-amber-500/25"
                                  : "bg-red-500/15 text-red-200 ring-red-500/25")
                              ).trim()
                            }
                          >
                            {currentPurchaseState.row.stats.outcome === "GANADOR" ? "GANADOR" : "PERDEDOR"}
                          </span>
                        ) : null}

                        {currentPurchaseState.row.purchaseDeadline ? (
                          <span className="text-zinc-400">
                            Cierra en {formatCountdown(currentPurchaseState.row.purchaseDeadline) ?? "—"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-5 text-[14px]">
                    <div>
                      <div className="text-zinc-400">Pendientes</div>
                      <div className="mt-1 font-extrabold text-lime-300 tabular-nums">
                        {currentPurchaseState.row.stats.pendientes}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-400">Aciertos</div>
                      <div className="mt-1 font-extrabold text-lime-300 tabular-nums">
                        {currentPurchaseState.row.stats.aciertos + currentPurchaseState.row.stats.empates}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/cartones/${encodeURIComponent(currentPurchaseState.row.purchaseId)}`}
                    className={
                      ("mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-lime-500/80 px-4 py-3 text-[16px] font-extrabold text-zinc-950 hover:bg-lime-500 " +
                        focusRing).trim()
                    }
                  >
                    Ver mi cartón
                  </Link>
                </>
              )}
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[15px] font-extrabold text-zinc-200">PRÓXIMOS CIERRES</div>
              <div className="mt-4 space-y-3">
                {featuredCartones.length ? (
                  featuredCartones.map((c) => (
                    <div
                      key={`${c.type}-${c.number_date}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-4"
                    >
                      <div>
                        <div className="text-[15px] font-extrabold text-zinc-100">
                          {cartonTitle(c.type)}
                        </div>
                        <div className="mt-1 text-[14px] font-semibold text-lime-300">
                          {formatCountdown(c.purchase_deadline)
                            ? formatCountdown(c.purchase_deadline)
                            : `Fecha ${c.number_date}`}
                        </div>
                      </div>
                      <Link
                        href="/carton"
                        className={
                          ("min-h-[48px] rounded-2xl bg-lime-500/15 px-5 py-3 text-[15px] font-extrabold text-lime-200 ring-1 ring-lime-500/25 hover:bg-lime-500/20 " +
                            focusRing).trim()
                        }
                      >
                        Comprar
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-[14px] leading-relaxed text-zinc-400">
                    Sin cartones (la API no devolvió data).
                  </div>
                )}
              </div>
              <Link
                href="/carton"
                className={
                  ("mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-[15px] font-extrabold text-lime-200 hover:bg-zinc-900 " +
                    focusRing).trim()
                }
              >
                Ver todos los cartones
              </Link>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-br from-lime-500/10 to-zinc-900/30 p-5">
              <div className="text-xs font-semibold tracking-wide text-zinc-200">
                MEJORÁ TUS GANANCIAS
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-lime-300">
                BOOST ⚡
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-200">Cuotas mejoradas todos los días</p>
              <Link
                href="/bet"
                className={
                  ("mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-lime-500/20 px-4 py-3 text-[15px] font-extrabold text-lime-200 ring-1 ring-lime-500/30 hover:bg-lime-500/25 " +
                    focusRing).trim()
                }
              >
                Ver boosters
              </Link>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[15px] font-extrabold text-zinc-200">PAGOS 100% SEGUROS</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  🛡️
                </div>
                <div className="text-[14px] leading-relaxed text-zinc-300">
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
      )}
    </RequireAuth>
  );
}
