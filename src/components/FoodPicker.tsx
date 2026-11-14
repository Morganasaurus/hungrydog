import { ENERGY_UNITS, type EnergyUnit } from "../feeding/energy";
import { CUSTOM_NAME_MAX, FOODS, TYPICAL_KCAL_PER_100G, brandsOf, foodForBrand, foodsOfBrand } from "../feeding/foods";
import type { Food } from "../feeding/types";
import type { FoodSlot } from "../state";
import { Group, NumberRow, Row, Segmented, SelectRow } from "./Controls";
import { useId, type ReactNode } from "react";

const CUSTOM = "__custom";

function covers(f: Food): string {
  // Listed foods without a puppy guide are adult-only in the app (see fullDayPuppy in plan.ts).
  const parts = [f.puppyGuide && "puppy", (f.adultGuide || !f.puppyGuide) && "adult"].filter(Boolean);
  return parts.join(" + ");
}

const BRANDS = brandsOf(FOODS);

/** One food as a grouped list: brand, then that brand's food; for a custom food, its details from the bag. */
export function FoodPicker(props: {
  title: string;
  slot: FoodSlot;
  onChange: (s: FoodSlot) => void;
  customInvalid: boolean;
  extraRows?: ReactNode;
  footer?: ReactNode;
}) {
  const nameId = useId();
  const { slot, onChange } = props;
  const set = (patch: Partial<FoodSlot["custom"]>) => onChange({ ...slot, custom: { ...slot.custom, ...patch } });
  const custom = slot.mode === "custom";
  const products = foodsOfBrand(FOODS, slot.brand);
  const mixedTypes = products.some((f) => f.type === "dry") && products.some((f) => f.type === "wet");
  const option = (f: Food) => (
    <option key={f.id} value={f.id}>
      {f.name} ({covers(f)})
    </option>
  );

  const footer = custom ? (
    <>
      {props.customInvalid ? "That energy figure looks off: check the unit. " : ""}
      Find the energy near the analysis on the bag or can. {TYPICAL_KCAL_PER_100G[slot.custom.type]}
    </>
  ) : (
    props.footer
  );

  return (
    <Group title={props.title} footer={footer}>
      {FOODS.length > 0 && (
        <SelectRow
          label="Brand"
          value={custom ? CUSTOM : slot.brand}
          onChange={(v) =>
            v === CUSTOM
              ? onChange({ ...slot, mode: "custom" })
              : onChange({ ...slot, mode: "list", brand: v, foodId: v === slot.brand ? slot.foodId : foodForBrand(FOODS, v) })
          }
        >
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value={CUSTOM}>Not listed: enter from the bag</option>
        </SelectRow>
      )}
      {!custom &&
        products.length > 0 &&
        (products.length === 1 ? (
          <Row label="Food">
            <span className="row-value">
              {products[0].name} ({covers(products[0])})
            </span>
          </Row>
        ) : (
          <SelectRow label="Food" value={slot.foodId} onChange={(foodId) => onChange({ ...slot, foodId })}>
            {slot.foodId === "" && (
              <option value="" disabled>
                Choose
              </option>
            )}
            {mixedTypes
              ? (["dry", "wet"] as const).map((t) => (
                  <optgroup key={t} label={t === "dry" ? "Dry food" : "Wet food"}>
                    {products.filter((f) => f.type === t).map(option)}
                  </optgroup>
                ))
              : products.map(option)}
          </SelectRow>
        ))}
      {custom && (
        <>
          <Row label="Name" htmlFor={nameId}>
            <span className="value-input">
              <input
                id={nameId}
                type="text"
                autoComplete="off"
                maxLength={CUSTOM_NAME_MAX}
                value={slot.custom.name}
                placeholder="Optional"
                onChange={(e) => set({ name: e.target.value })}
              />
            </span>
          </Row>
          <Segmented
            label="Type"
            value={slot.custom.type}
            options={[
              { value: "dry", label: "Dry" },
              { value: "wet", label: "Wet" },
            ]}
            onChange={(type) => set({ type })}
          />
          <NumberRow
            label="Energy"
            value={slot.custom.energy}
            onChange={(energy) => set({ energy })}
            placeholder={slot.custom.type === "dry" ? "380" : "95"}
            invalid={props.customInvalid}
          />
          <SelectRow label="Per" value={slot.custom.unit} onChange={(v) => set({ unit: v as EnergyUnit })}>
            {ENERGY_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectRow>
          {slot.custom.type === "wet" && (
            <NumberRow label="Can or tray size" value={slot.custom.packageGrams} onChange={(packageGrams) => set({ packageGrams })} unit="g" placeholder="Optional" />
          )}
        </>
      )}
      {props.extraRows}
    </Group>
  );
}
