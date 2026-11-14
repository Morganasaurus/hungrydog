import { useMemo } from "react";
import { Card, NumberField, Segmented } from "./components/Controls";
import { FoodPicker } from "./components/FoodPicker";
import { Result } from "./components/Result";
import { customFood, findFood } from "./feeding/foods";
import { LIMITS, makePlan, type FoodChoice, type Plan } from "./feeding/plan";
import { parseNumber, slotCustomInput, useForm, type FoodSlot } from "./state";

function slotFood(slot: FoodSlot, n: number) {
  return slot.mode === "custom" ? customFood(slotCustomInput(slot), n) : findFood(slot.foodId);
}

const weightOk = (v: number) => v >= LIMITS.minKg && v <= LIMITS.maxKg;

export default function App() {
  const [form, update, reset] = useForm();
  const puppy = form.stage === "puppy";
  const currentKg = parseNumber(form.current);
  const targetKg = parseNumber(form.target);
  const food1 = slotFood(form.foods[0], 1);
  const food2 = form.mix ? slotFood(form.foods[1], 2) : undefined;
  const customBad = (i: 0 | 1) => form.foods[i].mode === "custom" && form.foods[i].custom.energy !== "" && !slotFood(form.foods[i], i + 1);

  const { plan, empty } = useMemo((): { plan: Plan | null; empty: string | null } => {
    if (form.current === "" || form.target === "")
      return { plan: null, empty: puppy ? "Enter your puppy's weight and expected adult weight to see how much to feed." : "Enter your dog's weight and target weight to see how much to feed." };
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
      <header className="top">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <div>
          <h1>HungryDog</h1>
          <p>How much to feed your dog, from the label on their food.</p>
        </div>
      </header>

      <main className="layout">
        <div className="inputs">
          <Card
            title="Your dog"
            aside={
              <button type="button" className="link" onClick={reset}>
                Start again
              </button>
            }
          >
            <Segmented
              label="Age"
              value={form.stage}
              options={[
                { value: "puppy", label: "Puppy", hint: "still growing" },
                { value: "adult", label: "Adult" },
                { value: "senior", label: "Senior", hint: "7+ years" },
              ]}
              onChange={(stage) => update((f) => ({ ...f, stage }))}
            />
            <div className="pair">
              <NumberField
                label={puppy ? "Weight now" : "Current weight"}
                value={form.current}
                onChange={(current) => update((f) => ({ ...f, current }))}
                unit="kg"
                placeholder="e.g. 12.5"
                invalid={form.current !== "" && !weightOk(currentKg)}
              />
              <NumberField
                label={puppy ? "Expected adult weight" : "Target weight"}
                value={form.target}
                onChange={(target) => update((f) => ({ ...f, target }))}
                unit="kg"
                placeholder="e.g. 11"
                invalid={form.target !== "" && !weightOk(targetKg)}
                hint={puppy ? "Not sure? Your vet or breeder can estimate it." : "Same as current weight if they're in good shape."}
              />
            </div>
            {!puppy && (
              <Segmented
                label="How active"
                value={form.activity}
                options={[
                  { value: "low", label: "Less active" },
                  { value: "typical", label: "Typical" },
                  { value: "high", label: "Very active" },
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
          </Card>

          <Card title={form.mix ? "Foods" : "Food"}>
            <FoodPicker label={form.mix ? "First food" : "Food"} slot={form.foods[0]} onChange={(s) => setSlot(0, s)} customInvalid={customBad(0)} />
            {form.mix ? (
              <>
                <hr />
                <FoodPicker label="Second food" slot={form.foods[1]} onChange={(s) => setSlot(1, s)} customInvalid={customBad(1)} />
                <div className="field">
                  <label className="field-label" htmlFor="share">
                    Split of the day's food
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
                <button type="button" className="secondary" onClick={() => update((f) => ({ ...f, mix: false }))}>
                  Remove second food
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => update((f) => ({ ...f, mix: true }))}>
                + Add a second food (e.g. wet with dry)
              </button>
            )}
          </Card>
        </div>

        <div className="output">
          <Result plan={plan} meals={form.meals} empty={empty} />
          <p className="disclaimer">
            HungryDog gives a starting point from the food maker's guide. Every dog is different: weigh yours
            regularly and adjust. For puppies, pregnant or nursing dogs, or dogs with health problems, ask your vet.
          </p>
        </div>
      </main>
    </div>
  );
}
