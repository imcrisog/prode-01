"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../components/Card";
import { DashboardShell } from "../components/DashboardShell";
import {
  BallIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TicketIcon,
  UserIcon,
} from "../components/icons";
import { RequireAuth } from "../components/RequireAuth";
import { useSessionUser } from "../lib/useSessionUser";
import { backendUrl } from "../lib/backend";

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

type MatchRow = {
  n: number;
  home: string;
  away: string;
  date: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
};

type BackendCarton = {
  id: number;
  title?: string | null;
  number_date: number;
  type: string; // classic1 / classic5 / 1 / 5
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

type BackendMatch = {
  local?: { name?: string };
  visit?: { name?: string };
  category?: { name?: string };
  timetoplay?: string;
  date?: string;
  hour?: string;
  starts_at?: string;
  home?: string;
  away?: string;
  local_name?: string;
  visit_name?: string;
  visitante?: string;
  // endpoint /api/prodes/cartones/matchs
  local_name_team?: string;
  visit_name_team?: string;
  local_logo_url?: string;
  visit_logo_url?: string;
};

function imgUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
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

function cartonLabel(c: BackendCarton) {
  const type = String(c.type || "");
  if (type === "classic1" || type === "1") return "CARTÓN CLÁSICO";
  if (type === "classic5" || type === "5") return "MEGACARTÓN";
  return "CARTÓN";
}

function cartonMatchesCount(c: BackendCarton) {
  // Respetar a rajatabla lo que viene del backend
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

function asMatchRowsFromCarton(carton: BackendCarton | null): MatchRow[] {
  const raw = Array.isArray(carton?.matches) ? (carton!.matches as BackendCartonMatch[]) : [];
  const count = carton ? cartonMatchesCount(carton) : 0;

  const rows: MatchRow[] = raw.map((m, idx) => {
    const home = (m.local_name ?? "-") as string;
    const away = (m.visit_name ?? "-") as string;
    const date = (m.timetoplay ?? "") as string;
    return { n: idx + 1, home, away, date, home_logo_url: m.local_logo_url, away_logo_url: m.visit_logo_url };
  });

  // Si el backend no trae matches, mostramos placeholders (pero igual se ve el UI).
  if (rows.length === 0 && count > 0) {
    return Array.from({ length: Math.min(15, count) }, (_, i) => ({
      n: i + 1,
      home: "-",
      away: "-",
      date: "",
      home_logo_url: null,
      away_logo_url: null,
    }));
  }

  return rows.slice(0, Math.max(0, Math.min(rows.length, count || rows.length)));
}

export default function CartonPage() {
  const { user, refresh } = useSessionUser();
  const router = useRouter();
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartones, setCartones] = useState<BackendCarton[]>([]);
  const [cartonesLoaded, setCartonesLoaded] = useState(false);

  // Re-render “en tiempo real” para que el filtrado por deadline se actualice solo.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const openCartones = useMemo(() => {
    const now = nowTick;
    return cartones.filter((c) => {
      if (!c.purchase_deadline) return true;
      const d = new Date(String(c.purchase_deadline));
      if (Number.isNaN(d.getTime())) return true;
      return d.getTime() > now;
    });
  }, [cartones, nowTick]);

  const [matchesState, setMatchesState] = useState<{
    loading: boolean;
    error: string | null;
    rows: MatchRow[];
  }>({ loading: false, error: null, rows: [] });

  const selectedCarton = useMemo(() => {
    if (!selectedPurchaseType) return null;
    return openCartones.find((c) => String(c.id) === selectedPurchaseType) ?? null;
  }, [openCartones, selectedPurchaseType]);

  // Si el cartón seleccionado cerró mientras el usuario estaba en la pantalla, lo avisamos.
  // (Evitamos setState sincronamente en useEffect para no disparar la regla react-hooks/set-state-in-effect).
  const selectedBecameClosed = useMemo(() => {
    if (!selectedPurchaseType) return false;
    const exists = openCartones.some((c) => String(c.id) === selectedPurchaseType);
    return !exists;
  }, [openCartones, selectedPurchaseType]);

  useEffect(() => {
    if (!selectedBecameClosed) return;
    // Se ejecuta en callback async del effect (sigue siendo effect, pero evitamos el patrón “sync setState”)
    const t = setTimeout(() => {
      setSelectedPurchaseType(null);
      setError("Ese cartón ya cerró. Elegí otro disponible.");
    }, 0);
    return () => clearTimeout(t);
  }, [selectedBecameClosed]);

  const price = useMemo(() => selectedCarton?.price_ars ?? 0, [selectedCarton]);

  // Cuando cambia el cartón seleccionado, traemos los partidos por number_date
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Arranca loading y limpia errores en un solo setState (evita warning de eslint)
        setMatchesState((s) => ({ ...s, loading: true, error: null }));

        if (!selectedCarton) {
          if (!cancelled) setMatchesState({ loading: false, error: null, rows: [] });
          return;
        }

        // Importante: este listado tiene que venir de /api/prodes/cartones/matchs (como pediste)
        // Filtramos por carton_id para obtener los partidos del cartón.
        const res = await fetch(
          backendUrl(`/api/prodes/cartones/matchs?carton_id=${encodeURIComponent(String(selectedCarton.id))}`),
          { cache: "no-store" },
        );
        const data = (await res.json()) as { ok?: boolean; message?: string; data?: BackendMatch[] };
        if (cancelled) return;

        if (!res.ok || data.ok === false) {
          setMatchesState({
            loading: false,
            error: data.message ?? "No se pudieron cargar los partidos",
            rows: [],
          });
          return;
        }

        const raw = Array.isArray(data.data) ? data.data : [];
        if (raw.length === 0) {
          setMatchesState({
            loading: false,
            error:
              "No hay partidos para este cartón (API /api/prodes/cartones/matchs devolvió una lista vacía).",
            rows: [],
          });
          return;
        }

        const rows = raw.map((m, idx) => {
          const home =
            (m.local?.name ??
              m.local_name_team ??
              m.local_name ??
              m.home ??
              "-") as string;
          const away =
            (m.visit?.name ??
              m.visit_name_team ??
              m.visit_name ??
              m.away ??
              m.visitante ??
              "-") as string;
          const date =
            (m.timetoplay ??
              m.starts_at ??
              (m.date && m.hour ? `${m.date} - ${m.hour}` : m.date) ??
              "") as string;
          return {
            n: idx + 1,
            home,
            away,
            date,
            home_logo_url: imgUrl(m.local_logo_url),
            away_logo_url: imgUrl(m.visit_logo_url),
          };
        });

        setMatchesState({ loading: false, error: null, rows });
      } catch (e) {
        if (cancelled) return;
        setMatchesState({
          loading: false,
          error: e instanceof Error ? e.message : "No se pudieron cargar los partidos",
          rows: [],
        });
      } finally {
        // si ya seteamos loading false arriba, esto no cambia nada; pero cubre early returns
        if (!cancelled) setMatchesState((s) => ({ ...s, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCarton]);

  // Cargar cartones reales desde el backend (si no hay data, se avisa al usuario)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(backendUrl("/api/prode/cartones"), { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; message?: string; data?: BackendCarton[] };
        if (cancelled) return;
        if (!res.ok || data.ok === false) {
          setCartones([]);
          return;
        }
        setCartones(Array.isArray(data.data) ? data.data : []);
      } catch {
        if (cancelled) return;
        setCartones([]);
      } finally {
        if (!cancelled) setCartonesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  async function buy() {
    setError(null);
    setLoading(true);
    try {
      if (!selectedCarton) throw new Error("Seleccioná un cartón");
      const res = await fetch("/api/carton/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cartonId: selectedCarton.id,
          cartonSnapshot: selectedCarton,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { purchaseId?: string };
      await refresh();
      router.push(`/carton/picks${data.purchaseId ? `?purchaseId=${encodeURIComponent(data.purchaseId)}` : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      setError(msg);

      // Si el backend nos dice “Cartón cerrado”, lo sacamos del listado y limpiamos selección.
      if (String(msg).toLowerCase().includes("cerrado")) {
        setSelectedPurchaseType(null);
      }
    } finally {
      setLoading(false);
    }
  }

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
              <div className="text-[11px] text-zinc-400">Comprar cartón</div>
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
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Mis Apuestas", href: "/account" },
                  { label: "Historial", href: "/account" },
                  { label: "Mi Perfil", href: "/account" },
                  { label: "Comprar Cartones", href: "/carton", active: true },
                  { label: "Mis Cartones", href: "/carton" },
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

            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">LIGAS POPULARES</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Liga Profesional", sub: "Argentina", flag: "🇦🇷" },
                  { label: "Copa de la Liga", sub: "Argentina", flag: "🇦🇷" },
                  { label: "La Liga", sub: "España", flag: "🇪🇸" },
                  { label: "Premier League", sub: "Inglaterra", flag: "🇬🇧" },
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
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  ▦
                </div>
                <div>
                  <div className="text-2xl font-extrabold">Comprar cartón</div>
                  <div className="mt-1 text-[13px] text-zinc-400">
                    Elegí tus partidos y pronosticá quién gana cada uno.
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { n: 1, label: "Seleccioná un cartón", active: true },
                  { n: 2, label: "Elegí tus pronósticos", active: false },
                  { n: 3, label: "Confirmación", active: false },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div
                      className={
                        (
                          "grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ring-1 " +
                          (s.active
                            ? "bg-lime-500/15 text-lime-200 ring-lime-500/30"
                            : "bg-zinc-900/40 text-zinc-300 ring-zinc-800")
                        ).trim()
                      }
                    >
                      {s.n}
                    </div>
                    <div className="text-[13px] text-zinc-200">{s.label}</div>
                    <div className="hidden h-px flex-1 bg-zinc-800 sm:block" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="text-[14px] font-semibold">1. Seleccioná un cartón</div>
              <div className="mt-1 text-[12px] text-zinc-500">
                Cada cartón incluye 15 partidos para pronosticar.
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {cartonesLoaded && cartones.length === 0 ? (
                  <div className="lg:col-span-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200">
                    No hay cartones disponibles en este momento (API /api/prode/cartones devolvió una lista vacía).
                  </div>
                ) : null}
                {openCartones.length ? (
                  openCartones.map((c) => {
                    const active = selectedPurchaseType === String(c.id);
                    const matchesCount = cartonMatchesCount(c);
                    return (
                      <button
                        key={`${c.type}-${c.number_date}`}
                        type="button"
                        onClick={() => setSelectedPurchaseType(String(c.id))}
                        className={
                          (
                            "text-left rounded-3xl border p-5 transition-colors " +
                            (active
                              ? "border-lime-500/30 bg-lime-500/5 ring-1 ring-lime-500/25"
                              : "border-zinc-800 bg-black/10 hover:bg-zinc-900")
                          ).trim()
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[12px] font-extrabold text-zinc-300">
                              {c.title ? c.title : cartonLabel(c)}
                              <span className="ml-2 text-zinc-500 font-semibold">Fecha {c.number_date}</span>
                            </div>
                            <div className="mt-2 text-3xl font-extrabold text-lime-300">
                              {matchesCount} PARTIDOS
                            </div>
                          </div>
                          <div
                            className={
                              (
                                "grid h-7 w-7 place-items-center rounded-full ring-1 " +
                                (active
                                  ? "bg-lime-500/15 text-lime-200 ring-lime-500/30"
                                  : "bg-zinc-900/40 text-zinc-400 ring-zinc-800")
                              ).trim()
                            }
                          >
                            ✓
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-[13px] text-zinc-200">
                          {[
                            `${matchesCount} partidos para pronosticar`,
                            "Elegí 1X2 en cada partido",
                            "Participá por grandes premios",
                          ].map((t) => (
                            <div key={t} className="flex items-center gap-2">
                              <span className="text-lime-300">✓</span>
                              <span className="text-zinc-300">{t}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 rounded-2xl border border-lime-500/20 bg-lime-500/10 px-4 py-3">
                          <div className="text-xl font-extrabold text-lime-300 tabular-nums">
                            ${formatMoneyARS(c.price_ars)},00
                          </div>
                          <div className="text-[12px] text-zinc-400">por cartón</div>
                        </div>

                        <div className="mt-4 border-t border-zinc-800 pt-4">
                          <div className="text-[11px] font-semibold tracking-wide text-zinc-500">
                            PREMIOS
                          </div>
                          <div className="mt-2 space-y-2 text-[12px]">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">🥇 1°</span>
                              <span className="font-extrabold text-amber-200">
                                $ {formatMoneyARS(parsePrize(c.prize_first))}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">🥈 2°</span>
                              <span className="font-semibold text-zinc-200">
                                $ {formatMoneyARS(parsePrize(c.prize_second))}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">🥉 3°</span>
                              <span className="font-semibold text-zinc-200">
                                $ {formatMoneyARS(parsePrize(c.prize_third))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-3xl border border-zinc-800 bg-black/10 p-5 opacity-60">
                    <div className="text-[12px] font-extrabold text-zinc-500">SIN DATA</div>
                    <div className="mt-2 text-[13px] text-zinc-400">
                      Cuando la API tenga cartones, van a aparecer acá automáticamente.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-3xl border border-zinc-800 bg-black/10 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold">
                      Partidos incluidos en tu cartón ({selectedCarton ? cartonMatchesCount(selectedCarton) : 0})
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">
                      Los partidos pueden variar hasta 15 minutos antes del inicio.
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
                  {/* En mobile reflow: mostramos # + Partido y movemos Fecha + 1/X/2 debajo para evitar overflow horizontal */}
                  <div className="grid grid-cols-[32px_1fr] gap-0 bg-zinc-950/40 px-4 py-2 text-[11px] font-semibold text-zinc-400 sm:grid-cols-[40px_1fr_120px_180px]">
                    <div>#</div>
                    <div>Partido</div>
                    <div className="hidden sm:block">Fecha</div>
                    <div className="hidden text-right sm:block">1 / X / 2</div>
                  </div>
                  {matchesState.loading ? (
                    <div className="px-4 py-4 text-[12px] text-zinc-400">
                      Cargando partidos...
                    </div>
                  ) : matchesState.error ? (
                    <div className="px-4 py-4 text-[12px] text-amber-200">
                      {matchesState.error}
                    </div>
                  ) : matchesState.rows.length ? (
                    matchesState.rows.map((m) => (
                      <div
                        key={m.n}
                        className="grid grid-cols-[32px_1fr] items-start gap-0 border-t border-zinc-800 px-4 py-3 text-[12px] sm:grid-cols-[40px_1fr_120px_180px] sm:items-center"
                      >
                        <div className="text-zinc-500">{m.n}</div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2 font-semibold text-zinc-200">
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {m.home_logo_url ? (
                                  <Image
                                    src={m.home_logo_url}
                                    alt={m.home}
                                    width={28}
                                    height={28}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[10px] font-extrabold text-zinc-300">
                                    {teamAbbr(m.home)}
                                  </span>
                                )}
                              </span>
                              <span className="truncate">{m.home}</span>
                            </span>
                            <span className="flex-none text-zinc-600">vs</span>
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {m.away_logo_url ? (
                                  <Image
                                    src={m.away_logo_url}
                                    alt={m.away}
                                    width={28}
                                    height={28}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[10px] font-extrabold text-zinc-300">
                                    {teamAbbr(m.away)}
                                  </span>
                                )}
                              </span>
                              <span className="truncate">{m.away}</span>
                            </span>
                          </div>

                          {/* Mobile: mostramos fecha + botones abajo */}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 sm:hidden">
                            <span className="min-w-0 truncate">{m.date}</span>
                            <div className="flex flex-wrap justify-end gap-2">
                              {(["1", "X", "2"] as const).map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  className="h-8 w-9 rounded-xl border border-zinc-800 bg-zinc-950/40 text-[12px] font-semibold text-zinc-200"
                                  title="Demo"
                                >
                                  {k}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="hidden text-zinc-500 sm:block">{m.date}</div>
                        <div className="hidden justify-end gap-2 sm:flex">
                          {["1", "X", "2"].map((k) => (
                            <button
                              key={k}
                              type="button"
                              className="h-8 w-10 rounded-xl border border-zinc-800 bg-zinc-950/40 text-[12px] font-semibold text-zinc-200 hover:bg-zinc-900"
                              title="Demo"
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    (Array.isArray(selectedCarton?.matches) && selectedCarton?.matches?.length
                      ? selectedCarton.matches.map((mm, idx) => ({
                          n: idx + 1,
                          home: mm.local_name ?? "-",
                          away: mm.visit_name ?? "-",
                          date: mm.timetoplay ?? "",
                          home_logo_url: imgUrl(mm.local_logo_url),
                          away_logo_url: imgUrl(mm.visit_logo_url),
                        }))
                      : asMatchRowsFromCarton(selectedCarton)
                    ).map((m) => (
                      <div
                        key={m.n}
                        className="grid grid-cols-[32px_1fr] items-start gap-0 border-t border-zinc-800 px-4 py-3 text-[12px] sm:grid-cols-[40px_1fr_120px_180px] sm:items-center"
                      >
                        <div className="text-zinc-500">{m.n}</div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2 font-semibold text-zinc-200">
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {m.home_logo_url ? (
                                  <Image
                                    src={m.home_logo_url}
                                    alt={m.home}
                                    width={28}
                                    height={28}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[10px] font-extrabold text-zinc-300">
                                    {teamAbbr(m.home)}
                                  </span>
                                )}
                              </span>
                              <span className="truncate">{m.home}</span>
                            </span>
                            <span className="flex-none text-zinc-600">vs</span>
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full bg-zinc-950/60 ring-1 ring-zinc-800">
                                {m.away_logo_url ? (
                                  <Image
                                    src={m.away_logo_url}
                                    alt={m.away}
                                    width={28}
                                    height={28}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="text-[10px] font-extrabold text-zinc-300">
                                    {teamAbbr(m.away)}
                                  </span>
                                )}
                              </span>
                              <span className="truncate">{m.away}</span>
                            </span>
                          </div>

                          {/* Mobile: fecha + botones abajo */}
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 sm:hidden">
                            <span className="min-w-0 truncate">{m.date}</span>
                            <div className="flex flex-wrap justify-end gap-2">
                              {(["1", "X", "2"] as const).map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  className="h-8 w-9 rounded-xl border border-zinc-800 bg-zinc-950/40 text-[12px] font-semibold text-zinc-200"
                                  title="Demo"
                                >
                                  {k}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="hidden text-zinc-500 sm:block">{m.date}</div>
                        <div className="hidden justify-end gap-2 sm:flex">
                          {(["1", "X", "2"] as const).map((k) => (
                            <button
                              key={k}
                              type="button"
                              className="h-8 w-10 rounded-xl border border-zinc-800 bg-zinc-950/40 text-[12px] font-semibold text-zinc-200 hover:bg-zinc-900"
                              title="Demo"
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[12px] text-blue-200">
                  Una vez comprado el cartón, podrás ir completando tus pronósticos. Tenés tiempo hasta
                  el inicio del primer partido.
                </div>

                <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[12px] text-zinc-400">Total a pagar</div>
                    <div className="mt-1 text-xl font-extrabold text-lime-300 tabular-nums sm:text-2xl">
                      ${formatMoneyARS(price)},00
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading || price <= 0}
                    onClick={buy}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-lime-500/80 px-6 py-3 text-[13px] font-extrabold text-zinc-950 hover:bg-lime-500 disabled:opacity-60 sm:w-auto"
                  >
                    🛒 Comprar cartón
                  </button>
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-xs font-extrabold tracking-wide text-zinc-200">TU SALDO ACTUAL</div>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  👛
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Saldo disponible</div>
                  <div className="text-2xl font-extrabold tracking-tight text-lime-300 tabular-nums">
                    ${formatMoneyARS(user.balance)},00
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-[12px]">
                <div>
                  <div className="text-zinc-400">En juego</div>
                  <div className="mt-1 font-semibold text-zinc-200 tabular-nums">$2.150,00</div>
                </div>
                <div>
                  <div className="text-zinc-400">Saldo total</div>
                  <div className="mt-1 font-semibold text-zinc-200 tabular-nums">
                    ${formatMoneyARS(user.balance + 2150)},00
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">¿CÓMO FUNCIONA?</div>
              <div className="mt-4 space-y-4 text-[12px] text-zinc-200">
                {[
                  {
                    n: 1,
                    t: "Comprá tu cartón",
                    d: "Elegí el cartón de 15 partidos.",
                  },
                  {
                    n: 2,
                    t: "Hacé tus pronósticos",
                    d: "Seleccioná 1 (gana local), X (empate) o 2 (gana visitante).",
                  },
                  {
                    n: 3,
                    t: "Gańa premios",
                    d: "Cuantos más aciertos, mejores premios.",
                  },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-lime-500/15 text-[12px] font-extrabold text-lime-200 ring-1 ring-lime-500/25">
                      {s.n}
                    </div>
                    <div>
                      <div className="font-semibold">{s.t}</div>
                      <div className="mt-1 text-zinc-500">{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">PREMIOS</div>
              <div className="mt-2 text-[12px] text-zinc-500">Premio para el que acierta todos los partidos</div>
              <div className="mt-4 space-y-3 text-[12px]">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-zinc-300">Todos los partidos</div>
                  <div className="break-words font-semibold text-lime-200 sm:text-right">Premio mayor</div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">PAGOS 100% SEGUROS</div>
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
