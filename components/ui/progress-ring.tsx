/**
 * A ring that fills as a share of something is done, e.g. "3 of 5 tasks".
 * The numbers are always written next to it; the ring is the glanceable part.
 */
export function ProgressRing({
  done,
  total,
  size = 44,
  label,
}: {
  done: number;
  total: number;
  size?: number;
  /** What the ring measures, for screen readers: "Tasks done". */
  label: string;
}) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = total === 0 ? 0 : Math.min(done / total, 1);
  const complete = total > 0 && done >= total;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label}: ${done} of ${total}`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-surface-strong"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - share)}
        className={
          complete
            ? "stroke-success transition-[stroke-dashoffset] duration-700"
            : "stroke-primary transition-[stroke-dashoffset] duration-700"
        }
      />
    </svg>
  );
}
