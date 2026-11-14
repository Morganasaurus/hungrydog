// Energy maths. These are standard veterinary starting points, not prescriptions; the app always tells owners
// to adjust using the scales.

export type Activity = "low" | "typical" | "high";

/** Multiplier applied to a label's amount, and to the calorie estimate, for how active the dog is. */
export const ACTIVITY_FACTOR: Record<Activity, number> = { low: 0.9, typical: 1, high: 1.2 };

/** Resting energy requirement, kcal/day: 70 × kg^0.75. */
export function rer(kg: number): number {
  return 70 * Math.pow(kg, 0.75);
}

/** Typical desexed, normally active adult: 1.6 × RER. */
export const ADULT_MAINTENANCE_FACTOR = 1.6;

/** Daily kcal for an adult at this weight and activity level. */
export function adultKcal(kg: number, activity: Activity): number {
  return ADULT_MAINTENANCE_FACTOR * ACTIVITY_FACTOR[activity] * rer(kg);
}

/**
 * Daily kcal for a growing puppy after weaning (NRC 2006):
 * 130 × kg^0.75 × 3.2 × (e^(−0.87 × p) − 0.1), where p = current weight ÷ expected adult weight.
 */
export function puppyKcal(kg: number, adultKg: number): number {
  const p = Math.min(kg / adultKg, 1);
  return 130 * Math.pow(kg, 0.75) * 3.2 * (Math.exp(-0.87 * p) - 0.1);
}

export type EnergyUnit = "kcal/100g" | "kcal/kg" | "kJ/100g" | "kJ/kg";
export const ENERGY_UNITS: EnergyUnit[] = ["kcal/100g", "kcal/kg", "kJ/100g", "kJ/kg"];
const KJ_PER_KCAL = 4.184;

/** Converts an energy figure as printed on a bag or can to kcal per 100 g. */
export function toKcalPer100g(value: number, unit: EnergyUnit): number {
  switch (unit) {
    case "kcal/100g":
      return value;
    case "kcal/kg":
      return value / 10;
    case "kJ/100g":
      return value / KJ_PER_KCAL;
    case "kJ/kg":
      return value / 10 / KJ_PER_KCAL;
  }
}

/** Grams of a food that supply `kcal`. */
export function gramsForKcal(kcal: number, kcalPer100g: number): number {
  return (kcal / kcalPer100g) * 100;
}
