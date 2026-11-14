// Loads the food list. Real foods come from src/data/foods/*.json. The made-up foods in src/data/demo/ are
// only included in development builds (import.meta.env.DEV is false in production, so they are dropped).

import demoDry from "../data/demo/demo-adult-dry.json";
import demoWet from "../data/demo/demo-adult-wet.json";
import { toKcalPer100g, type EnergyUnit } from "./energy";
import type { Food, FoodType } from "./types";
import { validateFood } from "./validate";

const files = import.meta.glob<Food>("../data/foods/*.json", { eager: true, import: "default" });

function load(): Food[] {
  const raw: unknown[] = [...Object.values(files), ...(import.meta.env.DEV ? [demoDry, demoWet] : [])];
  return raw
    .filter((f): f is Food => validateFood(f).length === 0)
    .sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
}

export const FOODS: Food[] = load();

export function findFood(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

export interface CustomFoodInput {
  name: string;
  type: FoodType;
  energyValue: number;
  energyUnit: EnergyUnit;
  /** Can/tray/pouch size in grams, 0 if none. */
  packageGrams: number;
}

export const CUSTOM_NAME_MAX = 60;

/** A food the owner typed in from their bag or can. Calories only; no label table. */
export function customFood(input: CustomFoodInput, slot: number): Food | undefined {
  if (!Number.isFinite(input.energyValue) || input.energyValue <= 0) return undefined;
  const kcalPer100g = toKcalPer100g(input.energyValue, input.energyUnit);
  if (kcalPer100g < 40 || kcalPer100g > 650) return undefined;
  const name = input.name.trim().slice(0, CUSTOM_NAME_MAX) || (input.type === "wet" ? "Your wet food" : "Your dry food");
  return {
    id: `custom-${slot}`,
    brand: "",
    name,
    type: input.type,
    energy: { kcalPer100g },
    package:
      input.type === "wet" && Number.isFinite(input.packageGrams) && input.packageGrams > 0
        ? { label: "can", grams: input.packageGrams }
        : undefined,
    source: { kind: "label", addedOn: "2026-01-01" },
    custom: true,
  };
}

/** Typical energy for a sanity hint under the custom energy field. */
export const TYPICAL_KCAL_PER_100G: Record<FoodType, string> = {
  dry: "Dry food is usually 330–420 kcal per 100 g (1,400–1,750 kJ).",
  wet: "Wet food is usually 70–130 kcal per 100 g (290–540 kJ).",
};
