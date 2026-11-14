// The form, saved in this browser's localStorage so it's still there next visit. Nothing leaves the device.
// Add new fields with defaults; never rename the key (it would wipe everyone's saved form).

import { useEffect, useState } from "react";
import { ENERGY_UNITS, type Activity, type EnergyUnit } from "./feeding/energy";
import { BREEDS } from "./feeding/breeds";
import { CUSTOM_NAME_MAX, FOODS, brandsOf, findFood, foodForBrand, type CustomFoodInput } from "./feeding/foods";
import type { Stage } from "./feeding/plan";
import type { FoodType } from "./feeding/types";

const KEY = "hungrydog.v1";

export interface FoodSlot {
  mode: "list" | "custom";
  /** The brand picked first. Kept separately so a brand with several products can be picked before its food. */
  brand: string;
  /** The food, or "" while the owner still has to choose one of the brand's products. */
  foodId: string;
  custom: { name: string; type: FoodType; energy: string; unit: EnergyUnit; packageGrams: string };
}

export interface Form {
  stage: Stage;
  /** Breed id, or "" for not set. */
  breed: string;
  current: string;
  target: string;
  activity: Activity;
  meals: number;
  mix: boolean;
  /** Food 1's share of the day, percent. */
  share1: number;
  foods: [FoodSlot, FoodSlot];
}

const emptySlot = (type: FoodType): FoodSlot => {
  const food = FOODS.find((f) => f.type === type) ?? FOODS[0];
  return {
    mode: FOODS.length ? "list" : "custom",
    brand: food?.brand ?? "",
    foodId: food?.id ?? "",
    custom: { name: "", type, energy: "", unit: "kcal/100g", packageGrams: "" },
  };
};

export const DEFAULT_FORM: Form = {
  stage: "adult",
  breed: "",
  current: "",
  target: "",
  activity: "typical",
  meals: 2,
  mix: false,
  share1: 75,
  foods: [emptySlot("dry"), emptySlot("wet")],
};

// Saved data is untrusted: pick out only known fields of the right type.
const str = (v: unknown, fallback: string, max = 12) => (typeof v === "string" ? v.slice(0, max) : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

function readSlot(v: unknown, fallback: FoodSlot): FoodSlot {
  if (typeof v !== "object" || v === null) return fallback;
  const s = v as Record<string, unknown>;
  const c = (typeof s.custom === "object" && s.custom !== null ? s.custom : {}) as Record<string, unknown>;
  // A known food sets the brand. Otherwise a known brand with no food yet is kept; anything else falls back.
  const food = findFood(str(s.foodId, "", 80));
  const brand = str(s.brand, "", 80);
  const pick = food
    ? { brand: food.brand, foodId: food.id }
    : brandsOf(FOODS).includes(brand)
      ? { brand, foodId: foodForBrand(FOODS, brand) }
      : { brand: fallback.brand, foodId: fallback.foodId };
  return {
    mode: FOODS.length ? oneOf(s.mode, ["list", "custom"] as const, fallback.mode) : "custom",
    ...pick,
    custom: {
      name: str(c.name, "", CUSTOM_NAME_MAX),
      type: oneOf(c.type, ["dry", "wet"] as const, fallback.custom.type),
      energy: str(c.energy, ""),
      unit: oneOf(c.unit, ENERGY_UNITS, "kcal/100g"),
      packageGrams: str(c.packageGrams, ""),
    },
  };
}

function load(): Form {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_FORM;
    const v = JSON.parse(raw) as Record<string, unknown>;
    const foods = Array.isArray(v.foods) ? v.foods : [];
    return {
      stage: oneOf(v.stage, ["puppy", "adult", "senior"] as const, DEFAULT_FORM.stage),
      breed: BREEDS.some((b) => b.id === v.breed) ? (v.breed as string) : "",
      current: str(v.current, ""),
      target: str(v.target, ""),
      activity: oneOf(v.activity, ["low", "typical", "high"] as const, DEFAULT_FORM.activity),
      meals: int(v.meals, 1, 4, DEFAULT_FORM.meals),
      mix: v.mix === true,
      share1: int(v.share1, 10, 90, DEFAULT_FORM.share1),
      foods: [readSlot(foods[0], DEFAULT_FORM.foods[0]), readSlot(foods[1], DEFAULT_FORM.foods[1])],
    };
  } catch {
    return DEFAULT_FORM;
  }
}

export function useForm(): [Form, (update: (f: Form) => Form) => void, () => void] {
  const [form, setForm] = useState<Form>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(form));
    } catch {
      // Private mode or storage full: the app still works, it just won't remember.
    }
  }, [form]);
  return [form, (update) => setForm((f) => update(f)), () => setForm(DEFAULT_FORM)];
}

/** Parses a weight or number typed by a person: accepts "12,5" as well as "12.5". */
export function parseNumber(text: string): number {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export function slotCustomInput(slot: FoodSlot): CustomFoodInput {
  return {
    name: slot.custom.name,
    type: slot.custom.type,
    energyValue: parseNumber(slot.custom.energy),
    energyUnit: slot.custom.unit,
    packageGrams: slot.custom.packageGrams ? parseNumber(slot.custom.packageGrams) : 0,
  };
}
