import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

type Variant = "primary" | "secondary";

type CommonProps = {
  variant?: Variant;
  asChild?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button(props: CommonProps & ComponentPropsWithoutRef<"button">) {
  const {
    variant = "primary",
    asChild,
    className,
    children,
    ...rest
  } = props;

  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      : "border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-50 dark:hover:bg-zinc-900";

  const mergedClassName = `${base} ${styles} ${className ?? ""}`.trim();

  if (asChild) {
    if (!isValidElement(children)) return null;
    const el = children as ReactElement<{ className?: string }>;
    return cloneElement(el, {
      className: `${mergedClassName} ${el.props.className ?? ""}`.trim(),
    });
  }

  return (
    <button {...rest} className={mergedClassName}>
      {children}
    </button>
  );
}
