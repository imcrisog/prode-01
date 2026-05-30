import type { ReactNode } from "react";

export function AppShell({
  nav,
  children,
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          {nav}
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-4xl px-4 pb-10">
        <p className="text-xs text-zinc-500">
          Demo educativa — no usar en producción.
        </p>
      </footer>
    </div>
  );
}
