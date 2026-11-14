import { describe, expect, it } from "vitest";
import breedsRaw from "../data/breeds.json";
import { validateBreed, validateFood, validateLifeStages } from "./validate";

// Read every data file through Vite's glob, so new files are picked up automatically.
const asList = (files: Record<string, unknown>) =>
  Object.entries(files).map(([path, data]) => ({ file: path.split("/").pop()!, data: data as Record<string, unknown> }));
const realFiles = asList(import.meta.glob("../data/foods/*.json", { eager: true, import: "default" }));
const demoFiles = asList(import.meta.glob("../data/demo/*.json", { eager: true, import: "default" }));

describe("food data files", () => {
  const real = realFiles;
  const demo = demoFiles;

  it.each([...real, ...demo].map((f) => [f.file, f.data]))("%s is valid", (_file, data) => {
    expect(validateFood(data)).toEqual([]);
  });

  it.each([...real, ...demo].map((f) => [f.file, f.data]))("%s id matches its file name", (file, data) => {
    expect(data.id).toBe(String(file).replace(/\.json$/, ""));
  });

  it("real foods are never marked demo, demo foods always are", () => {
    for (const f of real) expect(f.data.demo).toBeUndefined();
    for (const f of demo) expect(f.data.demo).toBe(true);
  });

  it("ids are unique", () => {
    const ids = [...real, ...demo].map((f) => f.data.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("breed data", () => {
  const breeds = breedsRaw as unknown[];
  it("is a list", () => expect(Array.isArray(breeds)).toBe(true));
  it("every breed is valid", () => {
    for (const b of breeds) expect(validateBreed(b), JSON.stringify(b).slice(0, 60)).toEqual([]);
  });
  it("ids are unique", () => {
    const ids = breeds.map((b) => (b as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("validator catches mistakes", () => {
  const base = {
    id: "x-food",
    brand: "X",
    name: "Food",
    type: "dry",
    adultGuide: [
      { weightKg: 5, gramsLow: 90 },
      { weightKg: 10, gramsLow: 150 },
    ],
    source: { kind: "label", addedOn: "2026-11-14" },
  };
  it("accepts a minimal food", () => expect(validateFood(base)).toEqual([]));
  it("rejects kJ entered as kcal", () => expect(validateFood({ ...base, energy: { kcalPer100g: 1600 } })).not.toEqual([]));
  it("rejects rows out of order", () =>
    expect(validateFood({ ...base, adultGuide: [base.adultGuide[1], base.adultGuide[0]] })).not.toEqual([]));
  it("rejects a food with nothing to calculate from", () => {
    const { adultGuide: _drop, ...rest } = base;
    expect(validateFood(rest)).not.toEqual([]);
  });
  it("rejects a puppy row heavier than its adult column", () =>
    expect(
      validateFood({
        ...base,
        puppyGuide: { columns: [{ adultKg: 30, points: [{ weightKg: 5, grams: 100 }, { weightKg: 35, grams: 300 }] }] },
      }),
    ).not.toEqual([]));
});

describe("life-stage guidance", () => {
  const files = Object.values(import.meta.glob("../data/life-stages.json", { eager: true, import: "default" }));
  it("is valid when present", () => {
    for (const f of files) expect(validateLifeStages(f)).toEqual([]);
  });
});
