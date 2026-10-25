import { useId } from 'react';

/** Labelled range input with a live value read-out. */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-3">
      <label htmlFor={id} className="text-sm text-text">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer"
      />
      <span className="text-right font-mono text-xs text-muted">{format(value)}</span>
    </div>
  );
}

/** On/off switch rendered as a real checkbox (role=switch). */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm text-text">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-hidden
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-200 ${
          checked ? 'border-gold-400 bg-gold-400/30' : 'border-ink-500 bg-ink-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
            checked ? 'left-5.5 bg-gold-300' : 'left-0.5 bg-muted'
          }`}
        />
      </label>
    </div>
  );
}

/** Pick one of a few values (assist levels). A radio group so arrow keys work. */
export function Segmented<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex items-center justify-between gap-4">
      <legend className="sr-only">{label}</legend>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-ink-500">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={`cursor-pointer px-3 py-1.5 text-xs font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-200 ${
                active ? 'bg-gold-400 text-ink-950' : 'bg-ink-800 text-muted hover:text-text'
              }`}
            >
              <input
                type="radio"
                name={id}
                className="sr-only"
                checked={active}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
