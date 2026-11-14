import type { Note, Plan, PlanItem } from "../feeding/plan";

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1.25 → "1¼", 0.5 → "½". */
export function quarters(n: number): string {
  const whole = Math.floor(n);
  const frac = FRACTIONS[Math.round((n - whole) * 100) / 100] ?? "";
  return whole === 0 && frac ? frac : `${whole}${frac}`;
}

function foodName(i: PlanItem) {
  return [i.food.brand, i.food.name].filter(Boolean).join(" ");
}

function Amount({ item, meals, mixed }: { item: PlanItem; meals: number; mixed: boolean }) {
  const pkg = item.food.package;
  return (
    <div className="amount">
      <div className="amount-head">
        <span className="amount-food">{foodName(item)}</span>
        <span className={`chip ${item.food.type}`}>
          {item.food.type}
          {mixed && ` · ${Math.round(item.share * 100)}%`}
        </span>
      </div>
      <p className="grams">
        {item.gramsPerDay}
        <span className="grams-unit"> g</span>
        <span className="grams-per"> a day</span>
      </p>
      <p className="per-meal">
        {meals > 1 ? `${item.gramsPerMeal} g × ${meals} meals` : "In one meal"}
        {pkg && item.packagesPerDay !== undefined && item.packagesPerDay > 0 && (
          <>
            {" · "}about {quarters(item.packagesPerDay)} {item.packagesPerDay > 1 ? `${pkg.label}s` : pkg.label}
          </>
        )}
      </p>
    </div>
  );
}

function Notes({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <ul className="notes">
      {notes.map((n, i) => (
        <li key={i} className={`note ${n.level}`}>
          {n.text}
        </li>
      ))}
    </ul>
  );
}

export function Result({ plan, meals, empty }: { plan: Plan | null; meals: number; empty: string | null }) {
  if (empty || !plan) {
    return (
      <section className="summary placeholder" aria-live="polite">
        <img src="/icon.svg" alt="" width={96} height={96} />
        <p>{empty}</p>
      </section>
    );
  }
  if (!plan.ok) {
    return (
      <section className="summary" aria-live="polite">
        <h2 className="summary-title">Can't work this out yet</h2>
        <Notes notes={plan.notes} />
      </section>
    );
  }

  const mixed = plan.items.length > 1;
  const labelNotes = plan.items.flatMap((i) => (i.food.labelNotes ?? []).map((t) => ({ food: foodName(i), t })));
  const warns = plan.notes.filter((n) => n.level !== "info");
  const infos = plan.notes.filter((n) => n.level === "info");

  return (
    <section className="summary" aria-live="polite">
      <h2 className="summary-title">{plan.goal === "grow" ? "Feed your puppy" : "Feed your dog"}</h2>
      {plan.items.map((i) => (
        <Amount key={i.food.id} item={i} meals={meals} mixed={mixed} />
      ))}
      {plan.totalKcal !== undefined && <p className="kcal">About {plan.totalKcal.toLocaleString()} kcal a day in total</p>}
      <Notes notes={warns} />
      <Notes notes={infos} />

      <details className="how">
        <summary>How we worked this out</summary>
        <ul>
          {plan.items.map((i) => (
            <li key={i.food.id}>
              <strong>{foodName(i)}:</strong> {i.how}
              {mixed && ` A full day of this food alone would be ${i.fullDayGrams} g; you're feeding ${Math.round(i.share * 100)}% of that.`}
            </li>
          ))}
          {mixed && (
            <li>
              Two foods are split by share of the day's energy, not by weight. Wet food has far fewer calories per gram,
              so it takes more grams to make up its share.
            </li>
          )}
        </ul>
        {labelNotes.length > 0 && (
          <>
            <h3>From the label</h3>
            <ul>
              {labelNotes.map((n, i) => (
                <li key={i}>
                  {mixed && <strong>{n.food}: </strong>}
                  {n.t}
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  );
}
