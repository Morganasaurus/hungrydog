import { useMemo } from "react";
import { Group, NumberRow, Segmented, SelectRow, TipCard } from "./components/Controls";
import { FoodPicker } from "./components/FoodPicker";
import { Result } from "./components/Result";
import { BREEDS, LIFE_STAGES, findBreed } from "./feeding/breeds";
import { CONDITIONS, findCondition } from "./feeding/conditions";
import { customFood, findFood } from "./feeding/foods";
import { LIMITS, makePlan, type FoodChoice, type Plan } from "./feeding/plan";
import { ageTip, conditionTip, mealsTip, sizeFromWeight } from "./feeding/tips";
import { MIN_LIMIT_MG, parseMg, parseNumber, slotCustomInput, useForm, type FoodSlot } from "./state";

function slotFood(slot: FoodSlot, n: number) {
  return slot.mode === "custom" ? customFood(slotCustomInput(slot), n) : findFood(slot.foodId);
}

const weightOk = (v: number) => v >= LIMITS.minKg && v <= LIMITS.maxKg;

export default function App() {
  const [form, update, reset] = useForm();
  const puppy = form.stage === "puppy";
  const currentKg = parseNumber(form.current);
  const targetKg = parseNumber(form.target);
  const breed = findBreed(form.breed);
  const condition = findCondition(form.condition);
  const phosphorusLimit = parseMg(form.phosphorusLimit);
  const limitBad = form.phosphorusLimit !== "" && !(phosphorusLimit >= MIN_LIMIT_MG);
  const food1 = slotFood(form.foods[0], 1);
  const food2 = form.mix ? slotFood(form.foods[1], 2) : undefined;
  const customBad = (i: 0 | 1) => form.foods[i].mode === "custom" && form.foods[i].custom.energy !== "" && !slotFood(form.foods[i], i + 1);

  // Size for the tips: the breed's, or judged from the adult (target / expected adult) weight.
  const size = breed?.sizeClass ?? (weightOk(targetKg) ? sizeFromWeight(targetKg) : undefined);
  const meals = mealsTip(form.stage, size, form.meals, breed?.name);
  const chosenFoods = [food1, food2].filter((f) => f !== undefined);
  const health =
    condition &&
    conditionTip(
      condition.id,
      chosenFoods.length ? chosenFoods.some((f) => f.forConditions?.includes(condition.id)) : undefined,
    );
  const age = ageTip(form.stage, size, LIFE_STAGES, breed, weightOk(targetKg) ? targetKg : undefined);

  const { plan, empty } = useMemo((): { plan: Plan | null; empty: string | null } => {
    if (form.current === "" || form.target === "")
      return {
        plan: null,
        empty: puppy ? "Enter your puppy's weight and expected adult weight." : "Enter your dog's weight and target weight.",
      };
    if (!food1 || (form.mix && !food2)) return { plan: null, empty: "Choose a food, or enter the energy from the bag." };
    const choices: FoodChoice[] = form.mix
      ? [
          { food: food1, share: form.share1 / 100 },
          { food: food2!, share: 1 - form.share1 / 100 },
        ]
      : [{ food: food1, share: 1 }];
    return {
      plan: makePlan({ stage: form.stage, currentKg, targetKg, activity: form.activity, meals: form.meals }, choices),
      empty: null,
    };
  }, [form, food1, food2, currentKg, targetKg, puppy]);

  const setSlot = (i: 0 | 1, s: FoodSlot) =>
    update((f) => ({ ...f, foods: (i === 0 ? [s, f.foods[1]] : [f.foods[0], s]) as [FoodSlot, FoodSlot] }));

  return (
    <div className="app">
      <header className="toolbar">
        <span className="toolbar-title" aria-hidden="true">
          HungryDog
        </span>
        <button type="button" className="text-button" onClick={reset}>
          Start Again
        </button>
      </header>

      <div className="page">
        <div className="title-block">
          <img className="app-icon" src="/icon.svg" alt="" width={56} height={56} />
          <div>
            <h1 className="large-title">HungryDog</h1>
            <p className="subtitle">How much to feed, from the label on your dog's food.</p>
          </div>
        </div>

        <main className="layout">
          <div className="inputs">
            <Group
              title="Your Dog"
              footer={
                <>
                  {puppy ? "Not sure of the adult weight? Your vet or breeder can estimate it." : "Target weight: the same as now if they're in good shape."}
                  {condition?.nutrients.includes("phosphorus") &&
                    (limitBad
                      ? " That phosphorus limit looks too small: enter it in mg a day (1 g = 1,000 mg)."
                      : " Phosphorus limit: only if your vet has given you one, in mg a day.")}
                </>
              }
            >
              <Segmented
                label="Age"
                full
                value={form.stage}
                options={[
                  { value: "puppy", label: "Puppy" },
                  { value: "adult", label: "Adult" },
                  { value: "senior", label: "Senior" },
                ]}
                onChange={(stage) => update((f) => ({ ...f, stage }))}
              />
              {BREEDS.length > 0 && (
                <SelectRow label="Breed" value={form.breed} onChange={(breed) => update((f) => ({ ...f, breed }))}>
                  <option value="">Not set</option>
                  {BREEDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </SelectRow>
              )}
              <SelectRow label="Dietary requirements" value={form.condition} onChange={(condition) => update((f) => ({ ...f, condition }))}>
                <option value="">None</option>
                {CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectRow>
              {condition?.nutrients.includes("phosphorus") && (
                <NumberRow
                  label="Phosphorus limit"
                  value={form.phosphorusLimit}
                  onChange={(phosphorusLimit) => update((f) => ({ ...f, phosphorusLimit }))}
                  unit="mg/day"
                  placeholder="Optional"
                  invalid={limitBad}
                />
              )}
              <NumberRow
                label={puppy ? "Weight now" : "Current weight"}
                value={form.current}
                onChange={(current) => update((f) => ({ ...f, current }))}
                unit="kg"
                placeholder="0"
                invalid={form.current !== "" && !weightOk(currentKg)}
              />
              <NumberRow
                label={puppy ? "Adult weight" : "Target weight"}
                value={form.target}
                onChange={(target) => update((f) => ({ ...f, target }))}
                unit="kg"
                placeholder="0"
                invalid={form.target !== "" && !weightOk(targetKg)}
              />
              {!puppy && (
                <Segmented
                  label="Activity"
                  value={form.activity}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "typical", label: "Typical" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={(activity) => update((f) => ({ ...f, activity }))}
                />
              )}
              <Segmented
                label="Meals a day"
                value={String(form.meals) as "1" | "2" | "3" | "4"}
                options={(["1", "2", "3", "4"] as const).map((m) => ({ value: m, label: m }))}
                onChange={(m) => update((f) => ({ ...f, meals: Number(m) }))}
              />
            </Group>

            <FoodPicker
              title={form.mix ? "First Food" : "Food"}
              slot={form.foods[0]}
              onChange={(s) => setSlot(0, s)}
              customInvalid={customBad(0)}
              extraRows={
                !form.mix && (
                  <button type="button" className="list-row add-row" onClick={() => update((f) => ({ ...f, mix: true }))}>
                    <span className="plus" aria-hidden="true" />
                    Add a Second Food
                  </button>
                )
              }
              footer={!form.mix ? "Mixing wet and dry? Add the second food to split the day between them." : undefined}
            />

            {form.mix && (
              <FoodPicker
                title="Second Food"
                slot={form.foods[1]}
                onChange={(s) => setSlot(1, s)}
                customInvalid={customBad(1)}
                extraRows={
                  <>
                    <div className="list-row stacked">
                      <label className="row-label" htmlFor="share">
                        Split of the day
                      </label>
                      <input
                        id="share"
                        className="range"
                        type="range"
                        min={10}
                        max={90}
                        step={5}
                        value={form.share1}
                        aria-valuetext={`First food ${form.share1}%, second food ${100 - form.share1}%`}
                        onChange={(e) => update((f) => ({ ...f, share1: Number(e.target.value) }))}
                      />
                      <div className="split">
                        <span>First {form.share1}%</span>
                        <span>Second {100 - form.share1}%</span>
                      </div>
                    </div>
                    <button type="button" className="list-row destructive" onClick={() => update((f) => ({ ...f, mix: false }))}>
                      Remove Second Food
                    </button>
                  </>
                }
              />
            )}
          </div>

          <div className="output">
            <Result
              plan={plan}
              meals={form.meals}
              empty={empty}
              condition={condition}
              limits={{ phosphorus: limitBad || !(phosphorusLimit > 0) ? undefined : phosphorusLimit }}
            />
            <div className="tips">
              {health && <TipCard tip={health} icon="heart" />}
              <TipCard tip={meals} />
              {age && <TipCard tip={age} icon="calendar" />}
            </div>
            <p className="disclaimer">
              HungryDog gives a starting point from the food maker's guide. Every dog is different: weigh yours regularly
              and adjust. For puppies, pregnant or nursing dogs, or dogs with health problems, ask your vet.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
