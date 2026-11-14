import { describe, expect, it } from "vitest";
import { brandsOf, foodForBrand, foodsOfBrand } from "./foods";
import type { Food } from "./types";

const food = (id: string, brand: string, name: string, type: Food["type"]): Food => ({
  id,
  brand,
  name,
  type,
  source: { kind: "label", addedOn: "2026-01-01" },
});

const LIST = [
  food("b-wet", "Bravo", "Chicken Can", "wet"),
  food("a-1", "alpha", "Adult", "dry"),
  food("b-dry-z", "Bravo", "Zesty Kibble", "dry"),
  food("b-dry-a", "Bravo", "Active Kibble", "dry"),
];

describe("brand then food", () => {
  it("lists each brand once, A–Z ignoring case", () => {
    expect(brandsOf(LIST)).toEqual(["alpha", "Bravo"]);
    expect(brandsOf([])).toEqual([]);
  });

  it("lists a brand's dry foods before its wet ones, A–Z within each", () => {
    expect(foodsOfBrand(LIST, "Bravo").map((f) => f.id)).toEqual(["b-dry-a", "b-dry-z", "b-wet"]);
    expect(foodsOfBrand(LIST, "Nobody")).toEqual([]);
  });

  it("picks a brand's only product, but leaves the choice open when there are several", () => {
    expect(foodForBrand(LIST, "alpha")).toBe("a-1");
    expect(foodForBrand(LIST, "Bravo")).toBe("");
    expect(foodForBrand(LIST, "Nobody")).toBe("");
  });
});
