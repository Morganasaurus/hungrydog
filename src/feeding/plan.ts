// Turns the dog's details and one or two foods into a daily feeding plan with plain-English notes.
//
// Rules (keep in sync with CLAUDE.md):
// - Adults and seniors are fed for their TARGET weight (how vets start a weight-loss or weight-gain plan).
// - Puppies are fed from the label's puppy table by current weight and expected adult weight.
// - A label table always wins over a calorie estimate. Calories are used when the food has no suitable
//   table (a custom food, or a dog outside the table) and the food's energy is known.
// - Two foods are mixed by share of the day: each gives that share of its own full-day amount. Because each
//   label's full-day amount is a full day of energy, this is a split by calories, not by weight.

import { ACTIVITY_FACTOR, adultKcal, gramsForKcal, puppyKcal, type Activity } from "./energy";
import { readAdultGuide, readPuppyGuide } from "./guide";
import type { Food } from "./types";

export type Stage = "puppy" | "adult" | "senior";

export interface DogInput {
  stage: Stage;
  currentKg: number;
  /** Adults/seniors: target weight. Puppies: expected adult weight. */
  targetKg: number;
  activity: Activity;
  meals: number;
}

export interface FoodChoice {
  food: Food;
  /** Share of the day's food, 0–1. */
  share: number;
}

export type Method = "label" | "calories";

export interface PlanItem {
  food: Food;
  share: number;
  /** What this food alone would be for a whole day. */
  fullDayGrams: number;
  gramsPerDay: number;
  gramsPerMeal: number;
  /** e.g. 1.25 cans, when the food has a package size. */
  packagesPerDay?: number;
  kcalPerDay?: number;
  method: Method;
  /** One line on where the number came from. */
  how: string;
}

export interface Note {
  level: "info" | "warn" | "stop";
  text: string;
}

export type Goal = "maintain" | "lose" | "gain" | "grow";

export interface Plan {
  ok: boolean;
  goal: Goal;
  items: PlanItem[];
  totalKcal?: number;
  notes: Note[];
}

export const LIMITS = { minKg: 0.5, maxKg: 120, minMeals: 1, maxMeals: 4 };
/** Within 3% of the target counts as "at target". */
const MAINTAIN_BAND = 0.03;
/** A target more than 25% away gets a "check with your vet" warning; more than 50% is almost certainly a typo. */
const WARN_CHANGE = 0.25;
const STOP_CHANGE = 0.5;
/** Below this share of adult weight a puppy is very young and calorie estimates vary a lot. */
const YOUNG_PUPPY = 0.25;

/** Rounds grams the way you'd measure them: whole grams under 50 g, otherwise to 5 g. Never rounds food to 0 g. */
export function roundGrams(g: number): number {
  if (g <= 0) return 0;
  return g < 50 ? Math.max(1, Math.round(g)) : Math.round(g / 5) * 5;
}

/** Rounds to the nearest quarter (for cans, trays, pouches). */
export function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

const kg1 = (n: number) => `${Math.round(n * 10) / 10} kg`;

interface FullDay {
  grams: number;
  method: Method;
  how: string;
  notes: Note[];
}

function fullDayAdult(food: Food, dog: DogInput): FullDay | Note {
  const act = ACTIVITY_FACTOR[dog.activity];
  const actText = dog.activity === "typical" ? "" : dog.activity === "low" ? ", less 10% for a less active dog" : ", plus 20% for a very active dog";
  const name = `${food.brand} ${food.name}`;

  // A catalogued food whose label only covers puppies is a growth food: never give adult amounts from it.
  if (!food.custom && food.puppyGuide && !food.adultGuide)
    return { level: "stop", text: `${name}'s guide is for puppies only, so we can't work out an adult amount. Its maker usually has a matching adult food.` };

  if (food.adultGuide) {
    const r = readAdultGuide(food.adultGuide, dog.targetKg);
    if (r.outside && food.energy) {
      const kcal = adultKcal(dog.targetKg, dog.activity);
      return {
        grams: gramsForKcal(kcal, food.energy.kcalPer100g),
        method: "calories",
        how: `${kg1(dog.targetKg)} is outside the label's table, so this is from calories: about ${Math.round(kcal)} kcal a day${actText}.`,
        notes: [],
      };
    }
    const range = Math.round(r.low) === Math.round(r.high) ? `${Math.round(r.low)} g` : `${Math.round(r.low)}–${Math.round(r.high)} g`;
    const notes: Note[] = r.outside
      ? [{ level: "warn", text: `${kg1(dog.targetKg)} is ${r.outside === "below" ? "lighter" : "heavier"} than any row in the ${name} table, so its amount is our estimate, not the label's.` }]
      : [];
    return {
      grams: r.grams * act,
      method: "label",
      how: `Label amount for a ${kg1(dog.targetKg)} dog: ${range} a day${r.low !== r.high ? " (we use the middle)" : ""}${actText}.`,
      notes,
    };
  }
  if (food.energy) {
    const kcal = adultKcal(dog.targetKg, dog.activity);
    return {
      grams: gramsForKcal(kcal, food.energy.kcalPer100g),
      method: "calories",
      how: `From calories: about ${Math.round(kcal)} kcal a day for a ${kg1(dog.targetKg)} dog${actText}, at ${Math.round(food.energy.kcalPer100g)} kcal per 100 g.`,
      notes: [],
    };
  }
  return { level: "stop", text: `${name}'s guide is for puppies only, so we can't work out an adult amount. Its maker usually has a matching adult food.` };
}

function fullDayPuppy(food: Food, dog: DogInput): FullDay | Note {
  const name = `${food.brand} ${food.name}`;
  // A catalogued food whose label only covers adults isn't made for growth, even if we know its calories.
  // A catalogued food with no puppy guide at all (only calories) is treated the same way: we only list such foods
  // when their label is for adults.
  if (!food.custom && !food.puppyGuide)
    return {
      level: "stop",
      text: food.adultGuide
        ? `${name}'s guide is for adult dogs only. Puppies need a food made for growth: choose a puppy or "all life stages" food.`
        : `${name} is for adult dogs, and has no puppy feeding guide. Puppies need a food made for growth: choose a puppy or "all life stages" food.`,
    };
  if (food.puppyGuide) {
    const r = readPuppyGuide(food.puppyGuide, dog.currentKg, dog.targetKg);
    if (r.problem === "adult-below-table")
      return {
        level: "stop",
        text: `${name} is made for puppies that grow to ${r.smallestAdultKg} kg or more. For an expected adult weight of ${kg1(dog.targetKg)}, choose a puppy food for that size.`,
      };
    const notes: Note[] = [];
    const to = food.puppyGuide.transitionTo ? ` (the label suggests ${food.puppyGuide.transitionTo})` : "";
    if (r.transition)
      notes.push({ level: "info", text: `At this weight the ${name} label says it's time to start moving to adult food${to}. Switch gradually over 7–10 days.` });
    else if (r.nearTransition)
      notes.push({ level: "info", text: `Your puppy is close to the weight (about ${kg1(r.transitionKg)}) where the ${name} label says to move to adult food${to}. Plan the switch, and make it gradually over 7–10 days.` });
    if (r.adultAboveTable)
      notes.push({ level: "warn", text: `The ${name} table stops at an adult weight of ${r.largestAdultKg} kg, so we've used that column. Your puppy may need a little more; watch their body condition.` });
    if (r.puppyBelowTable)
      notes.push({ level: "warn", text: `Your puppy is lighter than the first row of the ${name} table, so this amount is our estimate. Ask your vet about very young puppies.` });
    return {
      grams: r.grams,
      method: "label",
      how: `Label amount for a ${kg1(dog.currentKg)} puppy expected to reach ${kg1(dog.targetKg)}, read between the table's rows and columns.`,
      notes,
    };
  }
  if (food.energy) {
    const kcal = puppyKcal(dog.currentKg, dog.targetKg);
    const notes: Note[] = [];
    if (food.custom)
      notes.push({ level: "warn", text: `Check that ${food.name} says "puppy", "growth" or "all life stages" on the bag. Adult food isn't right for a growing puppy.` });
    if (dog.currentKg / dog.targetKg < YOUNG_PUPPY)
      notes.push({ level: "warn", text: "Calorie estimates for very young puppies vary a lot. Ask your vet to confirm this amount." });
    return {
      grams: gramsForKcal(kcal, food.energy.kcalPer100g),
      method: "calories",
      how: `From calories: about ${Math.round(kcal)} kcal a day for a growing puppy of ${kg1(dog.currentKg)} heading for ${kg1(dog.targetKg)}.`,
      notes,
    };
  }
  return { level: "stop", text: `${name} has no puppy guide, so we can't work out a puppy amount. Puppies need a food made for growth.` };
}

function checkInput(dog: DogInput): Note[] {
  const n: Note[] = [];
  const ok = (v: number) => Number.isFinite(v) && v >= LIMITS.minKg && v <= LIMITS.maxKg;
  if (!ok(dog.currentKg)) n.push({ level: "stop", text: `Enter your dog's current weight (${LIMITS.minKg}–${LIMITS.maxKg} kg).` });
  if (!ok(dog.targetKg))
    n.push({
      level: "stop",
      text: dog.stage === "puppy" ? `Enter the expected adult weight (${LIMITS.minKg}–${LIMITS.maxKg} kg).` : `Enter a target weight (${LIMITS.minKg}–${LIMITS.maxKg} kg).`,
    });
  if (n.length) return n;
  if (dog.stage === "puppy" && dog.currentKg >= dog.targetKg)
    n.push({ level: "stop", text: "Your puppy already weighs their expected adult weight. Choose Adult and feed for their target weight." });
  const change = Math.abs(dog.targetKg - dog.currentKg) / dog.currentKg;
  if (dog.stage !== "puppy" && change > STOP_CHANGE)
    n.push({
      level: "stop",
      text: `A target of ${kg1(dog.targetKg)} is a ${Math.round(change * 100)}% change from ${kg1(dog.currentKg)}. Check both weights; for a change this big, ask your vet to set the target.`,
    });
  return n;
}

function goalNotes(dog: DogInput): { goal: Goal; notes: Note[] } {
  const notes: Note[] = [];
  if (dog.stage === "puppy") {
    notes.push({ level: "info", text: "Weigh your puppy every week or two and recalculate: amounts change quickly while they grow." });
    return { goal: "grow", notes };
  }
  const change = (dog.targetKg - dog.currentKg) / dog.currentKg;
  if (Math.abs(change) <= MAINTAIN_BAND) {
    notes.push({ level: "info", text: "Weigh your dog every month. If their weight drifts, adjust by about 10%." });
    return { goal: "maintain", notes };
  }
  const lose = change < 0;
  // A safe pace is at most 1–2% of body weight a week. Feeding for the target weight is gentler than that, so we
  // give the safe limit rather than promising a timeline.
  const kgWeek = (rate: number) => Math.round(dog.currentKg * rate * 100) / 100;
  notes.push({
    level: "info",
    text: lose
      ? `These amounts are for the target weight of ${kg1(dog.targetKg)}, a gentle way to start weight loss. Expect slow, steady progress; losing more than ${kgWeek(0.01)}–${kgWeek(0.02)} kg a week (1–2%) isn't safe.`
      : `These amounts are for the target weight of ${kg1(dog.targetKg)}. Gain gradually: no more than ${kgWeek(0.01)}–${kgWeek(0.02)} kg a week (1–2%).`,
  });
  notes.push({
    level: "info",
    text: lose
      ? "Weigh every 2 weeks. If the scale hasn't moved after 3–4 weeks, reduce by about 10%."
      : "Weigh every 2 weeks. If there's no gain after 3–4 weeks, add about 10%.",
  });
  if (Math.abs(change) > WARN_CHANGE)
    notes.push({ level: "warn", text: `That's a ${Math.round(Math.abs(change) * 100)}% change in weight. Please check the target with your vet first.` });
  return { goal: lose ? "lose" : "gain", notes };
}

export function makePlan(dog: DogInput, choices: FoodChoice[]): Plan {
  const inputProblems = checkInput(dog);
  if (inputProblems.length) return { ok: false, goal: "maintain", items: [], notes: inputProblems };
  if (choices.length === 0) return { ok: false, goal: "maintain", items: [], notes: [{ level: "stop", text: "Choose a food." }] };

  const meals = Number.isFinite(dog.meals) ? Math.min(LIMITS.maxMeals, Math.max(LIMITS.minMeals, Math.round(dog.meals))) : 2;
  const { goal, notes } = goalNotes(dog);
  const items: PlanItem[] = [];
  const stops: Note[] = [];

  for (const c of choices) {
    const r = dog.stage === "puppy" ? fullDayPuppy(c.food, dog) : fullDayAdult(c.food, dog);
    if ("level" in r) {
      stops.push(r);
      continue;
    }
    notes.push(...r.notes);
    const grams = r.grams * c.share;
    const pkg = c.food.package;
    const perDay = roundGrams(grams);
    items.push({
      food: c.food,
      share: c.share,
      fullDayGrams: roundGrams(r.grams),
      gramsPerDay: perDay,
      // Whole grams from the rounded daily amount, so the meals add back up to the day.
      gramsPerMeal: Math.max(1, Math.round(perDay / meals)),
      packagesPerDay: pkg ? roundQuarter(grams / pkg.grams) : undefined,
      kcalPerDay: c.food.energy ? Math.round((grams * c.food.energy.kcalPer100g) / 100) : undefined,
      method: r.method,
      how: r.how,
    });
  }
  if (stops.length) return { ok: false, goal, items: [], notes: stops };

  // Mixing assumes each food's full-day amount is a full day of energy. A label food with no energy figure mixed
  // with a calorie-based food can't be checked, and for puppies the two can differ a lot.
  const unknownLabel = items.find((i) => i.method === "label" && i.kcalPerDay === undefined);
  if (unknownLabel && items.some((i) => i.method === "calories"))
    notes.push({
      level: "warn",
      text: `${[unknownLabel.food.brand, unknownLabel.food.name].filter(Boolean).join(" ")} doesn't list its calories, so the split between the two foods is approximate. Weigh ${dog.stage === "puppy" ? "your puppy" : "your dog"} every week or two and adjust.`,
    });

  // Veterinary diets are fed for a medical condition: the vet's plan outranks the label and our maths.
  // One note even when both foods are veterinary diets.
  const vetNames = items.filter((i) => i.food.vetDiet).map((i) => [i.food.brand, i.food.name].filter(Boolean).join(" "));
  if (vetNames.length)
    notes.unshift({
      level: "warn",
      text: `${vetNames.join(" and ")} ${vetNames.length > 1 ? "are veterinary diets" : "is a veterinary diet"}. Feed ${vetNames.length > 1 ? "them" : "it"} under your vet's care, and if your vet has given you an amount, use theirs.${goal === "lose" || goal === "gain" ? " Change your dog's weight only as part of your vet's plan." : ""}`,
    });

  const allKnown = items.every((i) => i.kcalPerDay !== undefined);
  const totalKcal = allKnown ? items.reduce((s, i) => s + (i.kcalPerDay ?? 0), 0) : undefined;

  // Cross-check label amounts against a calorie estimate when we can.
  if (totalKcal !== undefined && items.some((i) => i.method === "label")) {
    const expected = dog.stage === "puppy" ? puppyKcal(dog.currentKg, dog.targetKg) : adultKcal(dog.targetKg, dog.activity);
    const ratio = totalKcal / expected;
    // Puppy labels commonly sit well below the NRC growth estimate, so puppies get a wider band.
    const [lowR, highR] = dog.stage === "puppy" ? [0.55, 1.5] : [0.75, 1.3];
    if (ratio > highR || ratio < lowR)
      notes.push({
        level: "info",
        text: `The label amount gives about ${totalKcal} kcal a day, ${ratio > 1 ? "more" : "less"} than a typical estimate of ${Math.round(expected)} kcal. Labels and estimates are both starting points: let the scales decide.`,
      });
  }

  if (dog.stage === "senior")
    notes.push({ level: "info", text: "Older dogs often need a little less as they slow down. Watch their weight and adjust by about 10%." });
  notes.push({ level: "info", text: "Treats count: keep them under 10% of the day's food, and feed a little less at meals to make room." });

  return { ok: true, goal, items, totalKcal, notes };
}
