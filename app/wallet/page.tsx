"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
import { createDeposit, getDeposits } from "../lib/localdb";
import { useSessionUser } from "../lib/useSessionUser";

type PrefResponse = { init_point: string };

const PRESETS = [500, 1000, 2500, 5000, 10000, 20000] as const;

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

export default function WalletPage() {
  const { user, refresh } = useSessionUser();

  // Accesibilidad práctica (adultos mayores): focus visible + targets grandes.
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

  const userId = user?.id ?? "";
  const userEmail = user?.email ?? "";

  const [amount, setAmount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inPlayAmount, setInPlayAmount] = useState<number>(0);
  const [inPlayLoaded, setInPlayLoaded] = useState(false);

  const numericAmount = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
  }, [amount]);

  const mpConfigured = useMemo(() => process.env.NEXT_MP_MODE === "production", []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedPreset = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    return PRESETS.includes(rounded as (typeof PRESETS)[number]) ? rounded : null;
  }, [amount]);

  // Fallback: si MP no redirige automáticamente (congrats), al volver a /wallet
  // verificamos depósitos pendientes y acreditamos si están approved.
  useEffect(() => {
    if (!user || !mpConfigured) return;
    let cancelled = false;

    (async () => {
      try {
        const pending = getDeposits()
          .filter((d) => d.userId === user.id && d.status === "pending")
          .slice(-3);

        let credited = false;
        for (const dep of pending) {
          const res = await fetch(`/api/mp/payment-by-ref/${encodeURIComponent(dep.id)}`);
          if (!res.ok) continue;
          const info = (await res.json()) as { id?: string; status?: string };
          if (cancelled) return;
          if (info.status === "approved") {
            // Acreditación server-side (Mongo) + verificación contra MP
            if (info.id) {
              await fetch("/api/wallet/add", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  depositId: dep.id,
                  paymentId: info.id,
                  userId: user.id,
                }),
              });
            }
            credited = true;
          }
        }

        if (credited && !cancelled) refresh();
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mpConfigured, refresh, user]);

  // “En juego”: suma de compras de cartones que siguen EN_JUEGO.
  // Esto no es el balance (que ya se debita al comprar), sino el monto comprometido.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setInPlayLoaded(false);
        const res = await fetch("/api/carton/purchases?limit=100", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { price?: number; stats?: { status?: "EN_JUEGO" | "FINALIZADO" } }[];
        };
        if (cancelled) return;
        if (json.ok === false) throw new Error(json.message ?? "No se pudieron cargar tus cartones");
        const rows = Array.isArray(json.data) ? json.data : [];
        const sum = rows.reduce((acc, r) => {
          if (r?.stats?.status !== "EN_JUEGO") return acc;
          const p = Number(r.price ?? 0);
          return Number.isFinite(p) ? acc + p : acc;
        }, 0);
        setInPlayAmount(sum);
      } catch {
        // Si falla, dejamos 0 (mejor que mostrar un número inventado).
        setInPlayAmount(0);
      } finally {
        if (!cancelled) setInPlayLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  async function goToMercadoPago() {
    setError(null);
    setLoading(true);
    try {
      if (numericAmount <= 0) throw new Error("Monto inválido");

      // En modo demo sin MP sandbox, no acreditamos balance automáticamente.
      // La fuente de verdad pasa a ser Mongo + /api/wallet/add.
      if (!mpConfigured) throw new Error("Mercado Pago no configurado");

      const dep = createDeposit({ userId, amount: numericAmount });
      const res = await fetch("/api/mp/preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          depositId: dep.id,
          payerEmail: userEmail,
          userId,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PrefResponse;
      if (!data.init_point) throw new Error("Respuesta inválida: falta init_point");
      window.location.href = data.init_point;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
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
              <div className="text-[12px] font-semibold text-zinc-400">Agregar saldo</div>
            </div>
          </div>
        }
        topNav={
          <div className="flex items-center gap-6 text-[14px]">
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/">
              Inicio
            </Link>
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#envivo">
              En Vivo
              <span className="ml-2 rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold text-red-200 ring-1 ring-red-500/25">
                LIVE
              </span>
            </Link>
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#proximos">
              Próximos
            </Link>
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/account">
              Mis Apuestas
            </Link>
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#stats">
              Estadísticas
            </Link>
            <Link className={("text-zinc-200 hover:text-zinc-50 " + focusRing).trim()} href="/#promo">
              Promociones
            </Link>
          </div>
        }
        topRight={
          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 sm:block">
              <div className="text-[12px] font-semibold text-zinc-400">Saldo disponible</div>
              <div className="text-[15px] font-extrabold text-lime-300 tabular-nums">
                ${formatMoneyARS(user.balance)}
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
          { label: "Agregar saldo", href: "/wallet", icon: <PlusIcon />, active: true },
        ]}
        left={
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wide text-zinc-400">MI CUENTA</div>
            <div className="space-y-2 text-[13px] text-zinc-200">
              <Link
                href="/account"
                className="block rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800 hover:bg-zinc-900/60"
              >
                Mis apuestas
              </Link>
              <Link
                href="/carton"
                className="block rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800 hover:bg-zinc-900/60"
              >
                Comprar cartones
              </Link>
              <Link
                href="/wallet"
                className="block rounded-2xl bg-lime-500/10 px-3 py-2 text-lime-200 ring-1 ring-lime-500/20"
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

            <div className="pt-2">
              <div className="text-xs font-semibold tracking-wide text-zinc-400">
                LIGAS POPULARES
              </div>
              <div className="mt-2 space-y-2 text-[13px] text-zinc-200">
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800">
                  <span>Liga Profesional</span>
                  <span className="text-xs text-zinc-500">AR</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800">
                  <span>Premier League</span>
                  <span className="text-xs text-zinc-500">UK</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/40 px-3 py-2 ring-1 ring-zinc-800">
                  <span>Champions League</span>
                  <span className="text-xs text-zinc-500">EU</span>
                </div>
              </div>
            </div>
          </div>
        }
        center={
          <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5 sm:p-6">
            <div className="space-y-7">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Agregar saldo</h1>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">
                  Elegí el monto que deseas agregar a tu cuenta
                </p>
              </div>

              {/* Steps */}
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: 1, label: "Seleccioná monto", active: true },
                  { n: 2, label: "Método de pago", active: true },
                  { n: 3, label: "Confirmación", active: false },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-3">
                    <div
                      className={
                        (
                          "grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ring-1 " +
                          (s.active
                            ? "bg-lime-500/15 text-lime-200 ring-lime-500/30"
                            : "bg-zinc-900/40 text-zinc-300 ring-zinc-800")
                        ).trim()
                      }
                    >
                      {s.n}
                    </div>
                    <div className="text-[14px] font-semibold text-zinc-200">{s.label}</div>
                    <div className="hidden h-px flex-1 bg-zinc-800 sm:block" />
                  </div>
                ))}
              </div>

              {/* Step 1 */}
              <div className="space-y-3">
                <div className="text-[15px] font-extrabold text-zinc-50">1. Seleccioná el monto</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(p))}
                      aria-pressed={selectedPreset === p}
                      className={
                        (
                          "min-h-[48px] rounded-2xl border px-3 py-3 text-[15px] font-extrabold tabular-nums transition-colors " +
                          (selectedPreset === p
                            ? "border-lime-500/40 bg-lime-500/10 text-lime-200"
                            : "border-zinc-800 bg-zinc-950/50 text-zinc-200 hover:bg-zinc-900")
                        ).trim()
                      }
                    >
                      ${formatMoneyARS(p)}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="text-[14px] font-semibold text-zinc-300">Otro monto</div>
                  <div className="mt-2">
                    <label className="block">
                      <input
                        inputMode="numeric"
                        value={amount}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        placeholder="Ej: 1500"
                        className={
                          (
                            "min-h-[52px] w-full rounded-2xl border border-lime-500/25 bg-zinc-950/40 px-4 py-3 text-[16px] font-semibold text-zinc-50 outline-none focus:ring-2 focus:ring-lime-500/30 " +
                            focusRing
                          ).trim()
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="text-[15px] font-extrabold text-zinc-50">2. Elegí el método de pago</div>

                <div className="rounded-3xl border border-lime-500/25 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <Image
                          src="/MP_RGB_HANDSHAKE_color_horizontal.svg"
                          alt="Mercado Pago"
                          width={160}
                          height={32}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-[15px] font-extrabold text-zinc-50">
                            Mercado Pago
                          </div>
                          <span className="rounded-full bg-lime-500/15 px-2 py-0.5 text-[10px] font-extrabold text-lime-200 ring-1 ring-lime-500/25">
                            RECOMENDADO
                          </span>
                        </div>
                        <div className="mt-1 text-[14px] leading-relaxed text-zinc-300">
                          Pagos rápidos, fáciles y 100% seguros.
                        </div>
                      </div>
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-lime-500/15 text-lime-200 ring-1 ring-lime-500/25">
                      ✓
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-3">
                    <div className="text-[14px]">
                      <div className="font-semibold text-zinc-200">Acreditación</div>
                      <div className="text-zinc-400">Inmediata</div>
                    </div>
                    <div className="text-[14px]">
                      <div className="font-semibold text-zinc-200">Comisión</div>
                      <div className="text-zinc-400">Sin comisión</div>
                    </div>
                    <div className="text-[14px]">
                      <div className="font-semibold text-zinc-200">Seguridad</div>
                      <div className="text-zinc-400">100% protegida</div>
                    </div>
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={numericAmount <= 0 || loading}
                    onClick={goToMercadoPago}
                    className={
                      (
                        "mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-lime-500/80 px-4 py-3 text-[16px] font-extrabold text-zinc-950 ring-1 ring-lime-500/30 hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50 " +
                        focusRing
                      ).trim()
                    }
                  >
                    <Image
                      src="/MP_RGB_HANDSHAKE_pluma_horizontal.svg"
                      alt="MP"
                      width={26}
                      height={26}
                    />
                    Continuar con Mercado Pago
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>

                  <div className="mt-3 text-center text-[13px] leading-relaxed text-zinc-300">
                    Serás redirigido a Mercado Pago para completar el pago de forma segura.
                  </div>

                  {!mpConfigured ? (
                    <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[14px] leading-relaxed text-amber-200">
                      MP no está configurado (NEXT_MP_MODE=sandbox). Configuralo para probar
                      depósitos.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-[14px] leading-relaxed text-zinc-200">
                Una vez realizado el pago, el saldo se acreditará automáticamente en tu cuenta PRODE.
              </div>
            </div>
          </Card>
        }
        right={
          <div className="space-y-4 pb-6 lg:pb-8">
            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-[13px] font-extrabold tracking-wide text-zinc-200">
                TU SALDO ACTUAL
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  <span className="text-xl">💳</span>
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-zinc-300">Saldo disponible</div>
                  <div className="mt-1 text-[28px] font-extrabold leading-none tracking-tight text-lime-300 tabular-nums">
                    ${formatMoneyARS(user.balance)}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-5 text-[14px]">
                <div>
                  <div className="text-zinc-400">En juego</div>
                  <div className="mt-1 font-extrabold text-zinc-100 tabular-nums">
                    ${inPlayLoaded ? formatMoneyARS(inPlayAmount) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-400">Saldo total</div>
                  <div className="mt-1 font-extrabold text-zinc-100 tabular-nums">
                    ${inPlayLoaded ? formatMoneyARS(user.balance + inPlayAmount) : formatMoneyARS(user.balance)}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-xs font-semibold tracking-wide text-zinc-200">
                ¿POR QUÉ USAR MERCADO PAGO?
              </div>
              <div className="mt-4 space-y-3 text-[13px] text-zinc-200">
                <div className="flex gap-3">
                  <div className="mt-0.5 text-lime-300">🔒</div>
                  <div>
                    <div className="font-semibold">Pagos 100% seguros</div>
                    <div className="text-[12px] text-zinc-400">Tus datos están protegidos.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5 text-lime-300">⚡</div>
                  <div>
                    <div className="font-semibold">Acreditación inmediata</div>
                    <div className="text-[12px] text-zinc-400">El saldo se refleja al instante.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5 text-lime-300">👥</div>
                  <div>
                    <div className="font-semibold">Miles de usuarios confían</div>
                    <div className="text-[12px] text-zinc-400">Plataforma líder en Argentina.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5 text-lime-300">✅</div>
                  <div>
                    <div className="font-semibold">Sin costos adicionales</div>
                    <div className="text-[12px] text-zinc-400">No cobramos comisiones.</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                    🛡️
                  </div>
                  <div className="text-[13px] font-semibold text-zinc-200">
                    PAGOS 100% SEGUROS
                  </div>
                </div>
                <div className="mt-3">
                  <Image
                    src="/MP_RGB_HANDSHAKE_color_horizontal.svg"
                    alt="Mercado Pago"
                    width={200}
                    height={40}
                  />
                </div>
                <div className="mt-3 text-[12px] text-zinc-400">
                  Tus transacciones están protegidas con los más altos estándares de seguridad.
                </div>
              </div>
            </Card>

            <Card className="border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 p-5">
              <div className="text-xs font-semibold tracking-wide text-zinc-200">
                ¿NECESITÁS AYUDA?
              </div>
              <div className="mt-3 text-[12px] text-zinc-400">
                Nuestro equipo está disponible 24/7 para ayudarte.
              </div>
              <button
                type="button"
                className={
                  (
                    "mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-lime-500/20 px-4 py-3 text-[15px] font-extrabold text-lime-200 ring-1 ring-lime-500/25 hover:bg-lime-500/25 " +
                    focusRing
                  ).trim()
                }
              >
                Ir a Soporte
              </button>
              <div className="mt-4 grid h-14 w-14 place-items-center rounded-full border border-zinc-800 bg-zinc-950/40 text-2xl">
                🎧
              </div>
            </Card>
          </div>
        }
      />
    </RequireAuth>
  );
}
