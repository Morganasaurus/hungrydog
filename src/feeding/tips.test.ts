import { describe, expect, it } from "vitest";
import { ageTip, conditionTip, mealsTip, pluralBreed, sizeFromWeight } from "./tips";
import type { Breed, LifeStages } from "./types";

// Test fixtures only: the real figures live in src/data and are checked by data.test.ts.
const life: LifeStages = {
  grownMonths: { toy: [9, 10], small: [10, 12], medium: [12, 15], large: [15, 18], giant: [18, 24] },
  seniorShareOfLifespan: 0.75,
  seniorYears: { toy: [10, 12], small: [10, 12], medium: [8, 10], large: [7, 8], giant: [5, 6] },
  sources: [{ title: "Guideline", url: "https://example.org/g", accessed: "2026-11-14" }],
};
const rottie: Breed = {
  id: "rottweiler",
  name: "Rottweiler",
  sizeClass: "large",
  weightKg: { male: [50, 60], female: [35, 48] },
  energy: "moderate",
  lifespanYears: [9, 10],
  sources: [{ title: "Breed standard", url: "https://example.org/r", accessed: "2026-11-14" }],
};

describe("size from weight", () => {
  it("uses the same bands as the breed data", () => {
    expect([3, 7, 20, 30, 50].map(sizeFromWeight)).toEqual(["toy", "small", "medium", "large", "giant"]);
    expect(sizeFromWeight(45)).toBe("large");
    expect(sizeFromWeight(NaN)).toBeUndefined();
  });
});

describe("meals tip", () => {
  it("puppies: start at 4 meals; one meal is too few, two only for older puppies", () => {
    expect(mealsTip("puppy", "medium", 3).lines[0]).toContain("4 meals");
    expect(mealsTip("puppy", "medium", 1).caution).toContain("isn't enough");
    expect(mealsTip("puppy", "medium", 2).caution).toContain("older puppies");
    expect(mealsTip("puppy", "medium", 3).caution).toBeUndefined();
  });

  it("adults: at least 2 meals, and warns about one", () => {
    expect(mealsTip("adult", "small", 2).caution).toBeUndefined();
    expect(mealsTip("adult", "small", 1).caution).toContain("isn't recommended");
  });

  it("large breeds get the bloat advice, named by breed when chosen", () => {
    const t = mealsTip("adult", "large", 2, "Rottweiler");
    expect(t.lines.some((l) => l.startsWith("Rottweilers are prone to bloat"))).toBe(true);
    expect(t.sources.map((s) => s.url)).toContain("https://acvs.org/small-animal/gastric-dilatation-volvulus/");
    expect(mealsTip("adult", "small", 2).lines.some((l) => l.includes("bloat (GDV)"))).toBe(false);
  });
});

describe("age tip", () => {
  it("needs the life-stage guidance and a size", () => {
    expect(ageTip("adult", "large", undefined, rottie)).toBeUndefined();
    expect(ageTip("adult", undefined, life)).toBeUndefined();
  });

  it("works out senior age from the breed's life span", () => {
    // 9–10 years × 0.75 = 6.75–7.5 → about 7–8 years
    const t = ageTip("adult", undefined, life, rottie, 45)!;
    expect(t.title).toBe("Age guide: Rottweiler");
    expect(t.lines[0]).toContain("live 9–10 years");
    expect(t.lines[0]).toContain("senior from about 7–8 years");
    expect(t.lines.some((l) => l.includes("males 50–60 kg, females 35–48 kg"))).toBe(true);
    expect(t.caution).toBeUndefined();
  });

  it("for puppies, leads with when they finish growing", () => {
    const t = ageTip("puppy", undefined, life, rottie, 50)!;
    expect(t.lines[0]).toContain("finish growing at about 15–18 months");
  });

  it("flags a weight well outside the breed's range", () => {
    expect(ageTip("adult", undefined, life, rottie, 20)!.caution).toContain("outside the usual 35–60 kg");
  });

  it("falls back to size when no breed is chosen", () => {
    const t = ageTip("adult", "giant", life)!;
    expect(t.lines[0]).toContain("Giant dogs usually count as senior from about 5–6 years");
  });
});

describe("breed plurals", () => {
  it("handles brackets, -y and -s endings", () => {
    expect(pluralBreed("Labradoodle (standard)")).toBe("Labradoodles (standard)");
    expect(pluralBreed("Siberian Husky")).toBe("Siberian Huskies");
    expect(pluralBreed("Rottweiler")).toBe("Rottweilers");
    expect(pluralBreed("Shih Tzu")).toBe("Shih Tzus");
    expect(pluralBreed("Cockapoo (Spoodle)")).toBe("Cockapoos (Spoodle)");
  });
});

describe("kidney disease tip", () => {
  it("leads with phosphorus and cites IRIS and Tufts", () => {
    const t = conditionTip("kidney", true);
    expect(t.lines[0]).toMatch(/phosphorus/);
    expect(t.sources.map((s) => s.url).join(" ")).toMatch(/iris-kidney\.com.*tufts\.edu/);
    expect(t.caution).toBeUndefined();
  });
  it("cautions when none of the chosen foods is a kidney diet", () =>
    expect(conditionTip("kidney", false).caution).toMatch(/None of the foods chosen is listed here as a kidney diet/));
  it("says nothing about foods before one is chosen", () => expect(conditionTip("kidney", undefined).caution).toBeUndefined());
});
