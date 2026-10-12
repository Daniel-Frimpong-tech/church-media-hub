import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary active:bg-primary-active disabled:bg-primary-disabled",
  secondary:
    "border border-ink bg-canvas text-ink active:bg-surface-strong disabled:border-hairline disabled:text-muted-soft",
  ghost:
    "text-ink underline-offset-4 active:bg-surface-strong disabled:text-muted-soft",
  danger:
    "border border-danger bg-canvas text-danger active:bg-danger-soft disabled:border-hairline disabled:text-muted-soft",
};

// md is the 48px touch target used for anything tapped on a phone.
const sizes: Record<Size, string> = {
  md: "h-12 px-6 text-body",
  sm: "h-9 px-4 text-body-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

/** The same look for a link, e.g. <Link className={buttonClasses()} />. */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
