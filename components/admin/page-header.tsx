import type { ReactNode } from "react";

/** The title block at the top of every admin screen. */
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** The screen's main action, such as "Invite". */
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="text-display text-ink tablet:text-hero">{title}</h1>
        <p className="text-body-sm text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

/** The dashed "add another" tile that ends a grid of cards. */
export const ADD_TILE =
  "flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hairline p-4 text-body-sm font-bold text-muted transition-colors hover:border-primary hover:bg-surface hover:text-ink";
