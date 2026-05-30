"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

function PickButton({
  value,
  selected,
  onClick,
}: {
  value: Pick;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        (
          "h-9 w-12 rounded-xl border text-[12px] font-extrabold transition-colors " +
          (selected
            ? value === "2"
              ? "border-blue-500/30 bg-blue-500/20 text-blue-100 ring-1 ring-blue-500/25"
              : "border-lime-500/30 bg-lime-500/20 text-lime-100 ring-1 ring-lime-500/25"
            : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900")
        ).trim()
      }
    >
      {value}
    </button>
  );
}

function CartonPicksInner() {
  const { user } = useSessionUser();
  const sp = useSearchParams();
  const router = useRouter();

  const purchaseId = sp.get("purchaseId") ?? "";
  const price = 1000;

  const [matches, setMatches] = useState<PurchaseMatch[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const [closed, setClosed] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [picks, setPicks] = useState<Record<number, Pick>>({});

  // Cargar matches del purchase + picks guardados
  useEffect(() => {
    if (!purchaseId) return;
    let cancelled = false;
    (async () => {
      try {
        setMatchesLoading(true);
        setMatchesError(null);
        const res = await fetch(`/api/carton/picks?purchaseId=${encodeURIComponent(purchaseId)}`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          picks?: { matchId: number; pick: Pick }[];
          matches?: PurchaseMatch[];
          closed?: boolean;
        };
        if (cancelled) return;

        const mm = Array.isArray(data.matches) ? data.matches : [];
        setMatches(mm);

        // `closed` viene del backend (deadline / partido iniciado)
        setClosed(Boolean(data.closed));

        // default picks: "1" por cada match
        const next: Record<number, Pick> = {};
        for (const m of mm) next[m.index] = "1";
        for (const p of data.picks ?? []) next[p.matchId] = p.pick;
        setPicks(next);
      } catch (e) {
        if (cancelled) return;
        setMatches([]);
        setPicks({});
        setClosed(false);
        setMatchesError(e instanceof Error ? e.message : "No se pudieron cargar los partidos");
      } finally {
        if (!cancelled) setMatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const stats = useMemo(() => {
    // Aciertos = partidos acertados cuyo resultado NO fue empate (1 o 2)
    // Empates = pronóstico X acertado (resultado draw)
    let aciertos = 0;
    let empates = 0;
    let fallos = 0;
    let pendientes = 0;

    for (const m of matches) {
      const hasResult = Boolean(m.has_result) || m.result != null;
      if (!hasResult) {
        pendientes++;
        continue;
      }
      const resultPick: Pick | null = m.result === "local" ? "1" : m.result === "draw" ? "X" : m.result === "visit" ? "2" : null;
      const userPick = picks[m.index];

      if (resultPick && userPick === resultPick) {
        if (resultPick === "X") empates++;
        else aciertos++;
      } else {
        fallos++;
      }
    }

    return { aciertos, empates, fallos, pendientes };
  }, [matches, picks]);

  const matchesCount = matches.length;

  async function persistPicks() {
    if (!purchaseId) return;
    if (closed) {
      setSaveError("Este cartón ya fue cerrado y no se puede modificar");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        purchaseId,
        picks: Object.entries(picks).map(([matchId, pick]) => ({
          matchId: Number(matchId),
          pick,
        })),
      };

      const res = await fetch("/api/carton/picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        // Si el backend nos avisa que está cerrado, reflejarlo en UI
        if (msg.toLowerCase().includes("cerrado")) setClosed(true);
        throw new Error(msg);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    let local = 0;
    let draw = 0;
    let away = 0;
    for (const m of matches) {
      const p = picks[m.index];
      if (p === "1") local++;
      if (p === "X") draw++;
      if (p === "2") away++;
    }
    return { local, draw, away };
  }, [matches, picks]);

  const selectedCount = useMemo(() => Object.keys(picks).length, [picks]);

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
          { label: "Mis Cartones", href: "/cartones", icon: <TicketIcon /> },
          { label: "Agregar saldo", href: "/wallet", icon: <PlusIcon /> },
        ]}
        left={
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">MENÚ</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Inicio", href: "/" },
                  { label: "En Vivo", href: "/#envivo", live: true },
                  { label: "Fútbol", href: "/bet" },
                  { label: "Tenis", href: "/#" },
                  { label: "Básquet", href: "/#" },
                  { label: "Hockey", href: "/#" },
                  { label: "Apuestas Especiales", href: "/#" },
                  { label: "Ligas y Torneos", href: "/#" },
                ].map((it) => (
                  <a
                    key={it.label}
                    href={it.href}
                    className={
                      (
                        "flex items-center justify-between rounded-2xl px-3 py-2 ring-1 transition-colors " +
                        (it.label === "Fútbol"
                          ? "bg-zinc-950/20 text-zinc-200 ring-zinc-800 hover:bg-zinc-900"
                          : "bg-zinc-950/20 text-zinc-200 ring-zinc-800 hover:bg-zinc-900")
                      ).trim()
                    }
                  >
                    <span>{it.label}</span>
                    {it.live ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200 ring-1 ring-red-500/25">
                        LIVE
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
              <div className="mt-2 space-y-2 text-[13px]">
                {[
                  { label: "Mis Apuestas", href: "/account" },
                  { label: "Historial", href: "/account" },
                  { label: "Mi Perfil", href: "/account" },
                  { label: "Comprar Cartones", href: "/carton", active: true },
                  { label: "Mis Cartones", href: "/cartones" },
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
            {/* Header */}
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
                  { n: 1, label: "Seleccioná un cartón", done: true },
                  { n: 2, label: "Elegí tus pronósticos", active: true },
                  { n: 3, label: "Confirmación", active: false },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div
                      className={
                        (
                          "grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ring-1 " +
                          (s.done
                            ? "bg-lime-500/15 text-lime-200 ring-lime-500/30"
                            : s.active
                              ? "bg-lime-500/80 text-zinc-950 ring-lime-500/30"
                              : "bg-zinc-900/40 text-zinc-300 ring-zinc-800")
                        ).trim()
                      }
                    >
                      {s.done ? "✓" : s.n}
                    </div>
                    <div className="text-[13px] text-zinc-200">{s.label}</div>
                    <div className="hidden h-px flex-1 bg-zinc-800 sm:block" />
                  </div>
                ))}
              </div>
            </div>

            {/* Picks */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[16px] font-extrabold">2. Elegí tus pronósticos</div>
                  <div className="mt-1 text-[12px] text-zinc-500">
                    Seleccioná quién creés que va a ganar cada partido.
                  </div>
                </div>
                <div className="hidden items-center gap-5 text-[12px] text-zinc-400 md:flex">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-lime-400" /> Local
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-zinc-500" /> Empate
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400" /> Visitante
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
                {matchesLoading ? (
                  <div className="px-4 py-4 text-[12px] text-zinc-400">Cargando partidos...</div>
                ) : matchesError ? (
                  <div className="px-4 py-4 text-[12px] text-amber-200">{matchesError}</div>
                ) : (
                  matches.map((m) => {
                    const selected = picks[m.index];
                    return (
                      <div
                        key={m.index}
                        className="grid grid-cols-[42px_1fr_160px_44px] items-center gap-3 border-t border-zinc-800 px-4 py-3 text-[12px] first:border-t-0"
                      >
                        <div className="text-zinc-500">{m.index}</div>

                        <div className="flex items-center justify-between gap-4">
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
                            <div className="font-semibold text-zinc-200">{m.local_name}</div>
                          </div>
                          <div className="text-zinc-600">vs</div>
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-zinc-200">{m.visit_name}</div>
                            <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-xl bg-zinc-900/50 ring-1 ring-zinc-800">
                              {imgUrl(m.visit_logo_url) ? (
                                <Image
                                  src={imgUrl(m.visit_logo_url)!}
                                  alt={m.visit_name}
                                  width={28}
                                  height={28}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                "⚽"
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          {(["1", "X", "2"] as const).map((p) => (
                            <PickButton
                              key={p}
                              value={p}
                              selected={selected === p}
                              onClick={() => {
                                if (closed) return;
                                setPicks((prev) => ({ ...prev, [m.index]: p }));
                              }}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-900"
                          title="Estadísticas (demo)"
                        >
                          ▥
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[12px] text-blue-200">
                {closed
                  ? "Este cartón ya fue cerrado. Tus pronósticos no se pueden modificar."
                  : "Podés cambiar tus pronósticos las veces que quieras antes de que el cartón cierre."}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/carton")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-2 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-900"
                >
                  ← Volver
                </button>

                <div className="hidden text-[12px] text-zinc-500 md:block">
                  {selectedCount} de {matchesCount} partidos seleccionados
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await persistPicks();
                    router.push(
                      `/carton/confirm${purchaseId ? `?purchaseId=${encodeURIComponent(purchaseId)}` : ""}`,
                    );
                  }}
                  aria-disabled={saving || !purchaseId || closed}
                  disabled={saving || !purchaseId || closed}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-500/80 px-6 py-3 text-[13px] font-extrabold text-zinc-950 hover:bg-lime-500 disabled:opacity-60"
                >
                  Continuar
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              {saveError ? (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">TU CARTÓN</div>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  ▦
                </div>
                <div>
                  <div className="text-[12px] text-zinc-400">Cartón Clásico</div>
                  <div className="text-2xl font-extrabold text-zinc-50">15 PARTIDOS</div>
                </div>
              </div>
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <div className="text-[12px] text-zinc-400">Valor del cartón</div>
                <div className="mt-2 text-2xl font-extrabold text-lime-300 tabular-nums">
                  ${formatMoneyARS(price)},00
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">RESULTADO DEL CARTÓN</div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-zinc-800 bg-black/10 px-3 py-3">
                  <div className="text-2xl font-extrabold text-lime-300 tabular-nums">{stats.aciertos}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">Aciertos</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/10 px-3 py-3">
                  <div className="text-2xl font-extrabold text-zinc-200 tabular-nums">{stats.empates}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">Empates</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/10 px-3 py-3">
                  <div className="text-2xl font-extrabold text-red-300 tabular-nums">{stats.fallos}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">Fallos</div>
                </div>
              </div>
              {stats.pendientes ? (
                <div className="mt-3 text-[12px] text-zinc-500">Pendientes: {stats.pendientes}</div>
              ) : null}
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">RESUMEN DE TUS PRONÓSTICOS</div>
              <div className="mt-4 space-y-3 text-[12px]">
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-lime-500/20 text-[12px] font-extrabold text-lime-100 ring-1 ring-lime-500/25">
                      1
                    </div>
                    <div className="text-zinc-200">{summary.local} Local</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-800/50 text-[12px] font-extrabold text-zinc-100 ring-1 ring-zinc-700">
                      X
                    </div>
                    <div className="text-zinc-200">{summary.draw} Empates</div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/20 text-[12px] font-extrabold text-blue-100 ring-1 ring-blue-500/25">
                      2
                    </div>
                    <div className="text-zinc-200">{summary.away} Visitantes</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold text-zinc-200">PREMIOS</div>
              <div className="mt-2 text-[12px] text-zinc-500">Premios según cantidad de aciertos</div>
              <div className="mt-4 space-y-3 text-[12px]">
                {[
                  { a: "15 aciertos", p: "Premio mayor" },
                  { a: "14 aciertos", p: "Gran premio" },
                  { a: "13 aciertos", p: "Buen premio" },
                  { a: "12 aciertos", p: "Premio menor" },
                  { a: "Menos de 12", p: "Participás por premios sorpresa" },
                ].map((r) => (
                  <div key={r.a} className="flex items-center justify-between">
                    <div className="text-zinc-300">{r.a}</div>
                    <div className="font-semibold text-lime-200">{r.p}</div>
                  </div>
                ))}
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

export default function CartonPicksPage() {
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
      <CartonPicksInner />
    </Suspense>
  );
}
