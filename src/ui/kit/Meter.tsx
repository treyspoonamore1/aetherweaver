/** A thin progress bar. Layers (shield, forecast) are drawn by the caller on top. */
export function Meter({
  value,
  max,
  color,
  label,
  className = '',
  height = 'h-2.5',
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  className?: string;
  height?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={`relative overflow-hidden rounded-full bg-ink-700 ${height} ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-linear"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
