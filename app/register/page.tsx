"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "../components/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwRules = useMemo(() => {
    const pw = password;
    const minLen = pw.length >= 8;
    const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(pw);
    return { minLen, hasUpper, hasNumber, hasSpecial };
  }, [password]);

  const isValid = useMemo(
    () =>
      name.trim().length >= 2 &&
      email.trim().length > 3 &&
      password.trim().length >= 8 &&
      password2 === password &&
      acceptTerms,
    [acceptTerms, email, name, password, password2],
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
              REGISTRATE Y
              <span className="block text-lime-300">GANÁ MÁS.</span>
            </div>
            <p className="mt-3 max-w-lg text-[14px] text-zinc-300">
              Unite a PRODE y accedé a los mejores pronósticos, estadísticas y cuotas para ganar
              todos los días.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              {
                title: "Pronósticos inteligentes",
                desc: "Análisis y estadísticas avanzadas para mejores decisiones.",
                icon: "📈",
              },
              {
                title: "Apuestas seguras",
                desc: "Plataforma 100% segura y regulada para que juegues tranquilo.",
                icon: "🛡️",
              },
              {
                title: "Las mejores cuotas",
                desc: "Compará y encontrá las mejores oportunidades del mercado.",
                icon: "🏆",
              },
              {
                title: "Bonos exclusivos",
                desc: "Recibí bonos de bienvenida y promociones especiales.",
                icon: "🎁",
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

        {/* Right register card */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[28px] border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-black/60 p-6 shadow-[0_0_0_1px_rgba(24,24,27,0.6),0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="space-y-2 text-center">
              <div className="text-2xl font-extrabold">
                Creá <span className="text-lime-300">tu cuenta</span>
              </div>
              <div className="text-[13px] text-zinc-400">Es rápido, fácil y seguro</div>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-zinc-950 ring-1 ring-white/30 hover:bg-zinc-100"
              onClick={() => setError("Registro con Google: pendiente en demo")}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
                <span className="text-base">G</span>
              </span>
              Registrarme con Google
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
                    if (password2 !== password) {
                      throw new Error("Las contraseñas no coinciden");
                    }
                    if (!acceptTerms) {
                      throw new Error("Tenés que aceptar los términos para continuar");
                    }

                    const res = await fetch("/api/auth/register", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        name: name.trim(),
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
                <div className="text-[13px] text-zinc-300">Nombre de usuario</div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 ring-1 ring-transparent focus-within:ring-lime-500/20">
                  <span className="text-zinc-500">👤</span>
                  <input
                    className="w-full bg-transparent text-[13px] text-zinc-50 outline-none placeholder:text-zinc-600"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="Elegí un nombre de usuario"
                  />
                </div>
              </label>

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
                    autoComplete="new-password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
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

              <label className="block">
                <div className="text-[13px] text-zinc-300">Repetir contraseña</div>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 ring-1 ring-transparent focus-within:ring-lime-500/20">
                  <span className="text-zinc-500">🔒</span>
                  <input
                    className="w-full bg-transparent text-[13px] text-zinc-50 outline-none placeholder:text-zinc-600"
                    type={showPassword2 ? "text" : "password"}
                    autoComplete="new-password"
                    value={password2}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword2(e.target.value)}
                    placeholder="Repetí tu contraseña"
                  />
                  <button
                    type="button"
                    className="text-zinc-500 hover:text-zinc-300"
                    onClick={() => setShowPassword2((v) => !v)}
                    aria-label={showPassword2 ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    👁
                  </button>
                </div>
              </label>

              <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-[12px]">
                {[
                  { ok: pwRules.minLen, label: "Mínimo 8 caracteres" },
                  { ok: pwRules.hasUpper, label: "Al menos una mayúscula" },
                  { ok: pwRules.hasNumber, label: "Al menos un número" },
                  { ok: pwRules.hasSpecial, label: "Al menos un carácter especial" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span
                      className={
                        r.ok
                          ? "text-lime-300"
                          : "text-zinc-600"
                      }
                    >
                      {r.ok ? "✓" : "○"}
                    </span>
                    <span className={r.ok ? "text-zinc-200" : "text-zinc-500"}>
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/30 px-4 py-3 text-[12px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-lime-500"
                />
                <span>
                  Acepto los{" "}
                  <span className="font-semibold text-lime-300">Términos y Condiciones</span> y la{" "}
                  <span className="font-semibold text-lime-300">Política de Privacidad</span>
                </span>
              </label>

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
                Crear cuenta
              </Button>

              <div className="text-center text-[13px] text-zinc-300">
                ¿Ya tenés cuenta?{" "}
                <Link className="font-semibold text-lime-300 hover:underline" href="/login">
                  Iniciá sesión
                </Link>
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
