"use client";

import { useState } from "react";
import { niceCeiling } from "@/lib/domain/analytics";
import { cn } from "@/lib/cn";

export type Column = {
  /** Short axis label, e.g. "Oct 5". */
  label: string;
  value: number;
  /** Longer description for the tooltip, e.g. "Week of Oct 5". */
  detail: string;
};

/**
 * A single-series column chart: thin columns rising from one baseline, a few
 * quiet gridlines, and a tooltip on hover, focus or tap. One hue, because the
 * only thing being compared is "how many".
 */
export function ColumnChart({
  columns,
  unit,
  caption,
  highlightLast = true,
}: {
  columns: Column[];
  /** What is being counted, e.g. "files". */
  unit: string;
  /** Read to screen-reader users as the table's caption. */
  caption: string;
  /** Draws the last column brighter: it is "this week". */
  highlightLast?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceCeiling(Math.max(...columns.map((column) => column.value), 0));
  const ticks = [top, top / 2, 0];
  const shown = active !== null ? columns[active] : null;

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-3">
        {/* Y axis: round numbers, right-aligned so the digits line up. */}
        <div
          aria-hidden
          className="flex h-40 flex-col justify-between text-right text-caption text-muted-soft tabular-nums"
        >
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {tick.toLocaleString("en-US")}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines sit behind the columns. */}
          <div aria-hidden className="absolute inset-0 flex h-40 flex-col justify-between">
            {ticks.map((tick) => (
              <span key={tick} className="h-px w-full bg-hairline" />
            ))}
          </div>

          <div
            className="relative flex h-40 items-end"
            onMouseLeave={() => setActive(null)}
          >
            {columns.map((column, index) => {
              const height = top === 0 ? 0 : (column.value / top) * 100;
              const isLast = index === columns.length - 1;
              return (
                // The whole slot is the hover target, far bigger than the bar.
                <button
                  key={column.label}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(index)}
                  aria-label={`${column.detail}: ${column.value.toLocaleString("en-US")} ${unit}`}
                  className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-xs outline-offset-0"
                >
                  <span
                    style={{ height: `${height}%`, animationDelay: `${index * 40}ms` }}
                    className={cn(
                      // Rounded at the data end, square on the baseline.
                      "w-full max-w-6 origin-bottom animate-grow-y rounded-t-xs transition-colors",
                      column.value === 0 && "min-h-px",
                      active === index
                        ? "bg-primary-active"
                        : highlightLast && isLast
                          ? "bg-primary"
                          : "bg-primary/55",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div aria-hidden className="mt-2 flex text-caption text-muted-soft">
            {columns.map((column, index) => (
              <span
                key={column.label}
                className={cn(
                  "min-w-0 flex-1 truncate text-center",
                  // On narrow screens show every other label so none collide.
                  index % 2 === (columns.length - 1) % 2 ? "" : "hidden tablet:block",
                  active === index && "text-ink",
                )}
              >
                {column.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip line: fixed height so the layout never jumps. */}
      <p aria-live="polite" className="h-5 text-body-sm text-ink-soft">
        {shown ? (
          <>
            <span className="font-bold text-ink tabular-nums">
              {shown.value.toLocaleString("en-US")}
            </span>{" "}
            {unit} · {shown.detail}
          </>
        ) : (
          <span className="text-muted-soft">Hover or tap a column for its number</span>
        )}
      </p>

      {/* The same data as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.label}>
              <th scope="row">{column.detail}</th>
              <td>{column.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
