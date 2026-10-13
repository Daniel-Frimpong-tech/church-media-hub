import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[background-color,transform,border-color,color] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
  secondary:
    "border border-border-strong bg-transparent text-ink hover:border-ink hover:bg-surface-strong disabled:border-hairline disabled:text-muted-soft",
  ghost:
    "text-ink-soft hover:bg-surface-strong hover:text-ink disabled:text-muted-soft",
  danger:
    "border border-danger/60 bg-transparent text-danger hover:bg-danger-soft disabled:border-hairline disabled:text-muted-soft",
};

// md is the 48px touch target used for anything tapped on a phone.
const sizes: Record<Size, string> = {
  md: "h-12 px-6 text-body-sm",
  sm: "h-9 px-4 text-caption",
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
