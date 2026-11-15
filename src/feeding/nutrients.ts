// Daily nutrient totals for a plan (phosphorus for kidney disease). Pure, so it can be tested by hand.
//
//   mg a day     = Σ grams a day × percent as fed × 10      (1% of 1 g is 10 mg)
//   g per 1000 kcal = (mg a day ÷ 1000) ÷ (kcal a day ÷ 1000)
//
// Per 1,000 kcal is how vets compare foods: it doesn't change with how much is fed.

import type { Note, Plan } from "./plan";
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

/**
 * Phosphorus guide figures, g per 1,000 kcal. There is no official target for a dog's diet (IRIS gives blood
 * phosphate targets only), so these are shown as typical ranges, and the vet's own limit always comes first.
 * - Typical therapeutic kidney diets: 0.4–1.2 (Cline, ACVN Nutrition Notes, Today's Veterinary Practice 2016, Table 2).
 * - Adult maintenance minimum: 1.0 (FEDIAF Nutritional Guidelines 2025, Table III-3b, at 110 kcal/kg^0.75).
 * - Ordinary maintenance foods usually exceed 1.5 (Cline 2016, "Dietary Phosphorus").
 */
export const PHOSPHORUS_GUIDE = { kidneyDiet: [0.4, 1.2] as const, adultMinimum: 1.0, maintenanceUsually: 1.5 };

export interface PhosphorusComparison {
  band: "below" | "kidney-diet" | "above";
  /** False when a label minimum or maximum means the true figure could fall in another band. */
  certain: boolean;
}

/** Where the plan's g per 1,000 kcal sits against the typical kidney-diet range. */
export function comparePhosphorus(s: NutrientSummary | undefined): PhosphorusComparison | undefined {
  if (!s || s.mgExact === undefined || s.gPer1000kcal === undefined) return undefined;
  const g = s.gPer1000kcal;
  const [lo, hi] = PHOSPHORUS_GUIDE.kidneyDiet;
  const band = g < lo ? "below" : g <= hi ? "kidney-diet" : "above";
  // A minimum can only be higher in truth, a maximum only lower: the band is certain unless that could move it.
  const couldRise = s.atLeast && band !== "above";
  const couldFall = s.atMost && band !== "below";
  return { band, certain: !couldRise && !couldFall };
}

/**
 * The owner-facing note placing the plan against the typical kidney-diet range. Always "info": it's general
 * guidance, not a threshold (only the vet's limit warns). When a label minimum or maximum could move the plan into
 * another band, it says so and why.
 */
export function phosphorusGuideNote(s: NutrientSummary | undefined): Note | undefined {
  const cmp = comparePhosphorus(s);
  if (!s || !cmp) return undefined;
  const [lo, hi] = PHOSPHORUS_GUIDE.kidneyDiet;
  const range = `${lo}–${hi} g per 1,000 kcal`;
  const why =
    s.atLeast && s.atMost
      ? "some label figures are minimums and some maximums, so the real amount may differ"
      : s.atLeast
        ? "a label minimum means the real amount may be higher"
        : "a label maximum means the real amount may be lower";
  const text = {
    "kidney-diet": cmp.certain
      ? `That's within the range typical of kidney diets (${range}).`
      : `On these figures that's within the range typical of kidney diets (${range}), but ${why}.`,
    above: cmp.certain
      ? `That's more than a typical kidney diet (${range}). Ask your vet whether it suits your dog.`
      : `That may be more than a typical kidney diet (${range}): ${why}. Ask your vet whether it suits your dog.`,
    below: cmp.certain
      ? `That's below the range typical of kidney diets (${range}). Ask your vet if you're unsure.`
      : `On these figures that's below the range typical of kidney diets (${range}), but ${why}.`,
  }[cmp.band];
  return { level: "info", text };
}
