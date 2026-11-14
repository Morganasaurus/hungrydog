// Shapes of the food and breed data in src/data/. Every food file is checked by validateFood (foods.ts) in
// the tests, so a mistake in a guide fails CI before it can reach the public site.

export type FoodType = "dry" | "wet";

/** Health conditions the app can show extra information for (src/feeding/conditions.ts). */
export type ConditionId = "kidney";

/** Nutrients we track for health conditions. */
export type NutrientId = "phosphorus";

export interface NutrientValue {
  /** Percent of the food as fed (as it comes out of the bag or can, water included). */
  percent: number;
  /** How the label or maker states it: a typical (average) value, or a guaranteed minimum or maximum. */
  kind: "typical" | "min" | "max";
}

/** One row of an adult feeding table: a dog of this weight gets this much a day. */
export interface AdultGuidePoint {
  weightKg: number;
  /** Daily grams. When the label gives a range ("95–155 g"), gramsLow and gramsHigh hold both ends. */
  gramsLow: number;
  gramsHigh?: number;
}

/** One row of a puppy table column: a puppy currently this heavy gets this much a day. */
export interface PuppyGuidePoint {
  weightKg: number;
  grams: number;
  /** The label marks this row as the point to move to adult food (often an asterisk). */
  transition?: boolean;
}

/** One column of a puppy table: all puppies expected to weigh `adultKg` when grown. */
export interface PuppyColumn {
  adultKg: number;
  points: PuppyGuidePoint[];
}

export interface PuppyGuide {
  columns: PuppyColumn[];
  /** What the label says to move to at the transition point, e.g. "ORIJEN Original Dog Food". */
  transitionTo?: string;
}

export interface Food {
  /** Same as the file name without .json, lower-case words joined by dashes. */
  id: string;
  brand: string;
  name: string;
  type: FoodType;
  /** Metabolisable energy. Only from the label or the maker's own published figure, never estimated. */
  energy?: { kcalPer100g: number };
  /** Wet food sold in a fixed unit, so results can say "1½ cans". */
  package?: { label: string; grams: number };
  adultGuide?: AdultGuidePoint[];
  puppyGuide?: PuppyGuide;
  /** Short notes copied from the label that matter to owners (feed twice daily, gestation…). */
  labelNotes?: string[];
  source: {
    kind: "label" | "maker-website";
    /** ISO date (YYYY-MM-DD) the guide was added. */
    addedOn: string;
    /** Which figures came from where, and anything judged along the way. */
    notes?: string;
    /** Pages researched for this food (the maker's own pages first). */
    links?: { title: string; url: string; accessed: string }[];
  };
  /** Nutrient content, from the label or the maker's published analysis only (cited in source.notes). */
  nutrients?: Partial<Record<NutrientId, NutrientValue>>;
  /** Health conditions this food is made for, e.g. a renal diet → ["kidney"]. */
  forConditions?: ConditionId[];
  /** A veterinary (prescription) diet. The app still shows the label's amounts, but tells the owner up front that
   *  their vet's plan and amounts come first. */
  vetDiet?: true;
  /** Made-up sample data for development. Never shipped in a production build. */
  demo?: boolean;
  /** Typed in by the owner from their bag or can (calories only). Never set in data files. */
  custom?: boolean;
}

export type SizeClass = "toy" | "small" | "medium" | "large" | "giant";
export type EnergyLevel = "low" | "moderate" | "high";

export interface Breed {
  id: string;
  name: string;
  aliases?: string[];
  sizeClass: SizeClass;
  /** Typical healthy adult weight ranges, [min, max] kg. */
  weightKg: { male: [number, number]; female: [number, number] };
  energy: EnergyLevel;
  /** Typical life expectancy, [min, max] years. Senior age is worked out from this (last quarter of life). */
  lifespanYears: [number, number];
  /** Short owner-facing caveat, e.g. that a crossbreed's size varies a lot. */
  note?: string;
  sources: { title: string; url: string; accessed: string }[];
}

/** General life-stage guidance by size, from veterinary sources (src/data/life-stages.json). */
export interface LifeStages {
  /** Age range (months) at which dogs of each size usually finish growing. */
  grownMonths: Record<SizeClass, [number, number]>;
  /** A dog counts as senior from this share of its expected life span (0.75 = the last quarter). */
  seniorShareOfLifespan: number;
  /** Used when no breed is chosen: typical senior age by size, [min, max] years. */
  seniorYears: Record<SizeClass, [number, number]>;
  sources: { title: string; url: string; accessed: string }[];
}
