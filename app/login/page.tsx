"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "../components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isValid = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 4,
    [email, password]
  );

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50">
      {/* Background stadium */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(132,204,22,0.18),transparent_45%),radial-gradient(circle_at_65%_10%,rgba(34,197,94,0.10),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.12),transparent_50%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/85" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1200px] grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Left marketing */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-zinc-900/40 ring-1 ring-zinc-800">
              <Image
                src="/logo-prode.png"
                alt="PRODE"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <div className="text-2xl font-extrabold tracking-tight">PRODE</div>
              <div className="text-[12px] font-semibold tracking-wide text-lime-300">
                TU PASIÓN. TUS PRONÓSTICOS.
              </div>
            </div>
          </div>

          <div>
            <div className="text-4xl font-extrabold tracking-tight">
              JUGÁ INTELIGENTE.
              <span className="block text-lime-300">GANÁ MÁS.</span>
            </div>
            <p className="mt-3 max-w-lg text-[14px] text-zinc-300">
              Los mejores pronósticos, estadísticas y cuotas en un solo lugar.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: "Análisis inteligentes",
                desc: "Datos y estadísticas actualizadas para tomar mejores decisiones.",
                icon: "📊",
              },
              {
                title: "Apuestas seguras",
                desc: "Plataforma 100% segura y protegida para que juegues tranquilo.",
                icon: "🛡️",
              },
              {
                title: "Las mejores cuotas",
                desc: "Comparamos y te mostramos las mejores oportunidades de ganar.",
                icon: "🏆",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/20 p-4 backdrop-blur"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                  <span className="text-xl">{f.icon}</span>
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-zinc-50">{f.title}</div>
                  <div className="mt-1 text-[13px] text-zinc-400">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right login card */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-black/60 p-6 shadow-[0_0_0_1px_rgba(24,24,27,0.6),0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="space-y-2 text-center">
              <div className="text-2xl font-extrabold">¡Bienvenido de vuelta!</div>
              <div className="text-[13px] text-zinc-400">Iniciá sesión para continuar</div>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-zinc-950 ring-1 ring-white/30 hover:bg-zinc-100"
              onClick={() => setError("Login con Google: pendiente en demo")}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
                <span className="text-base">G</span>
              </span>
              Continuar con Google
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <div className="text-xs text-zinc-500">o</div>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);

                (async () => {
                  try {
                    // En esta demo el 'remember' no cambia la expiración,
                    // pero lo dejamos para respetar el diseño.
                    void remember;
                    const res = await fetch("/api/auth/login", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        email: email.trim().toLowerCase(),
                        password,
                      }),
                    });
                    if (!res.ok) throw new Error(await res.text());
                    router.push("/");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Error inesperado");
                  }
                })();
              }}
            >
              <label className="block">
                <div className="text-[13px] text-zinc-300">Correo electrónico</div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 ring-1 ring-transparent focus-within:ring-lime-500/20">
                  <span className="text-zinc-500">✉</span>
                  <input
                    className="w-full bg-transparent text-[13px] text-zinc-50 outline-none placeholder:text-zinc-600"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
              </label>

              <label className="block">
                <div className="text-[13px] text-zinc-300">Contraseña</div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 ring-1 ring-transparent focus-within:ring-lime-500/20">
                  <span className="text-zinc-500">🔒</span>
                  <input
                    className="w-full bg-transparent text-[13px] text-zinc-50 outline-none placeholder:text-zinc-600"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    👁
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3 text-[13px]">
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-lime-500"
                  />
                  Recordarme
                </label>
                <button
                  type="button"
                  className="font-semibold text-lime-300 hover:underline"
                  onClick={() => setError("Recuperar contraseña: pendiente en demo")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={!isValid}
                className="w-full !rounded-2xl !bg-lime-500/90 !py-3 !text-[13px] !font-extrabold !text-zinc-950 hover:!bg-lime-500 disabled:opacity-60"
              >
                Iniciar sesión
              </Button>

              <div className="text-center text-[13px] text-zinc-300">
                ¿No tenés cuenta?{" "}
                <Link className="font-semibold text-lime-300 hover:underline" href="/register">
                  Registrate
                </Link>
              </div>

              <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-[12px] text-zinc-300">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-500/10 text-lime-300 ring-1 ring-lime-500/20">
                    🔒
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-200">Tus datos están protegidos</div>
                    <div className="text-zinc-400">
                      Utilizamos encriptación SSL para garantizar la seguridad de tu información.
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-zinc-800/60 pt-6 text-center text-[12px] text-zinc-400 sm:grid-cols-3">
            <div>
              <div className="font-semibold text-zinc-200">Juego Responsable</div>
              <div>Jugá con moderación</div>
            </div>
            <div>
              <div className="font-semibold text-zinc-200">Seguridad</div>
              <div>Tus datos protegidos</div>
            </div>
            <div>
              <div className="font-semibold text-zinc-200">Soporte 24/7</div>
              <div>Estamos para ayudarte</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
