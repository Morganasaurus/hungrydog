// iOS-style building blocks: grouped inset lists (like Settings), rows, segmented controls and TipKit-style tips.

import { useId, type ReactNode } from "react";
import type { Tip } from "../feeding/tips";

export function Group(props: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`group ${props.className ?? ""}`}>
      {props.title && <h2 className="group-title">{props.title}</h2>}
      <div className="group-body">{props.children}</div>
      {props.footer && <div className="group-footer">{props.footer}</div>}
    </section>
  );
}

/** One row of a grouped list: label on the left, control on the right. */
export function Row(props: { label: ReactNode; htmlFor?: string; children?: ReactNode; stacked?: boolean }) {
  return (
    <div className={props.stacked ? "list-row stacked" : "list-row"}>
      {props.htmlFor ? (
        <label className="row-label" htmlFor={props.htmlFor}>
          {props.label}
        </label>
      ) : (
        <span className="row-label">{props.label}</span>
      )}
      {props.children}
    </div>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Show the label as a row label (compact) or hide it visually (full-width control). */
  full?: boolean;
}) {
  const id = useId();
  const control = (
    <div className={props.full ? "segmented full" : "segmented"} role="radiogroup" aria-labelledby={id}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          className={props.value === o.value ? "active" : undefined}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  return (
    <div className={props.full ? "list-row stacked" : "list-row"}>
      <span className={props.full ? "row-label visually-hidden" : "row-label"} id={id}>
        {props.label}
      </span>
      {control}
    </div>
  );
}

export function NumberRow(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Row label={props.label} htmlFor={id}>
      <span className={props.invalid ? "value-input invalid" : "value-input"}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          maxLength={8}
          placeholder={props.placeholder}
          value={props.value}
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        />
        {props.unit && <span className="unit">{props.unit}</span>}
      </span>
    </Row>
  );
}

export function SelectRow(props: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <Row label={props.label} htmlFor={id}>
      <select id={id} className="row-select" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.children}
      </select>
    </Row>
  );
}

/** A TipKit-style card: icon, bold title, a few short lines, sources. */
export function TipCard({ tip, icon = "lightbulb" }: { tip: Tip; icon?: "lightbulb" | "calendar" | "heart" }) {
  return (
    <aside className="tip" aria-label={tip.title}>
      <span className={`tip-icon ${icon}`} aria-hidden="true" />
      <div className="tip-body">
        <h3>{tip.title}</h3>
        <p>{tip.lines[0]}</p>
        {tip.caution && <p className="tip-caution">{tip.caution}</p>}
        <details className="tip-more">
          <summary>Learn More</summary>
          {tip.lines.slice(1).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {tip.sources.length > 0 && (
            <p className="tip-sources">
              Source{tip.sources.length > 1 ? "s" : ""}:{" "}
              {tip.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                </span>
              ))}
            </p>
          )}
        </details>
      </div>
    </aside>
  );
}
