import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function Card({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={
        (
          "rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black " +
          (className ?? "")
        ).trim()
      }
      {...props}
    >
      {children}
    </div>
  );
}
