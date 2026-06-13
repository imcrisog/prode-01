"use client";

import { useEffect, useState, type ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: ReactNode;
  active?: boolean;
};

export function DashboardShell({
  brand,
  navItems,
  topNav,
  left,
  center,
  right,
  topRight,
}: {
  brand: ReactNode;
  navItems: NavItem[];
  topNav: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  topRight?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 [background-image:radial-gradient(circle_at_0%_0%,rgba(132,204,22,0.12),transparent_45%),radial-gradient(circle_at_90%_15%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.08),transparent_50%)]">
      {/* Frame (para que el layout no quede “pegado” a los bordes como en la 1ra captura) */}
      <div className="mx-auto w-full max-w-[1520px] px-4 py-6">
        <div className="rounded-[40px] border border-zinc-800/90 bg-zinc-950/55 shadow-[0_0_0_1px_rgba(24,24,27,0.35),0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur">
          {/* Topbar (no sticky, para poder mantener el frame redondeado) */}
          <header className="z-30 rounded-t-[40px] border-b border-zinc-800/80 bg-zinc-950/55 backdrop-blur">
            <div className="flex w-full items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                {/* Mobile menu button */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <span className="text-lg leading-none">☰</span>
                </button>
                {brand}
              </div>
              <div className="hidden items-center gap-6 lg:flex">{topNav}</div>
              <div className="flex items-center gap-3">{topRight}</div>
            </div>
          </header>

          {/* Mobile drawer */}
          <div
            className={
              (
                "fixed inset-0 z-50 lg:hidden " +
                (mobileOpen ? "pointer-events-auto" : "pointer-events-none")
              ).trim()
            }
            aria-hidden={!mobileOpen}
          >
            <div
              className={
                (
                  "absolute inset-0 bg-black/60 transition-opacity duration-200 " +
                  (mobileOpen ? "opacity-100" : "opacity-0")
                ).trim()
              }
              onClick={() => setMobileOpen(false)}
            />
            <aside
              className={
                (
                  "absolute left-0 top-0 h-full w-[320px] max-w-[86vw] transform transition-transform duration-200 " +
                  (mobileOpen ? "translate-x-0" : "-translate-x-full")
                ).trim()
              }
            >
              <div className="h-full rounded-r-[32px] border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-4">
                  <div className="min-w-0">{brand}</div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900"
                    aria-label="Cerrar menú"
                  >
                    ✕
                  </button>
                </div>

                <div className="h-[calc(100dvh-74px)] overflow-auto p-3">
                  <nav className="space-y-1">
                    {navItems.map((it) => (
                      <a
                        key={it.href}
                        href={it.href}
                        onClick={() => setMobileOpen(false)}
                        className={
                          (
                            "group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors " +
                            (it.active
                              ? "bg-gradient-to-r from-lime-500/18 to-lime-500/5 text-lime-100 ring-1 ring-lime-500/25"
                              : "text-zinc-200 hover:bg-zinc-800/35 hover:text-zinc-50")
                          ).trim()
                        }
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={
                              (
                                "text-zinc-400 transition-colors " +
                                (it.active ? "text-lime-300" : "group-hover:text-zinc-200")
                              ).trim()
                            }
                          >
                            {it.icon}
                          </span>
                          {it.label}
                        </span>
                        {it.badge ? <span>{it.badge}</span> : null}
                      </a>
                    ))}
                  </nav>

                  <div className="mt-4 border-t border-zinc-800/80 pt-4">{left}</div>
                </div>
              </div>
            </aside>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[280px_1fr_360px] lg:gap-6 lg:p-6">
            {/* Left sidebar */}
            <aside className="hidden lg:block lg:h-[calc(100dvh-170px)]">
              <div className="h-full overflow-hidden rounded-[32px] border border-zinc-800/80 bg-gradient-to-b from-zinc-900/35 to-zinc-950/35">
                {/* Sidebar scroll: evita recortes en pantallas bajas */}
                <div className="h-full overflow-auto p-3 pb-6">
                  <nav className="space-y-1">
                    {navItems.map((it) => (
                      <a
                        key={it.href}
                        href={it.href}
                        className={
                          (
                            "group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors " +
                            (it.active
                              ? "bg-gradient-to-r from-lime-500/18 to-lime-500/5 text-lime-100 ring-1 ring-lime-500/25"
                              : "text-zinc-200 hover:bg-zinc-800/35 hover:text-zinc-50")
                          ).trim()
                        }
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={
                              (
                                "text-zinc-400 transition-colors " +
                                (it.active ? "text-lime-300" : "group-hover:text-zinc-200")
                              ).trim()
                            }
                          >
                            {it.icon}
                          </span>
                          {it.label}
                        </span>
                        {it.badge ? <span>{it.badge}</span> : null}
                      </a>
                    ))}
                  </nav>
                  <div className="mt-3 border-t border-zinc-800/80 pt-3">{left}</div>
                </div>
              </div>
            </aside>

            {/* Center content */}
            <main className="min-w-0 space-y-4">{center}</main>

            {/* Right rail */}
            {/* Nota: evitamos scroll interno para que no se vea “feíto” en pantallas bajas (doble scrollbar). */}
            <aside className="space-y-4 lg:pb-6">
              {right}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
