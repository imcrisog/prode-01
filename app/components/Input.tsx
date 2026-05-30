import type { ComponentProps } from "react";

export function Input({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
      <input
        {...props}
        className={
          `mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ` +
          `focus:ring-2 focus:ring-zinc-400 dark:border-zinc-800 dark:bg-black ${
            className ?? ""
          }`
        }
      />
    </label>
  );
}
