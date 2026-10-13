import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A surface one step lighter than the page. No border: depth is the step. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface p-4 tablet:p-6",
        className,
      )}
      {...props}
    />
  );
}
