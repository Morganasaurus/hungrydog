// Reading feeding tables. Between two rows we interpolate in a straight line, the way a person reading the
// label would. Outside the table we say so, so the plan can warn or fall back to a calorie estimate.

import type { AdultGuidePoint, PuppyColumn, PuppyGuide } from "./types";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type Outside = "below" | "above" | null;

export interface AdultReading {
  /** Middle of the label's range at this weight. */
  grams: number;
  low: number;
  high: number;
  outside: Outside;
}

/** Daily grams for an adult of `kg`, read from the label table. */
export function readAdultGuide(points: AdultGuidePoint[], kg: number): AdultReading {
  const hi = (p: AdultGuidePoint) => p.gramsHigh ?? p.gramsLow;
  const first = points[0];
  const last = points[points.length - 1];

  // Beyond the table: scale the end row by metabolic weight (kg^0.75), and flag it.
  const scaled = (p: AdultGuidePoint, outside: Outside): AdultReading => {
    const f = Math.pow(kg / p.weightKg, 0.75);
    const low = p.gramsLow * f;
    const high = hi(p) * f;
    return { grams: (low + high) / 2, low, high, outside };
  };
  if (kg < first.weightKg) return scaled(first, "below");
  if (kg > last.weightKg) return scaled(last, "above");

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (kg >= a.weightKg && kg <= b.weightKg) {
      const t = (kg - a.weightKg) / (b.weightKg - a.weightKg);
      const low = lerp(a.gramsLow, b.gramsLow, t);
      const high = lerp(hi(a), hi(b), t);
      return { grams: (low + high) / 2, low, high, outside: null };
    }
  }
  return scaled(last, "above"); // unreachable with valid, ascending data
}

export type PuppyProblem =
  | "grown" // the puppy already weighs its expected adult weight
  | "adult-below-table" // expected adult weight is smaller than any column: this food isn't meant for that size
  | null;

export interface PuppyReading {
  grams: number;
  /** The puppy has reached the label's "move to adult food" row. */
  transition: boolean;
  /** Within 10% of that row: time to plan the switch. */
  nearTransition: boolean;
  /** Puppy weight at which the label says to move to adult food (interpolated between columns). */
  transitionKg: number;
  /** Expected adult weight is beyond the biggest column; the biggest column was used. */
  adultAboveTable: boolean;
  /** Puppy is lighter than the first row; amount scaled down from it. */
  puppyBelowTable: boolean;
  problem: PuppyProblem;
  smallestAdultKg: number;
  largestAdultKg: number;
}

function readColumn(c: PuppyColumn, kg: number): { grams: number; below: boolean } {
  const pts = c.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (kg < first.weightKg) return { grams: first.grams * Math.pow(kg / first.weightKg, 0.75), below: true };
  // Past the column's last row the puppy is at or near adult size; hold the last amount.
  if (kg >= last.weightKg) return { grams: last.grams, below: false };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (kg >= a.weightKg && kg <= b.weightKg) {
      return { grams: lerp(a.grams, b.grams, (kg - a.weightKg) / (b.weightKg - a.weightKg)), below: false };
    }
  }
  return { grams: last.grams, below: false };
}

/** Weight at which a column says to move to adult food (the marked row, else its last row). */
function transitionKg(c: PuppyColumn): number {
  return (c.points.find((p) => p.transition) ?? c.points[c.points.length - 1]).weightKg;
}

/** "Nearly time to switch" once the puppy is within 10% of the label's switch weight. */
const NEAR_TRANSITION = 0.9;

/** Tolerance below the smallest column before we refuse (labels round adult weights to tidy numbers). */
const ADULT_TOLERANCE = 0.05;

/** Daily grams for a puppy of `kg` expected to weigh `adultKg` when grown. */
export function readPuppyGuide(guide: PuppyGuide, kg: number, adultKg: number): PuppyReading {
  const cols = guide.columns;
  const smallest = cols[0];
  const largest = cols[cols.length - 1];
  const base = {
    smallestAdultKg: smallest.adultKg,
    largestAdultKg: largest.adultKg,
    adultAboveTable: false,
    puppyBelowTable: false,
    transition: false,
    nearTransition: false,
    transitionKg: adultKg,
  };

  if (kg >= adultKg) return { ...base, grams: 0, problem: "grown", transition: true, nearTransition: true };
  if (adultKg < smallest.adultKg * (1 - ADULT_TOLERANCE)) return { ...base, grams: 0, problem: "adult-below-table" };

  let c1 = smallest;
  let c2 = smallest;
  let t = 0;
  if (adultKg >= largest.adultKg) {
    c1 = c2 = largest;
  } else if (adultKg > smallest.adultKg) {
    for (let i = 0; i < cols.length - 1; i++) {
      if (adultKg >= cols[i].adultKg && adultKg <= cols[i + 1].adultKg) {
        c1 = cols[i];
        c2 = cols[i + 1];
        t = (adultKg - c1.adultKg) / (c2.adultKg - c1.adultKg);
        break;
      }
    }
  }

  const r1 = readColumn(c1, kg);
  const r2 = readColumn(c2, kg);
  const grams = lerp(r1.grams, r2.grams, t);
  const tKg = lerp(transitionKg(c1), transitionKg(c2), t);

  return {
    ...base,
    grams,
    transition: kg >= tKg,
    nearTransition: kg >= tKg * NEAR_TRANSITION,
    transitionKg: tKg,
    adultAboveTable: adultKg > largest.adultKg,
    puppyBelowTable: r1.below || r2.below,
    problem: null,
  };
}
