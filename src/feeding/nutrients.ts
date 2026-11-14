// Daily nutrient totals for a plan (phosphorus for kidney disease). Pure, so it can be tested by hand.
//
//   mg a day     = Σ grams a day × percent as fed × 10      (1% of 1 g is 10 mg)
//   g per 1000 kcal = (mg a day ÷ 1000) ÷ (kcal a day ÷ 1000)
//
// Per 1,000 kcal is how vets compare foods: it doesn't change with how much is fed.

import type { Plan } from "./plan";
import type { NutrientId } from "./types";

export interface NutrientSummary {
  id: NutrientId;
  /** Daily total, rounded to 10 mg for display. Missing if any food in the plan has no figure. */
  mgPerDay?: number;
  /** The same total unrounded, for comparing with a limit. */
  mgExact?: number;
  /** Grams per 1,000 kcal, 2 decimal places. Needs every food's energy too. */
  gPer1000kcal?: number;
  /** Foods in the plan with no figure for this nutrient. */
  missing: string[];
  /** Some figure is a guaranteed minimum, so the real amount may be higher. */
  atLeast: boolean;
  /** Some figure is a guaranteed maximum, so the real amount may be lower. */
  atMost: boolean;
}

const foodName = (f: { brand: string; name: string }) => [f.brand, f.name].filter(Boolean).join(" ");

export function nutrientSummary(plan: Plan, id: NutrientId): NutrientSummary | undefined {
  if (!plan.ok || plan.items.length === 0) return undefined;
  const missing = plan.items.filter((i) => !i.food.nutrients?.[id]).map((i) => foodName(i.food));
  const kinds = plan.items.map((i) => i.food.nutrients?.[id]?.kind);
  const base = { id, missing, atLeast: kinds.includes("min"), atMost: kinds.includes("max") };
  if (missing.length) return base;

  const mg = plan.items.reduce((s, i) => s + i.gramsPerDay * i.food.nutrients![id]!.percent * 10, 0);
  return {
    ...base,
    mgPerDay: Math.round(mg / 10) * 10,
    mgExact: mg,
    gPer1000kcal: plan.totalKcal ? Math.round((mg / plan.totalKcal) * 100) / 100 : undefined,
  };
}

/** Over the vet's daily limit (mg)? Undefined when there's no limit or no total. */
export function overLimit(s: NutrientSummary | undefined, limitMg: number): boolean | undefined {
  if (!s || s.mgExact === undefined || !Number.isFinite(limitMg) || limitMg <= 0) return undefined;
  return s.mgExact > limitMg;
}
