import { useId } from "react";
import { ENERGY_UNITS, type EnergyUnit } from "../feeding/energy";
import { CUSTOM_NAME_MAX, FOODS, TYPICAL_KCAL_PER_100G } from "../feeding/foods";
import type { Food } from "../feeding/types";
import type { FoodSlot } from "../state";
import { NumberField, Segmented } from "./Controls";

const CUSTOM = "__custom";

function covers(f: Food): string {
  const parts = [f.puppyGuide && "puppy guide", f.adultGuide && "adult guide"].filter(Boolean);
  return parts.length ? parts.join(" + ") : "calories only";
}

export function FoodPicker(props: { label: string; slot: FoodSlot; onChange: (s: FoodSlot) => void; customInvalid: boolean }) {
  const id = useId();
  const { slot, onChange } = props;
  const set = (patch: Partial<FoodSlot["custom"]>) => onChange({ ...slot, custom: { ...slot.custom, ...patch } });
  const groups: { label: string; foods: Food[] }[] = [
    { label: "Dry food", foods: FOODS.filter((f) => f.type === "dry") },
    { label: "Wet food", foods: FOODS.filter((f) => f.type === "wet") },
  ].filter((g) => g.foods.length);

  return (
    <div className="food-picker">
      {FOODS.length > 0 && (
        <div className="field">
          <label className="field-label" htmlFor={id}>
            {props.label}
          </label>
          <select
            id={id}
            className="select"
            value={slot.mode === "custom" ? CUSTOM : slot.foodId}
            onChange={(e) =>
              e.target.value === CUSTOM ? onChange({ ...slot, mode: "custom" }) : onChange({ ...slot, mode: "list", foodId: e.target.value })
            }
          >
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.foods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.brand} {f.name} · {covers(f)}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM}>Not listed: enter it from the bag or can</option>
          </select>
        </div>
      )}

      {slot.mode === "custom" && (
        <div className="custom-food">
          {FOODS.length === 0 && <p className="field-label">{props.label}</p>}
          <p className="hint">
            Find the energy on the bag or can. It's usually near the analysis and printed as kcal or kJ (per kg or per
            100 g).
          </p>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-name`}>
              Name <span className="optional">(optional)</span>
            </label>
            <input
              id={`${id}-name`}
              className="text"
              type="text"
              autoComplete="off"
              maxLength={CUSTOM_NAME_MAX}
              value={slot.custom.name}
              placeholder="e.g. Chicken kibble"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <Segmented
            label="Type"
            value={slot.custom.type}
            options={[
              { value: "dry", label: "Dry" },
              { value: "wet", label: "Wet" },
            ]}
            onChange={(type) => set({ type })}
          />
          <div className="energy-row">
            <NumberField
              label="Energy"
              value={slot.custom.energy}
              onChange={(energy) => set({ energy })}
              unit=""
              placeholder={slot.custom.type === "dry" ? "e.g. 380" : "e.g. 95"}
              invalid={props.customInvalid}
            />
            <div className="field">
              <label className="field-label" htmlFor={`${id}-unit`}>
                Per
              </label>
              <select id={`${id}-unit`} className="select" value={slot.custom.unit} onChange={(e) => set({ unit: e.target.value as EnergyUnit })}>
                {ENERGY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="hint">
            {props.customInvalid ? "That figure looks off. Check it's the right unit. " : ""}
            {TYPICAL_KCAL_PER_100G[slot.custom.type]}
          </p>
          {slot.custom.type === "wet" && (
            <NumberField
              label="Can or tray size (optional)"
              value={slot.custom.packageGrams}
              onChange={(packageGrams) => set({ packageGrams })}
              unit="g"
              placeholder="e.g. 400"
            />
          )}
        </div>
      )}
    </div>
  );
}
