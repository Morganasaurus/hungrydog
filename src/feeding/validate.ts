// Checks food and breed data. Used by the tests (every data file must pass) and at load time (a bad entry is
// dropped rather than shown). Returns a list of human-readable problems; empty means valid.

import type { Breed, Food, LifeStages } from "./types";

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown, max = 120): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

function ascending(weights: number[]): boolean {
  return weights.every((w, i) => i === 0 || w > weights[i - 1]);
}

export function validateFood(raw: unknown): string[] {
  const e: string[] = [];
  if (!isObj(raw)) return ["not an object"];
  const f = raw as Partial<Food> & Record<string, unknown>;

  if (!isStr(f.id, 80) || !ID.test(f.id)) e.push("id must be lower-case words joined by dashes");
  if (!isStr(f.brand)) e.push("brand is required");
  if (!isStr(f.name)) e.push("name is required");
  if (f.type !== "dry" && f.type !== "wet") e.push('type must be "dry" or "wet"');

  if (f.energy !== undefined) {
    if (!isObj(f.energy) || !isNum(f.energy.kcalPer100g)) e.push("energy.kcalPer100g must be a number");
    // Dry foods sit around 300–450 kcal/100 g, wet around 60–150. Outside 40–650 is almost certainly a unit slip
    // (kJ for kcal, per kg for per 100 g).
    else if (f.energy.kcalPer100g < 40 || f.energy.kcalPer100g > 650) e.push("energy.kcalPer100g looks wrong (unit slip?)");
  }

  if (f.package !== undefined) {
    if (!isObj(f.package) || !isStr(f.package.label, 20) || !isNum(f.package.grams) || f.package.grams <= 0)
      e.push("package needs a label and grams > 0");
  }

  if (f.adultGuide !== undefined) {
    if (!Array.isArray(f.adultGuide) || f.adultGuide.length < 2) e.push("adultGuide needs at least 2 rows");
    else {
      f.adultGuide.forEach((p, i) => {
        if (!isObj(p) || !isNum(p.weightKg) || p.weightKg <= 0 || !isNum(p.gramsLow) || p.gramsLow <= 0)
          e.push(`adultGuide[${i}] needs weightKg and gramsLow > 0`);
        else if (p.gramsHigh !== undefined && (!isNum(p.gramsHigh) || p.gramsHigh < p.gramsLow))
          e.push(`adultGuide[${i}].gramsHigh must be ≥ gramsLow`);
      });
      if (!ascending(f.adultGuide.map((p) => p.weightKg))) e.push("adultGuide weights must increase");
    }
  }

  if (f.puppyGuide !== undefined) {
    const g = f.puppyGuide;
    if (!isObj(g) || !Array.isArray(g.columns) || g.columns.length < 1) e.push("puppyGuide needs columns");
    else {
      if (!ascending(g.columns.map((c) => c.adultKg))) e.push("puppyGuide columns must be in increasing adultKg");
      g.columns.forEach((c, ci) => {
        if (!isNum(c.adultKg) || c.adultKg <= 0) e.push(`puppyGuide column ${ci} needs adultKg`);
        if (!Array.isArray(c.points) || c.points.length < 2) {
          e.push(`puppyGuide column ${ci} needs at least 2 rows`);
          return;
        }
        c.points.forEach((p, pi) => {
          if (!isObj(p) || !isNum(p.weightKg) || p.weightKg <= 0 || !isNum(p.grams) || p.grams <= 0)
            e.push(`puppyGuide column ${ci} row ${pi} needs weightKg and grams > 0`);
          else if (p.weightKg > c.adultKg) e.push(`puppyGuide column ${ci} row ${pi} is heavier than the adult weight`);
        });
        if (!ascending(c.points.map((p) => p.weightKg))) e.push(`puppyGuide column ${ci} weights must increase`);
      });
      if (g.transitionTo !== undefined && !isStr(g.transitionTo)) e.push("puppyGuide.transitionTo must be text");
    }
  }

  if (f.adultGuide === undefined && f.puppyGuide === undefined && f.energy === undefined)
    e.push("a food needs an adult guide, a puppy guide or an energy figure");

  if (f.labelNotes !== undefined && (!Array.isArray(f.labelNotes) || !f.labelNotes.every((n) => isStr(n, 240))))
    e.push("labelNotes must be short strings");

  if (!isObj(f.source)) e.push("source is required");
  else {
    if (f.source.kind !== "label" && f.source.kind !== "maker-website") e.push("source.kind must be label or maker-website");
    if (!isStr(f.source.addedOn, 10) || !DATE.test(f.source.addedOn)) e.push("source.addedOn must be YYYY-MM-DD");
    if (f.source.notes !== undefined && !isStr(f.source.notes, 1000)) e.push("source.notes must be text up to 1000 characters");
    if (f.source.links !== undefined) {
      if (!Array.isArray(f.source.links)) e.push("source.links must be a list");
      else
        f.source.links.forEach((l, i) => {
          if (!isObj(l) || !isStr(l.title, 200) || !isStr(l.url, 500) || !/^https:\/\//.test(l.url) || !DATE.test(String(l.accessed)))
            e.push(`source.links[${i}] needs title, https url and accessed date`);
        });
    }
  }

  if (f.demo !== undefined && f.demo !== true) e.push("demo must be true or absent");
  if (f.vetDiet !== undefined && f.vetDiet !== true) e.push("vetDiet must be true or absent");
  if (f.custom !== undefined) e.push("custom is only for foods typed in by the owner, not data files");
  return e;
}

export function validateBreed(raw: unknown): string[] {
  const e: string[] = [];
  if (!isObj(raw)) return ["not an object"];
  const b = raw as Partial<Breed>;
  if (!isStr(b.id, 80) || !ID.test(b.id)) e.push("id must be lower-case words joined by dashes");
  if (!isStr(b.name)) e.push("name is required");
  if (!["toy", "small", "medium", "large", "giant"].includes(b.sizeClass as string)) e.push("sizeClass is invalid");
  if (!["low", "moderate", "high"].includes(b.energy as string)) e.push("energy is invalid");
  for (const sex of ["male", "female"] as const) {
    const r = isObj(b.weightKg) ? b.weightKg[sex] : undefined;
    if (!Array.isArray(r) || r.length !== 2 || !isNum(r[0]) || !isNum(r[1]) || r[0] <= 0 || r[1] < r[0])
      e.push(`weightKg.${sex} must be [min, max]`);
  }
  const life = b.lifespanYears;
  if (!Array.isArray(life) || life.length !== 2 || !isNum(life[0]) || !isNum(life[1]) || life[0] < 5 || life[1] > 25 || life[1] < life[0])
    e.push("lifespanYears must be [min, max] between 5 and 25");
  if (b.note !== undefined && !isStr(b.note, 200)) e.push("note must be text up to 200 characters");
  if (b.aliases !== undefined && (!Array.isArray(b.aliases) || !b.aliases.every((a) => isStr(a, 60)))) e.push("aliases must be short strings");
  e.push(...checkSources(b.sources));
  return e;
}

function checkSources(sources: unknown): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return ["at least one source is required"];
  const e: string[] = [];
  sources.forEach((s, i) => {
    if (!isObj(s) || !isStr(s.title, 200) || !isStr(s.url, 500) || !/^https:\/\//.test(s.url) || !DATE.test(String(s.accessed)))
      e.push(`sources[${i}] needs title, https url and accessed date`);
  });
  return e;
}

const SIZES = ["toy", "small", "medium", "large", "giant"] as const;

export function validateLifeStages(raw: unknown): string[] {
  if (!isObj(raw)) return ["not an object"];
  const l = raw as Partial<LifeStages>;
  const e: string[] = [];
  const range = (v: unknown, lo: number, hi: number) =>
    Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] >= lo && v[1] <= hi && v[1] >= v[0];
  for (const s of SIZES) {
    if (!isObj(l.grownMonths) || !range(l.grownMonths[s], 4, 36)) e.push(`grownMonths.${s} must be [min, max] months (4–36)`);
    if (!isObj(l.seniorYears) || !range(l.seniorYears[s], 4, 15)) e.push(`seniorYears.${s} must be [min, max] years (4–15)`);
  }
  if (!isNum(l.seniorShareOfLifespan) || l.seniorShareOfLifespan <= 0.5 || l.seniorShareOfLifespan >= 1)
    e.push("seniorShareOfLifespan must be between 0.5 and 1");
  e.push(...checkSources(l.sources));
  return e;
}
