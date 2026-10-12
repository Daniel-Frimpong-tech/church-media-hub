import type { ReactNode } from "react";

export type BarRow = {
  label: string;
  value: number;
  /** Optional element before the label, such as an avatar. */
  lead?: ReactNode;
};

/**
 * Horizontal bars for comparing a handful of named things. The value is
 * written at the end of every row, so nothing depends on judging bar lengths.
 */
export function BarList({
  rows,
  unit,
  emptyText,
}: {
  rows: BarRow[];
  unit: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-muted">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-body-sm text-ink">
              {row.lead}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="text-body-sm font-bold text-ink tabular-nums">
              {row.value.toLocaleString("en-US")}
              <span className="sr-only"> {unit}</span>
            </span>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              style={{
                width: `${Math.max((row.value / max) * 100, 2)}%`,
                animationDelay: `${index * 60}ms`,
              }}
              className="h-full origin-left animate-grow-x rounded-full bg-primary"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
