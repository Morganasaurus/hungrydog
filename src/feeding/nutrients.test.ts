import { describe, expect, it } from "vitest";
import blackHawkJson from "../data/foods/black-hawk-original-lamb-rice-adult.json";
import renalDryJson from "../data/foods/royal-canin-renal-dry.json";
import renalWetJson from "../data/foods/royal-canin-renal-wet.json";
import { MIN_LIMIT_MG, parseMg } from "../state";
import { comparePhosphorus, nutrientSummary, overLimit, phosphorusGuideNote } from "./nutrients";
import { makePlan, type Plan, type PlanItem } from "./plan";
import type { Food } from "./types";
import { validateFood } from "./validate";

const food = (id: string, type: Food["type"], kcalPer100g: number, phosphorus?: Food["nutrients"]): Food => ({
  id,
  brand: "B",
  name: id,
  type,
  energy: { kcalPer100g },
  nutrients: phosphorus,
  source: { kind: "label", addedOn: "2026-01-01" },
});
const item = (f: Food, gramsPerDay: number): PlanItem => ({
  food: f,
  share: 1,
  fullDayGrams: gramsPerDay,
  gramsPerDay,
  gramsPerMeal: gramsPerDay / 2,
  kcalPerDay: (gramsPerDay * f.energy!.kcalPer100g) / 100,
  method: "label",
  how: "",
});
const plan = (...items: PlanItem[]): Plan => ({
  ok: true,
  goal: "maintain",
  items,
  totalKcal: items.reduce((s, i) => s + (i.kcalPerDay ?? 0), 0),
  notes: [],
});

const dry = food("dry", "dry", 400, { phosphorus: { percent: 0.5, kind: "typical" } });
const wet = food("wet", "wet", 100, { phosphorus: { percent: 0.15, kind: "typical" } });
const unknown = food("unknown", "wet", 100);

describe("phosphorus totals", () => {
  it("one food: 300 g at 0.5% is 1,500 mg; over 1,200 kcal that's 1.25 g per 1,000 kcal", () => {
    const s = nutrientSummary(plan(item(dry, 300)), "phosphorus")!;
    expect(s.mgPerDay).toBe(1500);
    expect(s.gPer1000kcal).toBe(1.25);
    expect(s.missing).toEqual([]);
  });

  it("two foods add up: 150 g × 0.5% + 400 g × 0.15% = 750 + 600 mg over 1,000 kcal", () => {
    const s = nutrientSummary(plan(item(dry, 150), item(wet, 400)), "phosphorus")!;
    expect(s.mgPerDay).toBe(1350);
    expect(s.gPer1000kcal).toBe(1.35);
  });

  it("rounds the day to 10 mg: 155 g × 0.5% = 775 mg → 780", () => {
    expect(nutrientSummary(plan(item(dry, 155)), "phosphorus")!.mgPerDay).toBe(780);
  });

  it("gives no total when a food has no figure, and names it", () => {
    const s = nutrientSummary(plan(item(dry, 150), item(unknown, 400)), "phosphorus")!;
    expect(s.mgPerDay).toBeUndefined();
    expect(s.missing).toEqual(["B unknown"]);
  });

  it("marks label minimums and maximums", () => {
    const min = food("min", "dry", 400, { phosphorus: { percent: 0.5, kind: "min" } });
    const max = food("max", "dry", 400, { phosphorus: { percent: 0.5, kind: "max" } });
    expect(nutrientSummary(plan(item(min, 100)), "phosphorus")).toMatchObject({ atLeast: true, atMost: false });
    expect(nutrientSummary(plan(item(max, 100)), "phosphorus")).toMatchObject({ atLeast: false, atMost: true });
  });

  it("gives nothing for a plan that couldn't be worked out", () => {
    expect(nutrientSummary({ ok: false, goal: "maintain", items: [], notes: [] }, "phosphorus")).toBeUndefined();
  });

  it("compares with the vet's limit only when there is one", () => {
    const s = nutrientSummary(plan(item(dry, 300)), "phosphorus");
    expect(overLimit(s, 1400)).toBe(true);
    expect(overLimit(s, 1500)).toBe(false);
    expect(overLimit(s, NaN)).toBeUndefined();
    expect(overLimit(s, 0)).toBeUndefined();
  });
});

describe("nutrient data checks", () => {
  const ok = { ...dry, id: "ok" };
  it("accepts a valid figure and condition", () => expect(validateFood({ ...ok, forConditions: ["kidney"] })).toEqual([]));
  it("rejects a percent that's a unit slip", () =>
    expect(validateFood({ ...ok, nutrients: { phosphorus: { percent: 12, kind: "typical" } } })).toContain("nutrients.phosphorus.percent must be 0–5"));
  it("rejects an unknown kind", () =>
    expect(validateFood({ ...ok, nutrients: { phosphorus: { percent: 0.5, kind: "approx" } } })).toContain(
      "nutrients.phosphorus.kind must be typical, min or max",
    ));
  it("rejects nutrients we don't track", () =>
    expect(validateFood({ ...ok, nutrients: { sodium: { percent: 0.3, kind: "typical" } } })).toContain("nutrients.sodium isn't a nutrient we track"));
  it("rejects unknown conditions", () => expect(validateFood({ ...ok, forConditions: ["liver"] })).toContain("forConditions must list known conditions"));
});

describe("phosphorus with the real Royal Canin Renal files", () => {
  const renalDry = renalDryJson as Food;
  const renalWet = renalWetJson as Food;
  const adult30 = { stage: "adult" as const, currentKg: 30, targetKg: 30, activity: "typical" as const, meals: 2 };

  it("30 kg on Renal dry: 355 g × 0.2% = 710 mg; 710 ÷ 1,410 kcal = 0.50 g per 1,000 kcal", () => {
    const s = nutrientSummary(makePlan(adult30, [{ food: renalDry, share: 1 }]), "phosphorus")!;
    expect(s.mgPerDay).toBe(710);
    expect(s.gPer1000kcal).toBe(0.5);
  });

  it("30 kg on half Renal dry, half Renal Loaf: 175 g × 0.2% + 425 g × 0.11% = 350 + 467.5 mg → 820", () => {
    const p = makePlan(adult30, [
      { food: renalDry, share: 0.5 },
      { food: renalWet, share: 0.5 },
    ]);
    const s = nutrientSummary(p, "phosphorus")!;
    expect(p.items.map((i) => i.gramsPerDay)).toEqual([175, 425]);
    expect(s.mgPerDay).toBe(820);
    expect(s.mgExact).toBeCloseTo(817.5, 5);
  });
});

describe("the vet's limit", () => {
  it("compares the unrounded total: 817.5 mg is over 817 even though it shows as 820", () => {
    const s = { id: "phosphorus" as const, mgPerDay: 820, mgExact: 817.5, missing: [], atLeast: false, atMost: false };
    expect(overLimit(s, 817)).toBe(true);
    expect(overLimit(s, 818)).toBe(false);
  });

  it("reads '1,000' as a thousand mg, and flags gram-sized numbers", () => {
    expect(parseMg("1,000")).toBe(1000);
    expect(parseMg("850")).toBe(850);
    expect(parseMg("0.8")).toBeLessThan(MIN_LIMIT_MG);
  });
});

describe("phosphorus against the typical kidney-diet range (0.4–1.2 g per 1,000 kcal)", () => {
  const sum = (g: number, atLeast = false, atMost = false) =>
    ({ id: "phosphorus" as const, mgPerDay: 1, mgExact: 1, gPer1000kcal: g, missing: [], atLeast, atMost });
  it("0.50 is within; 1.2 is the top of the range; 1.21 is above; 0.39 is below", () => {
    expect(comparePhosphorus(sum(0.5))).toEqual({ band: "kidney-diet", certain: true });
    expect(comparePhosphorus(sum(1.2))?.band).toBe("kidney-diet");
    expect(comparePhosphorus(sum(1.21))?.band).toBe("above");
    expect(comparePhosphorus(sum(0.39))?.band).toBe("below");
  });
  it("a label minimum is only certain when already above the range", () => {
    expect(comparePhosphorus(sum(2.66, true))).toEqual({ band: "above", certain: true });
    expect(comparePhosphorus(sum(0.8, true))).toEqual({ band: "kidney-diet", certain: false });
  });
  it("a label maximum is only certain when already below the range", () => {
    expect(comparePhosphorus(sum(3.71, false, true))).toEqual({ band: "above", certain: false });
    expect(comparePhosphorus(sum(0.3, false, true))).toEqual({ band: "below", certain: true });
  });
  it("needs a total and the energy", () => {
    expect(comparePhosphorus({ id: "phosphorus", missing: ["X"], atLeast: false, atMost: false })).toBeUndefined();
    expect(comparePhosphorus(undefined)).toBeUndefined();
  });
});

describe("the phosphorus guide note", () => {
  const sum = (g: number, atLeast = false, atMost = false) =>
    ({ id: "phosphorus" as const, mgPerDay: 1, mgExact: 1, gPer1000kcal: g, missing: [], atLeast, atMost });

  it("is always information, never a warning", () => {
    for (const s of [sum(0.5), sum(3), sum(0.2), sum(0.8, true), sum(3, false, true)]) expect(phosphorusGuideNote(s)!.level).toBe("info");
  });
  it("says within, more than, or below the typical range", () => {
    expect(phosphorusGuideNote(sum(0.5))!.text).toBe("That's within the range typical of kidney diets (0.4–1.2 g per 1,000 kcal).");
    expect(phosphorusGuideNote(sum(2.66))!.text).toMatch(/^That's more than a typical kidney diet .* Ask your vet/);
    expect(phosphorusGuideNote(sum(0.3))!.text).toMatch(/^That's below the range typical of kidney diets/);
  });
  it("gives the right reason when a label figure could move it", () => {
    expect(phosphorusGuideNote(sum(0.8, true))!.text).toMatch(/within .* but a label minimum means the real amount may be higher/);
    expect(phosphorusGuideNote(sum(0.3, true))!.text).toMatch(/below .* but a label minimum means the real amount may be higher/);
    // A maximum inside the range could really be below it.
    expect(phosphorusGuideNote(sum(0.8, false, true))!.text).toMatch(/within .* but a label maximum means the real amount may be lower/);
    expect(phosphorusGuideNote(sum(3.71, false, true))!.text).toMatch(/^That may be more .*: a label maximum means the real amount may be lower/);
    expect(phosphorusGuideNote(sum(0.8, true, true))!.text).toMatch(/some label figures are minimums and some maximums/);
  });

  it("mixes Renal dry with Black Hawk at 20 kg: 130 g × 0.2% + 100 g × 1.4% (max) = 1,660 mg over 897 kcal", () => {
    const blackHawk = blackHawkJson as Food;
    const p = makePlan(
      { stage: "adult", currentKg: 20, targetKg: 20, activity: "typical", meals: 2 },
      [
        { food: renalDryJson as Food, share: 0.5 },
        { food: blackHawk, share: 0.5 },
      ],
    );
    expect(p.items.map((i) => i.gramsPerDay)).toEqual([130, 100]);
    const s = nutrientSummary(p, "phosphorus")!;
    expect(s.mgPerDay).toBe(1660);
    expect(p.totalKcal).toBe(897);
    expect(s.gPer1000kcal).toBe(1.85);
    expect(comparePhosphorus(s)).toEqual({ band: "above", certain: false });
    expect(phosphorusGuideNote(s)!.text).toMatch(/^That may be more than a typical kidney diet/);
  });
});
