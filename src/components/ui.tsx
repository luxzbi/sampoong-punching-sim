import React from 'react';

export function Card({
  title,
  children,
  right
}: {
  title?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="card">
      {title && (
        <div className="section-title">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Slider({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  hint,
  digits = 0
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  hint?: string;
  digits?: number;
}) {
  return (
    <div className="field" style={{ opacity: disabled ? 0.5 : 1 }}>
      <div className="field-head">
        <span className="field-label">{label}</span>
        <span className="field-value">
          {value.toLocaleString('ko-KR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
          })}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
  hint
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <div className="toggle-row">
        <span className="field-label">{label}</span>
        <div
          className={`switch${value ? ' on' : ''}`}
          role="switch"
          aria-checked={value}
          tabIndex={0}
          onClick={() => onChange(!value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onChange(!value);
          }}
        >
          <i />
        </div>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      {label && (
        <div className="field-head">
          <span className="field-label">{label}</span>
        </div>
      )}
      <div className="seg">
        {options.map((o) => (
          <button
            key={o.value}
            className={value === o.value ? 'on' : ''}
            onClick={() => onChange(o.value)}
            type="button"
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export const num = (n: number, digits = 2) =>
  n.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
