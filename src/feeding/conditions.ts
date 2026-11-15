// Health conditions the owner can pick under "Dietary requirements" in "Your Dog". Each one switches on the nutrients that matter for it.
// Add a condition only with vet-sourced guidance for its tip (tips.ts) and nutrient data for the foods.

import type { ConditionId, NutrientId } from "./types";

export interface Condition {
  id: ConditionId;
  /** As shown in the Dietary requirements picker. */
  name: string;
  /** Nutrients shown in the result when this condition is picked. */
  nutrients: NutrientId[];
}

export const CONDITIONS: Condition[] = [{ id: "kidney", name: "Kidney disease", nutrients: ["phosphorus"] }];

export function findCondition(id: string): Condition | undefined {
  return CONDITIONS.find((c) => c.id === id);
}

export const NUTRIENT_NAME: Record<NutrientId, string> = { phosphorus: "Phosphorus" };
