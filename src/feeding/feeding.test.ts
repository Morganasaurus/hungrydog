import { describe, expect, it } from "vitest";
import demoDry from "../data/demo/demo-adult-dry.json";
import demoWet from "../data/demo/demo-adult-wet.json";
import orijen from "../data/foods/orijen-puppy-large.json";
import { adultKcal, puppyKcal, rer, toKcalPer100g } from "./energy";
import { customFood } from "./foods";
import { readAdultGuide, readPuppyGuide } from "./guide";
import { makePlan, roundGrams, roundQuarter, type DogInput } from "./plan";
import type { Food } from "./types";

const dry = demoDry as Food;
const wet = demoWet as Food;
const puppyLarge = orijen as Food;
const pg = puppyLarge.puppyGuide!;

const adult = (over: Partial<DogInput> = {}): DogInput => ({
  stage: "adult",
  currentKg: 10,
  targetKg: 10,
  activity: "typical",
  meals: 2,
  ...over,
});
const puppy = (currentKg: number, targetKg: number): DogInput => ({ stage: "puppy", currentKg, targetKg, activity: "typical", meals: 2 });

describe("energy", () => {
  it("RER is 70 × kg^0.75", () => expect(rer(10)).toBeCloseTo(393.6, 1));
  it("adult maintenance is 1.6 × RER, scaled for activity", () => {
    expect(adultKcal(10, "typical")).toBeCloseTo(629.8, 1);
    expect(adultKcal(10, "high")).toBeCloseTo(755.8, 1);
  });
  it("puppy energy follows the NRC growth formula", () => expect(puppyKcal(10, 40)).toBeCloseTo(1648, 0));
  it("converts label units to kcal per 100 g", () => {
    expect(toKcalPer100g(3800, "kcal/kg")).toBe(380);
    expect(toKcalPer100g(1600, "kJ/100g")).toBeCloseTo(382.4, 1);
    expect(toKcalPer100g(16000, "kJ/kg")).toBeCloseTo(382.4, 1);
  });
});

describe("rounding", () => {
  it("measures small amounts to the gram and larger ones to 5 g", () => {
    expect(roundGrams(43.4)).toBe(43);
    expect(roundGrams(222.5)).toBe(225);
    expect(roundGrams(123.75)).toBe(125);
  });
  it("rounds cans to quarters", () => expect(roundQuarter(0.4375)).toBe(0.5));
});

describe("adult label tables", () => {
  it("reads a row exactly and uses the middle of a range", () => {
    const r = readAdultGuide(dry.adultGuide!, 10);
    expect([r.low, r.high, r.grams, r.outside]).toEqual([150, 180, 165, null]);
  });
  it("reads between rows in a straight line", () => expect(readAdultGuide(dry.adultGuide!, 15).grams).toBeCloseTo(222.5));
  it("flags weights outside the table", () => {
    expect(readAdultGuide(dry.adultGuide!, 3).outside).toBe("below");
    expect(readAdultGuide(dry.adultGuide!, 50).outside).toBe("above");
  });
});

describe("Orijen Puppy Large table", () => {
  it("reads a cell exactly", () => expect(readPuppyGuide(pg, 10, 40).grams).toBe(270));
  it("reads between rows", () => expect(readPuppyGuide(pg, 25, 50).grams).toBe(465));
  it("reads between rows and columns", () => expect(readPuppyGuide(pg, 25, 45).grams).toBeCloseTo(442.5));
  it("holds a short column's last amount when reading between columns", () =>
    // 30 kg column ends at 30 kg (300 g); 40 kg column has 480 g at 30 kg; 20% of the way across.
    expect(readPuppyGuide(pg, 30, 32).grams).toBeCloseTo(336));
  it("follows the dip near adult size", () => expect(readPuppyGuide(pg, 39, 40).grams).toBeCloseTo(399));
  it("refuses puppies too small for the food", () => expect(readPuppyGuide(pg, 10, 20).problem).toBe("adult-below-table"));
  it("allows a little below the smallest column", () => expect(readPuppyGuide(pg, 10, 29).problem).toBeNull());
  it("uses the biggest column above the table and says so", () => {
    const r = readPuppyGuide(pg, 20, 90);
    expect(r.grams).toBe(450);
    expect(r.adultAboveTable).toBe(true);
  });
  it("scales down for puppies lighter than the first row", () => {
    const r = readPuppyGuide(pg, 3, 40);
    expect(r.grams).toBeCloseTo(160 * Math.pow(0.6, 0.75));
    expect(r.puppyBelowTable).toBe(true);
  });
  it("flags the switch to adult food as it nears", () => {
    expect(readPuppyGuide(pg, 30, 40).nearTransition).toBe(false);
    expect(readPuppyGuide(pg, 37, 40).nearTransition).toBe(true);
    expect(readPuppyGuide(pg, 40, 40).problem).toBe("grown");
  });
});

describe("plans", () => {
  it("one food at maintenance", () => {
    const p = makePlan(adult(), [{ food: dry, share: 1 }]);
    expect(p.ok).toBe(true);
    expect(p.goal).toBe("maintain");
    expect(p.items[0]).toMatchObject({ gramsPerDay: 165, gramsPerMeal: 83, method: "label" });
  });

  it("adjusts for activity", () => {
    expect(makePlan(adult({ activity: "low" }), [{ food: dry, share: 1 }]).items[0].gramsPerDay).toBe(150);
    expect(makePlan(adult({ activity: "high" }), [{ food: dry, share: 1 }]).items[0].gramsPerDay).toBe(200);
  });

  it("mixes dry and wet by share of the day", () => {
    const p = makePlan(adult(), [
      { food: dry, share: 0.75 },
      { food: wet, share: 0.25 },
    ]);
    expect(p.items.map((i) => i.gramsPerDay)).toEqual([125, 175]);
    expect(p.items[1].packagesPerDay).toBe(0.5);
    expect(p.totalKcal).toBe(470 + 158);
  });

  it("feeds for the target weight when losing, with the safe pace", () => {
    const p = makePlan(adult({ currentKg: 30, targetKg: 25 }), [{ food: dry, share: 1 }]);
    expect(p.goal).toBe("lose");
    expect(p.items[0].gramsPerDay).toBe(roundGrams(readAdultGuide(dry.adultGuide!, 25).grams));
    expect(p.notes.some((n) => n.text.includes("0.3–0.6 kg a week"))).toBe(true);
    expect(p.notes.some((n) => n.level === "warn")).toBe(false);
  });

  it("warns about big weight changes", () => {
    const p = makePlan(adult({ currentKg: 30, targetKg: 20 }), [{ food: dry, share: 1 }]);
    expect(p.notes.some((n) => n.level === "warn" && n.text.includes("vet"))).toBe(true);
  });

  it("falls back to calories outside the table when energy is known", () => {
    const p = makePlan(adult({ currentKg: 50, targetKg: 50 }), [{ food: dry, share: 1 }]);
    expect(p.items[0].method).toBe("calories");
    expect(p.items[0].gramsPerDay).toBe(555);
  });

  it("feeds puppies from the puppy table, ignoring activity", () => {
    const p = makePlan({ ...puppy(25, 50), activity: "high" }, [{ food: puppyLarge, share: 1 }]);
    expect(p.ok).toBe(true);
    expect(p.goal).toBe("grow");
    expect(p.items[0].gramsPerDay).toBe(465);
  });

  it("won't give adult amounts from a puppy-only food", () => {
    const p = makePlan(adult(), [{ food: puppyLarge, share: 1 }]);
    expect(p.ok).toBe(false);
    expect(p.notes[0].level).toBe("stop");
  });

  it("won't give puppy amounts from an adult-only food without energy", () => {
    const { energy: _e, ...noEnergy } = dry;
    expect(makePlan(puppy(10, 30), [{ food: noEnergy as Food, share: 1 }]).ok).toBe(false);
  });

  it("stops a puppy that has reached adult weight", () => {
    const p = makePlan(puppy(30, 30), [{ food: puppyLarge, share: 1 }]);
    expect(p.ok).toBe(false);
  });

  it("rejects silly weights", () => {
    expect(makePlan(adult({ currentKg: 0 }), [{ food: dry, share: 1 }]).ok).toBe(false);
    expect(makePlan(adult({ targetKg: NaN }), [{ food: dry, share: 1 }]).ok).toBe(false);
    expect(makePlan(adult({ currentKg: 500 }), [{ food: dry, share: 1 }]).ok).toBe(false);
  });

  it("works from the calories on a custom food", () => {
    const mine = customFood({ name: "Bag food", type: "dry", energyValue: 1600, energyUnit: "kJ/100g", packageGrams: 0 }, 1)!;
    const p = makePlan(adult(), [{ food: mine, share: 1 }]);
    expect(p.items[0].method).toBe("calories");
    expect(p.items[0].gramsPerDay).toBe(roundGrams((adultKcal(10, "typical") / 382.4) * 100));
  });

  it("refuses custom energy figures that look like a unit slip", () =>
    expect(customFood({ name: "", type: "dry", energyValue: 1600, energyUnit: "kcal/100g", packageGrams: 0 }, 1)).toBeUndefined());
});

describe("safety checks from the nutrition review", () => {
  const mine = (type: "dry" | "wet", kcal: number) =>
    customFood({ name: "Bag food", type, energyValue: kcal, energyUnit: "kcal/100g", packageGrams: 0 }, 1)!;

  it("refuses an adult-only food for a puppy even when its calories are known", () =>
    expect(makePlan(puppy(10, 30), [{ food: dry, share: 1 }]).ok).toBe(false));

  it("refuses a puppy-only food for an adult even when its calories are known", () => {
    const withEnergy: Food = { ...puppyLarge, energy: { kcalPer100g: 390 } };
    expect(makePlan(adult({ currentKg: 30, targetKg: 30 }), [{ food: withEnergy, share: 1 }]).ok).toBe(false);
  });

  it("lets a custom food feed a puppy from calories, asking the owner to check it's a growth food", () => {
    const p = makePlan(puppy(10, 30), [{ food: mine("dry", 380), share: 1 }]);
    expect(p.ok).toBe(true);
    expect(p.notes.some((n) => n.level === "warn" && n.text.includes("growth"))).toBe(true);
  });

  it("sends very young puppies on calorie estimates to the vet", () => {
    const p = makePlan(puppy(3, 40), [{ food: mine("dry", 380), share: 1 }]);
    expect(p.notes.some((n) => n.level === "warn" && n.text.includes("very young"))).toBe(true);
  });

  it("warns when a label food with no calories is mixed with a calorie-based food", () => {
    const noEnergy: Food = { ...puppyLarge, energy: undefined };
    const p = makePlan(puppy(25, 50), [
      { food: noEnergy, share: 0.5 },
      { food: mine("wet", 95), share: 0.5 },
    ]);
    expect(p.ok).toBe(true);
    expect(p.notes.some((n) => n.level === "warn" && n.text.includes("doesn't list its calories"))).toBe(true);
  });

  it("stops a target that's more than 50% away (probably a typo)", () => {
    const p = makePlan(adult({ currentKg: 30, targetKg: 3 }), [{ food: dry, share: 1 }]);
    expect(p.ok).toBe(false);
    expect(p.notes[0].level).toBe("stop");
  });

  it("never rounds food to 0 g", () => {
    expect(roundGrams(0.4)).toBe(1);
    const p = makePlan(adult({ currentKg: 0.5, targetKg: 0.5, meals: 4 }), [
      { food: mine("dry", 400), share: 0.1 },
      { food: mine("wet", 95), share: 0.9 },
    ]);
    expect(p.items[0].gramsPerMeal).toBeGreaterThanOrEqual(1);
  });

  it("meals add back up to the day", () => {
    const p = makePlan(adult({ meals: 3 }), [{ food: dry, share: 1 }]);
    expect(Math.abs(p.items[0].gramsPerMeal * 3 - p.items[0].gramsPerDay)).toBeLessThanOrEqual(2);
  });

  it("treats a missing meals count as two meals", () =>
    expect(makePlan(adult({ meals: NaN }), [{ food: dry, share: 1 }]).items[0].gramsPerMeal).toBe(83));

  it("says when the label says to move to adult food", () => {
    expect(readPuppyGuide(pg, 85, 90).transition).toBe(true);
    const p = makePlan(puppy(85, 90), [{ food: puppyLarge, share: 1 }]);
    expect(p.notes.some((n) => n.text.includes("time to start moving to adult food"))).toBe(true);
  });

  it("warns when reading beyond an adult table with no calories to fall back on", () => {
    const { energy: _e, ...noEnergy } = dry;
    const p = makePlan(adult({ currentKg: 50, targetKg: 50 }), [{ food: noEnergy as Food, share: 1 }]);
    expect(p.items[0].method).toBe("label");
    expect(p.notes.some((n) => n.level === "warn" && n.text.includes("estimate"))).toBe(true);
  });

  it("gives the safe pace for weight gain, and a note for seniors", () => {
    const p = makePlan(adult({ stage: "senior", currentKg: 20, targetKg: 22 }), [{ food: dry, share: 1 }]);
    expect(p.goal).toBe("gain");
    expect(p.notes.some((n) => n.text.includes("0.2–0.4 kg a week"))).toBe(true);
    expect(p.notes.some((n) => n.text.includes("Older dogs"))).toBe(true);
  });

  it("notes when a label's amount is far from a typical calorie estimate", () => {
    const generous: Food = { ...dry, adultGuide: dry.adultGuide!.map((r) => ({ ...r, gramsLow: r.gramsLow * 2, gramsHigh: (r.gramsHigh ?? r.gramsLow) * 2 })) };
    const p = makePlan(adult(), [{ food: generous, share: 1 }]);
    expect(p.notes.some((n) => n.text.includes("more than a typical estimate"))).toBe(true);
  });
});

describe("Orijen Puppy Large with its published energy", () => {
  it("uses the maker's 3760 kcal/kg", () => expect(puppyLarge.energy?.kcalPer100g).toBe(376));
  it("gives the label amount and calories for the curator's spot-check", () => {
    const p = makePlan(puppy(25, 50), [{ food: puppyLarge, share: 1 }]);
    expect(p.items[0].gramsPerDay).toBe(465);
    expect(p.totalKcal).toBe(Math.round(465 * 3.76));
    // 1748 kcal is about 69% of the NRC estimate: normal for a puppy label, so no cross-check note.
    expect(p.notes.some((n) => n.text.includes("typical estimate"))).toBe(false);
  });
});
