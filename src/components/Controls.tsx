import { useId, type ReactNode } from "react";

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {props.label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? "seg on" : "seg"}
            onClick={() => props.onChange(o.value)}
          >
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NumberField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder?: string;
  hint?: ReactNode;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      <div className={props.invalid ? "input-unit invalid" : "input-unit"}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          maxLength={8}
          placeholder={props.placeholder}
          value={props.value}
          aria-invalid={props.invalid || undefined}
          aria-describedby={props.hint ? `${id}-hint` : undefined}
          onChange={(e) => props.onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        />
        {props.unit && <span className="unit">{props.unit}</span>}
      </div>
      {props.hint && (
        <p className="hint" id={`${id}-hint`}>
          {props.hint}
        </p>
      )}
    </div>
  );
}

export function Card(props: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{props.title}</h2>
        {props.aside}
      </header>
      {props.children}
    </section>
  );
}
