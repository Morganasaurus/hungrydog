// Loads breed data and the general life-stage guidance. Invalid entries are dropped, not shown.

import breedsRaw from "../data/breeds.json";
import type { Breed, LifeStages } from "./types";
import { validateBreed, validateLifeStages } from "./validate";

export const BREEDS: Breed[] = (breedsRaw as unknown[])
  .filter((b): b is Breed => validateBreed(b).length === 0)
  .sort((a, b) => a.name.localeCompare(b.name));

// Optional file: the glob is empty until it exists.
const lifeFiles = Object.values(import.meta.glob("../data/life-stages.json", { eager: true, import: "default" }));
export const LIFE_STAGES: LifeStages | undefined = lifeFiles.find((l): l is LifeStages => validateLifeStages(l).length === 0);

export function findBreed(id: string): Breed | undefined {
  return BREEDS.find((b) => b.id === id);
}
