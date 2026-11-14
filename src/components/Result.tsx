import { NUTRIENT_NAME, type Condition } from "../feeding/conditions";
import { nutrientSummary, overLimit } from "../feeding/nutrients";
import type { Note, Plan, PlanItem } from "../feeding/plan";
import type { NutrientId } from "../feeding/types";

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

/** A nutrient that matters for the dog's condition: the day's total, per 1,000 kcal, and the vet's limit. */
function NutrientLine({ plan, id, limitMg }: { plan: Plan; id: NutrientId; limitMg?: number }) {
  const s = nutrientSummary(plan, id);
  if (!s) return null;
  const name = NUTRIENT_NAME[id];
  if (s.mgPerDay === undefined)
    return (
      <p className="nutrient">
        <strong>{name}:</strong> not known for {s.missing.join(" and ")}, so there's no daily total.
      </p>
    );
  const about = s.atLeast && !s.atMost ? "at least" : s.atMost && !s.atLeast ? "up to" : "about";
  const over = overLimit(s, limitMg ?? NaN);
  const notes: Note[] = [];
  if (s.atLeast && s.atMost)
    notes.push({ level: "info", text: `Some ${name.toLowerCase()} figures are minimums and some maximums, so this total is rough.` });
  if (over)
    notes.push({
      level: "warn",
      text: `${s.atMost && !s.atLeast ? "That may be over" : "That's over"} your vet's limit of ${limitMg!.toLocaleString()} mg a day. Check with your vet before changing foods or amounts.`,
    });
  else if (over === false)
    notes.push({
      level: "info",
      text: s.atLeast
        ? `Within your vet's limit of ${limitMg!.toLocaleString()} mg a day on these figures, but a label minimum means the real amount may be higher.`
        : `Within your vet's limit of ${limitMg!.toLocaleString()} mg a day.`,
    });
  return (
    <>
      <p className="nutrient">
        <strong>{name}:</strong> {about} {s.mgPerDay.toLocaleString()} mg a day
        {s.gPer1000kcal !== undefined && ` · ${s.gPer1000kcal.toFixed(2)} g per 1,000 kcal`}
      </p>
      <Notes notes={notes} />
    </>
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

export function Result({
  plan,
  meals,
  empty,
  condition,
  limits,
}: {
  plan: Plan | null;
  meals: number;
  empty: string | null;
  /** The dog's health condition, if any: shows its nutrients. */
  condition?: Condition;
  /** Daily limits from the owner's vet, mg. */
  limits?: Partial<Record<NutrientId, number>>;
}) {
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
      {condition?.nutrients.map((id) => (
        <NutrientLine key={id} plan={plan} id={id} limitMg={limits?.[id]} />
      ))}
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
