import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>
      {children}
    </div>
  );
}
