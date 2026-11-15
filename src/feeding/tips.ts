// Tips shown beside the form: how many meals a day, and what age counts as grown or senior. Pure functions so
// they can be tested; the wording must stay accurate and sourced (see TIP_SOURCES).

import type { Stage } from "./plan";
import type { Breed, ConditionId, LifeStages, SizeClass } from "./types";

export interface Tip {
  title: string;
  lines: string[];
  /** A gentle heads-up about the current choice (e.g. one meal for a large dog). */
  caution?: string;
  sources: { title: string; url: string }[];
}

export const TIP_SOURCES = {
  rspcaPuppy: { title: "RSPCA Australia: What should I feed my puppy?", url: "https://kb.rspca.org.au/knowledge-base/what-should-i-feed-my-puppy/" },
  rspcaDog: { title: "RSPCA Australia: What should I feed my dog?", url: "https://kb.rspca.org.au/knowledge-base/what-should-i-feed-my-dog/" },
  acvsGdv: { title: "ACVS: Gastric dilatation-volvulus", url: "https://acvs.org/small-animal/gastric-dilatation-volvulus/" },
  irisDog: {
    title: "IRIS: Treatment recommendations for CKD in dogs (2026)",
    url: "https://www.iris-kidney.com/s/IRIS-DOG-Treatment_Recommendations_may-2026.pdf",
  },
  tuftsKidneyDiet: {
    title: "Tufts Petfoodology: My pet has kidney disease, what should I feed?",
    url: "https://sites.tufts.edu/petfoodology/2016/05/03/my-pet-has-kidney-disease-what-kind-of-diet-should-i-feed/",
  },
  tuftsKidneyTreats: {
    title: "Tufts Petfoodology: Treats for dogs with kidney disease",
    url: "https://sites.tufts.edu/petfoodology/2018/05/23/what-treats-can-i-give-my-dog-with-kidney-disease/",
  },
  acvnCkd: {
    title: "ACVN Nutrition Notes: Nutritional management of chronic kidney disease (Today's Veterinary Practice, 2016)",
    url: "https://todaysveterinarypractice.com/wp-content/uploads/sites/4/2016/05/2016-0304_ACVN-Nutrition.pdf",
  },
  fediaf: {
    title: "FEDIAF Nutritional Guidelines 2025 (adult dog minimums)",
    url: "https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf",
  },
  tuftsSwitch: { title: "Tufts Petfoodology: How do I switch my pet's food?", url: "https://sites.tufts.edu/petfoodology/2019/11/24/how-do-i-switch-my-pets-food/" },
};

/** Size class from an adult weight: same bands the breed data uses. */
export function sizeFromWeight(kg: number): SizeClass | undefined {
  if (!Number.isFinite(kg) || kg <= 0) return undefined;
  if (kg < 5) return "toy";
  if (kg < 10) return "small";
  if (kg < 25) return "medium";
  if (kg <= 45) return "large";
  return "giant";
}

/** "Labradoodle (standard)" → "Labradoodles (standard)", "Siberian Husky" → "Siberian Huskies". */
export function pluralBreed(name: string): string {
  const m = /^(.*?)(\s*\(.*\))?$/.exec(name)!;
  const base = m[1];
  const rest = m[2] ?? "";
  const plural = /[^aeiou]y$/i.test(base) ? `${base.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(base) ? `${base}es` : `${base}s`;
  return plural + rest;
}

const SIZE_WORD: Record<SizeClass, string> = { toy: "toy", small: "small", medium: "medium", large: "large", giant: "giant" };
const big = (s: SizeClass | undefined) => s === "large" || s === "giant";

export function mealsTip(stage: Stage, size: SizeClass | undefined, meals: number, breedName?: string): Tip {
  const who = breedName ? pluralBreed(breedName) : big(size) ? "Large, deep-chested dogs" : undefined;
  const bloat = `${who ?? "Large, deep-chested dogs"} are prone to bloat (GDV), which can be fatal. Split food into 2–3 meals and avoid hard exercise just before and after eating.`;

  if (stage === "puppy") {
    const lines = [
      "Young puppies have small stomachs: start at 4 meals a day and cut back gradually as they grow, to 2 meals as adults.",
      big(size)
        ? "Large and giant breeds often stay on 3 meals a day for longer, so keep meals smaller while they grow."
        : "Most puppies can move to 2–3 meals somewhere between 6 and 12 months.",
    ];
    if (big(size)) lines.push(bloat);
    return {
      title: "Meals for a puppy",
      lines,
      caution:
        meals < 2
          ? "One meal a day isn't enough for a puppy: their stomachs are too small. Use at least 3 while they're young."
          : meals === 2
            ? "2 meals suits older puppies. If yours is under about 6 months, 3–4 smaller meals are better."
            : undefined,
      sources: big(size) ? [TIP_SOURCES.rspcaPuppy, TIP_SOURCES.acvsGdv] : [TIP_SOURCES.rspcaPuppy],
    };
  }

  const lines = ["Most adult dogs do best on at least 2 meals a day, roughly 8–12 hours apart. One large meal a day raises the risk of bloat."];
  if (big(size)) lines.push(bloat);
  if (stage === "senior") lines.push("Older dogs may prefer smaller, more frequent meals. Keep the daily total the same.");
  return {
    title: stage === "senior" ? "Meals for an older dog" : "Meals a day",
    lines,
    caution: meals < 2 ? "One meal a day isn't recommended: split it into at least two." : undefined,
    sources: big(size) ? [TIP_SOURCES.rspcaDog, TIP_SOURCES.acvsGdv] : [TIP_SOURCES.rspcaDog],
  };
}

const range = ([a, b]: [number, number], unit: string) => (a === b ? `${a} ${unit}` : `${a}–${b} ${unit}`);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** When the breed (or a dog of this size) finishes growing and counts as senior. */
export function ageTip(stage: Stage, size: SizeClass | undefined, life: LifeStages | undefined, breed?: Breed, weightKg?: number): Tip | undefined {
  if (!life) return undefined;
  const s = breed?.sizeClass ?? size;
  if (!s) return undefined;

  const grown = life.grownMonths[s];
  const lines: string[] = [];
  const name = breed ? breed.name : `A ${SIZE_WORD[s]} dog`;
  const plural = breed ? pluralBreed(breed.name) : `${SIZE_WORD[s][0].toUpperCase()}${SIZE_WORD[s].slice(1)} dogs`;

  let seniorText: string;
  if (breed) {
    const share = life.seniorShareOfLifespan;
    const from = Math.round(breed.lifespanYears[0] * share);
    const to = Math.round(breed.lifespanYears[1] * share);
    seniorText = `${plural} usually live ${range(breed.lifespanYears, "years")}, so they count as senior from about ${range([from, to], "years")} (the last quarter of life).`;
  } else {
    seniorText = `${plural} usually count as senior from about ${range(life.seniorYears[s], "years")}.`;
  }

  if (stage === "puppy") {
    lines.push(`${plural} usually finish growing at about ${range(grown, "months")}. Keep feeding puppy food until then, or until the food's label says to switch.`);
    lines.push(seniorText);
  } else {
    lines.push(seniorText);
    lines.push(`${plural} are usually fully grown by ${range(grown, "months")}.`);
  }

  let caution: string | undefined;
  if (breed) {
    const { male, female } = breed.weightKg;
    lines.push(`Typical adult weight: males ${range(male, "kg")}, females ${range(female, "kg")}.`);
    const lo = Math.min(male[0], female[0]);
    const hi = Math.max(male[1], female[1]);
    if (weightKg !== undefined && Number.isFinite(weightKg) && (weightKg < lo * 0.9 || weightKg > hi * 1.1))
      caution = `${round1(weightKg)} kg is outside the usual ${range([lo, hi], "kg")} for a ${name}. Dogs vary, but it's worth checking ${stage === "puppy" ? "the expected adult weight" : "the target"} with your vet.`;
    if (breed.note) lines.push(breed.note);
  }

  return {
    title: breed ? `Age guide: ${breed.name}` : "Age guide",
    lines,
    caution,
    sources: [...(breed?.sources.slice(0, 2) ?? []), ...life.sources.slice(0, 1)].map(({ title, url }) => ({ title, url })),
  };
}

/**
 * Guidance for a dog with a health condition. Every line is from the cited vet sources (IRIS 2026 dog
 * recommendations, Tufts Petfoodology); keep it that way. `onConditionDiet`: is any chosen food made for it?
 */
export function conditionTip(condition: ConditionId, onConditionDiet: boolean | undefined): Tip {
  return CONDITION_TIPS[condition](onConditionDiet);
}

// One entry per condition in conditions.ts; TypeScript insists on it.
const CONDITION_TIPS: Record<ConditionId, (onConditionDiet: boolean | undefined) => Tip> = {
  kidney: (onConditionDiet) => ({
    title: "Kidney disease",
    lines: [
      "Less phosphorus in the diet helps dogs with kidney disease. Vets usually suggest a kidney (renal) diet from IRIS stage 2, and recommend one at stages 3 and 4.",
      "At stage 1, a renal diet is usually only advised if there's protein in the urine.",
      "As a guide, kidney diets usually provide about 0.4–1.2 g of phosphorus per 1,000 kcal. Complete adult dog foods are made to provide at least 1.0 g (the AAFCO and FEDIAF minimum) and usually have more than 1.5 g. There's no official target for every dog: your vet sets your dog's.",
      "Your vet checks phosphate in blood tests and may add a phosphate binder with meals if it stays high. Follow their plan for which food and how much.",
      "Foods from the pet store usually have too much phosphorus and protein for anything beyond very mild kidney disease.",
      "Keep fresh water available at all times: dogs with kidney disease can't concentrate their urine well.",
      "Change foods gradually, over at least a week. Some dogs need 4–6 weeks.",
      "Treats add phosphorus too: keep them under 10% of the day's calories, and avoid meat treats, jerky, bully sticks, rawhide, pig ears, antlers and real bones.",
    ],
    caution:
      onConditionDiet === false
        ? "None of the foods chosen is listed here as a kidney diet. Ask your vet whether your dog should be on one."
        : undefined,
    sources: [
      TIP_SOURCES.irisDog,
      TIP_SOURCES.acvnCkd,
      TIP_SOURCES.fediaf,
      TIP_SOURCES.tuftsKidneyDiet,
      TIP_SOURCES.tuftsKidneyTreats,
      TIP_SOURCES.tuftsSwitch,
    ],
  }),
};
