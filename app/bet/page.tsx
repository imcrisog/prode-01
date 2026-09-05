"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { DashboardShell } from "../components/DashboardShell";
import {
  BallIcon,
  ChevronRightIcon,
  HomeIcon,
  LiveIcon,
  PlusIcon,
  TicketIcon,
  UserIcon,
} from "../components/icons";
import { RequireAuth } from "../components/RequireAuth";
import {
  createMatchIfMissing,
  placeBet,
  settleExpiredMatches,
  type Match,
} from "../lib/localdb";
import { useSessionUser } from "../lib/useSessionUser";

const TEAMS = ["River Plate", "Boca Juniors", "Empate"] as const;
const MATCH_DURATION_MINUTES = 10;

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function OddsPill({
  label,
  odd,
  selected,
  onClick,
}: {
  label: string;
  odd: number;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        (
          "flex items-center justify-between rounded-2xl border px-4 py-3 text-[13px] transition-colors " +
          (selected
            ? "border-lime-500/40 bg-lime-500/10 text-zinc-50 ring-1 ring-lime-500/25"
            : "border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900")
        ).trim()
      }
    >
      <span className="font-semibold">{label}</span>
      <span className="font-extrabold text-lime-300 tabular-nums">{odd.toFixed(2)}</span>
    </button>
  );
}

export default function BetPage() {
  const { user, refresh } = useSessionUser();
  const [amount, setAmount] = useState(1000);
  const [pick, setPick] = useState<(typeof TEAMS)[number]>(TEAMS[0]);
  const [match] = useState<Match>(() =>
    createMatchIfMissing({
      teams: ["River Plate", "Boca Juniors"],
      durationMinutes: MATCH_DURATION_MINUTES,
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    settleExpiredMatches();
    refresh();
  }, [refresh]);

  const remainingMs = useMemo(() => Math.max(0, match.endsAt - now), [match, now]);
  const canBet = remainingMs > 0;

  // Odds hardcodeadas solo para UI demo
  const odds = useMemo(
    () => ({
      "River Plate": 1.6,
      Empate: 3.8,
      "Boca Juniors": 5.2,
    }),
    [],
  );

  const totalOdds = odds[pick];
  const possibleWin = useMemo(() => Math.round(amount * totalOdds), [amount, totalOdds]);

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
              <div className="text-[11px] text-zinc-400">Apuestas</div>
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
          { label: "Fútbol", href: "/bet", icon: <BallIcon />, active: true },
          { label: "Mis Apuestas", href: "/account", icon: <TicketIcon /> },
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
                  { label: "Fútbol", href: "/bet", active: true },
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
                        (it.active
                          ? "bg-lime-500/10 text-lime-200 ring-lime-500/25"
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

            <div className="overflow-hidden rounded-3xl border border-lime-500/20 bg-gradient-to-b from-lime-500/10 to-zinc-950/40">
              <div className="p-4">
                <div className="text-[12px] font-semibold text-lime-200">BONO DE BIENVENIDA</div>
                <div className="mt-2 text-4xl font-extrabold tracking-tight text-lime-300">
                  100%
                </div>
                <div className="mt-1 text-[14px] font-semibold text-zinc-200">HASTA $50.000</div>
                <button
                  type="button"
                  className="mt-4 w-full rounded-2xl bg-lime-500/80 px-3 py-2 text-[12px] font-extrabold text-zinc-950 hover:bg-lime-500"
                >
                  RECLAMAR BONO
                </button>
              </div>
              <div className="relative h-28">
                <Image
                  src="/banner-prode.jpg"
                  alt="Bono"
                  fill
                  className="object-cover opacity-70"
                />
              </div>
            </div>
          </div>
        }
        center={
          <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="text-[12px] text-zinc-400">
              <span className="opacity-70">Inicio</span> <span className="opacity-50">›</span>{" "}
              <span>Fútbol</span> <span className="opacity-50">›</span>{" "}
              <span>Liga Profesional Argentina</span>
            </div>

            {/* Match banner */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/40">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(132,204,22,0.14),transparent_45%),radial-gradient(circle_at_70%_10%,rgba(34,197,94,0.10),transparent_45%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
              </div>

              <div className="relative p-6">
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-zinc-200">
                    Liga Profesional Argentina
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-400">Hoy 21:00</div>
                </div>

                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                  <div className="flex items-center justify-center gap-4">
                    <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/5 ring-1 ring-zinc-800">
                      <Image
                        src="/file.svg"
                        alt="River"
                        width={64}
                        height={64}
                        className="opacity-80"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-[12px] text-zinc-400">Local</div>
                      <div className="text-xl font-extrabold">River Plate</div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-zinc-400">VS</div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-lime-500/25 bg-lime-500/10 px-3 py-1 text-[11px] font-extrabold text-lime-200">
                      <span className="h-2 w-2 rounded-full bg-lime-400" />
                      EN VIVO
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="text-[12px] text-zinc-400">Visitante</div>
                      <div className="text-xl font-extrabold">Boca Juniors</div>
                    </div>
                    <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/5 ring-1 ring-zinc-800">
                      <Image
                        src="/file.svg"
                        alt="Boca"
                        width={64}
                        height={64}
                        className="opacity-80"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="relative border-t border-zinc-800 bg-black/20 px-6">
                <div className="flex flex-wrap items-center gap-6 py-3 text-[13px]">
                  {[
                    "Principal",
                    "Goles",
                    "Handicap",
                    "Ambos Equipos",
                    "Tiros de Esquina",
                    "Tarjetas",
                    "Especiales",
                  ].map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      className={
                        (
                          "pb-2 transition-colors " +
                          (i === 0
                            ? "border-b-2 border-lime-400 text-lime-200"
                            : "text-zinc-400 hover:text-zinc-200")
                        ).trim()
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Markets */}
            <div className="space-y-3">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold">Resultado final</div>
                    <div className="text-[12px] text-zinc-500">Elegí quién gana</div>
                  </div>
                  <div className="text-[12px] text-zinc-500">
                    {Math.floor(remainingMs / 60000)}:{String(
                      Math.floor((remainingMs % 60000) / 1000),
                    ).padStart(2, "0")}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <OddsPill
                    label="River Plate"
                    odd={odds["River Plate"]}
                    selected={pick === "River Plate"}
                    onClick={() => setPick("River Plate")}
                  />
                  <OddsPill
                    label="Empate"
                    odd={odds.Empate}
                    selected={pick === "Empate"}
                    onClick={() => setPick("Empate")}
                  />
                  <OddsPill
                    label="Boca Juniors"
                    odd={odds["Boca Juniors"]}
                    selected={pick === "Boca Juniors"}
                    onClick={() => setPick("Boca Juniors")}
                  />
                </div>
              </div>

              {/* Secciones visuales (como el mock) */}
              {[
                {
                  title: "Doble oportunidad",
                  rows: [
                    { l: "River o Empate", o: 1.16 },
                    { l: "River o Boca", o: 1.25 },
                    { l: "Empate o Boca", o: 2.2 },
                  ],
                },
                {
                  title: "Más / Menos de goles",
                  rows: [
                    { l: "Más de 1.5", o: 1.25 },
                    { l: "Menos de 1.5", o: 3.6 },
                    { l: "Más de 2.5", o: 1.75 },
                    { l: "Menos de 2.5", o: 2.05 },
                  ],
                },
                {
                  title: "Ambos equipos marcan",
                  rows: [
                    { l: "Sí", o: 1.9 },
                    { l: "No", o: 1.8 },
                  ],
                },
              ].map((sec) => (
                <div
                  key={sec.title}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950/40"
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="text-[14px] font-semibold">{sec.title}</div>
                    <button type="button" className="text-zinc-500 hover:text-zinc-300">
                      ˅
                    </button>
                  </div>
                  <div className="grid gap-2 px-5 pb-5 sm:grid-cols-3">
                    {sec.rows.map((r) => (
                      <button
                        key={r.l}
                        type="button"
                        className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3 text-[13px] text-zinc-200 hover:bg-zinc-900"
                        onClick={() => setPick("River Plate")}
                        title="Demo"
                      >
                        <span>{r.l}</span>
                        <span className="font-extrabold text-lime-300 tabular-nums">
                          {r.o.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Footer cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { title: "ESTADÍSTICAS DEL PARTIDO", sub: "Ver datos clave del encuentro", icon: "📈" },
                  { title: "ENFRENTAMIENTOS", sub: "Últimos 5 partidos", icon: "⚽" },
                  { title: "FORMA DE LOS EQUIPOS", sub: "Racha y rendimiento actual", icon: "📊" },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded-3xl border border-zinc-800 bg-zinc-950/30 p-5"
                  >
                    <div className="text-lime-300">{c.icon}</div>
                    <div className="mt-3 text-[12px] font-extrabold text-zinc-200">{c.title}</div>
                    <div className="mt-1 text-[12px] text-zinc-500">{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
        right={
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold tracking-wide text-zinc-200">
                  BOLETO DE APUESTA
                </div>
                <button type="button" className="text-[12px] text-zinc-500 hover:text-zinc-300">
                  Limpiar todo
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/10 p-4">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="font-semibold text-zinc-200">River Plate vs Boca Juniors</div>
                  <button type="button" className="text-zinc-500 hover:text-zinc-300">
                    ×
                  </button>
                </div>
                <div className="mt-3 text-[12px] text-zinc-400">Resultado final</div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-[14px] font-extrabold">{pick}</div>
                  <div className="text-[14px] font-extrabold text-lime-300">
                    {totalOdds.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[13px]">
                <div className="text-zinc-400">Cuota total</div>
                <div className="text-xl font-extrabold text-lime-300 tabular-nums">
                  {totalOdds.toFixed(2)}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[12px] font-semibold text-zinc-300">Monto de la apuesta</div>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                  <span className="text-zinc-400">$</span>
                  <input
                    className="w-full bg-transparent text-[14px] font-semibold text-zinc-50 outline-none"
                    inputMode="numeric"
                    value={String(amount)}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value || 0)))}
                  />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[100, 500, 1000, 5000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded-xl border border-zinc-800 bg-black/10 px-2 py-2 text-[12px] font-semibold text-zinc-200 hover:bg-zinc-900"
                      onClick={() => setAmount((a) => a + v)}
                    >
                      +{formatMoneyARS(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-[12px] text-zinc-400">Ganancia posible</div>
                <div className="text-lg font-extrabold text-lime-300 tabular-nums">
                  ${formatMoneyARS(possibleWin)}
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                className="mt-4 w-full !rounded-2xl !bg-lime-500/90 !py-3 !text-[13px] !font-extrabold !text-zinc-950 hover:!bg-lime-500 disabled:opacity-60"
                disabled={!canBet}
                onClick={() => {
                  setError(null);
                  try {
                    // Lógica demo: se sigue guardando en localdb hasta migrar bets a Mongo.
                    placeBet({
                      userId: user.id,
                      matchId: match.id,
                      pick,
                      amount,
                    });
                    refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Error inesperado");
                  }
                }}
              >
                REALIZAR APUESTA
                <ChevronRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  🛡️
                </div>
                <div>
                  <div className="text-[13px] font-extrabold text-lime-200">APUESTA SEGURA</div>
                  <div className="text-[12px] text-zinc-400">
                    Tus datos y transacciones están protegidos
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-extrabold text-zinc-200">Historial reciente</div>
                <a className="text-[12px] font-semibold text-lime-300 hover:underline" href="/account">
                  Ver todo
                </a>
              </div>
              <div className="mt-4 space-y-3 text-[12px]">
                {[
                  {
                    m: "Racing Club - Independiente",
                    r: "Resultado final: Racing Club",
                    a: 1000,
                    s: "Ganada",
                    p: 1800,
                  },
                  {
                    m: "San Lorenzo - Platense",
                    r: "Más de 2.5 goles",
                    a: 500,
                    s: "Perdida",
                    p: 0,
                  },
                  {
                    m: "River Plate - Boca Juniors",
                    r: "Resultado final: River Plate",
                    a: 700,
                    s: "Ganada",
                    p: 1120,
                  },
                ].map((h) => (
                  <div
                    key={h.m}
                    className="rounded-2xl border border-zinc-800 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-zinc-200">{h.m}</div>
                        <div className="mt-1 text-zinc-500">{h.r}</div>
                      </div>
                      <div
                        className={
                          (
                            "rounded-xl px-2 py-1 text-[11px] font-extrabold ring-1 " +
                            (h.s === "Ganada"
                              ? "bg-lime-500/10 text-lime-200 ring-lime-500/25"
                              : "bg-red-500/10 text-red-200 ring-red-500/25")
                          ).trim()
                        }
                      >
                        {h.s}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-zinc-500">${formatMoneyARS(h.a)}</div>
                      <div className="font-extrabold text-lime-300 tabular-nums">
                        ${formatMoneyARS(h.p)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        }
      />
    </RequireAuth>
  );
}
