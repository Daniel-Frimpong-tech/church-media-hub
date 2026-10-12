import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Flat, hairline-bordered surface. Depth comes from photos, not shadows. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-canvas p-4 tablet:p-6",
        className,
      )}
      {...props}
    />
  );
}
