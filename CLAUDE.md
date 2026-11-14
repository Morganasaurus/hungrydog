# HungryDog

A web app that tells dog owners **how much to feed**, from the feeding guide on their dog's food. Owners pick one
food, or two (e.g. wet with dry) and a split, then enter their dog's weight and target weight (puppies: expected
adult weight). Used on phones, tablets and desktops. Self-hosted on the homelab and **reachable from the internet**
(Cloudflare Tunnel → reverse proxy → container), so treat every change as public-facing.

The bar for every change: an owner gets a clear number in grams they can trust, knows where it came from, and is
pointed to a vet when the app shouldn't be the one deciding.

## Stack and layout

Static single-page app: React 19 + TypeScript + Vite, vitest for tests. **No backend, no accounts, no third-party
requests.** The form is saved in the visitor's `localStorage` (`hungrydog.v1`, see `src/state.ts`; add new fields
with defaults, never rename the key, and treat saved data as untrusted).

- `src/feeding/`: pure, tested logic.
  - `types.ts`: the food and breed data shapes.
  - `validate.ts`: checks every data file (used by tests and at load).
  - `energy.ts`: RER, adult and puppy energy, unit conversions.
  - `guide.ts`: reads adult and puppy label tables.
  - `plan.ts`: turns inputs into a plan and its notes.
  - `foods.ts`: loads the food list and builds custom foods.
  - `breeds.ts`: loads breeds and life-stage guidance.
  - `tips.ts`: the meals-a-day and age tips (sourced wording, tested in `tips.test.ts`).
- `src/data/foods/*.json`: **the food database**, one file per product, file name = `id`. Added progressively from
  guides the owner supplies (use the `add-food` skill).
- `src/data/demo/*.json`: made-up foods for development (`"demo": true`). Only loaded when `import.meta.env.DEV`, so
  they never ship; `npm run build` then `grep -l made-up dist/assets/*.js` should find nothing.
- `src/data/breeds.json`: breed weights, life spans and size classes, with sources (use the `breed-researcher` agent).
  Powers the optional Breed picker and the age tip.
- `src/data/life-stages.json`: vet guidance by size class: when dogs finish growing, senior age, and the AAHA
  "senior = last 25% of life span" rule.
- `src/components/`: `Controls` (`Group`, `Row`, `Segmented`, `NumberRow`, `SelectRow`, `TipCard`), `FoodPicker`
  (Brand, then that brand's Food; a brand with one product shows it as a fixed value, one with several starts on
  "Choose"), `Result`.

## Look and feel: a native Apple app

The owner wants it to look and feel like a native iOS/iPadOS app.
- **Colours:** Apple system colours in light and dark, following the device.
  - systemOrange is the tint, with the increased-contrast orange `--tint-text` for orange text on light backgrounds.
  - systemBrown and systemTeal mark dry and wet food.
  - Use the tokens in `src/app.css`, never hard-coded colours.
- **Type:** SF fonts via `-apple-system`; rounded numerals (`ui-rounded`) for the big gram figures.
- **Patterns:**
  - Settings-style grouped inset lists: uppercase group titles, rows with the label left and the value right,
    footers for hints.
  - iOS segmented controls (32px pill with a 44px tap area).
  - Health-style summary card.
  - TipKit-style tips: one key line, a heads-up if needed, then "Learn More".
  - Title Case for buttons ("Start Again", "Add a Second Food").
- **Layout:** one column on phones (your dog → food → result → tips). From 900px it's like an iPad split view:
  inputs on the left, result and tips sticky on the right.
- **Logo:** `public/icon.svg` is an original pop-art drawing of the owner's dogs, heads and shoulders only:
  Truffle, a chocolate Labradoodle drawn with a Lab-shaped head and doodle hints (wavy crown, forelock, wavy ear
  tips; the owner doesn't want her head "poofy"), and Pepper, a Rottweiler puppy with tan markings. Bold black
  outlines, yellow Ben-Day dots over a blue band. Keep it simple: no clothes, collars or props. Square, full-bleed:
  CSS and iOS round the corners. `public/apple-touch-icon.png` (180px) is rendered from it with headless Edge;
  re-render it when the SVG changes.
- **No inline `style` attributes:** the CSP (`style-src 'self'`) blocks them.

## Feeding rules already decided

- **Metric only**: kg and grams. Energy is stored as kcal per 100 g; custom foods accept kcal or kJ, per kg or 100 g.
- Adults and seniors are fed for their **target weight** (how vets start a weight-loss or weight-gain plan).
  Within 3% of the current weight counts as maintaining.
- Puppies are fed from the label's **puppy table**, by current weight and expected adult weight. Activity is ignored
  for puppies. A puppy at or above its expected adult weight is told to switch to Adult.
- A **label table always wins** over a calorie estimate. Calories are used only when the food has no suitable table
  (custom foods, or a dog outside the table) and its energy is known. Calories: adult = 1.6 × RER × activity factor
  (0.9 / 1 / 1.2); puppy = NRC 2006 growth formula.
- Tables are read in straight lines between rows and between puppy columns. Outside an adult table: calories if
  known, otherwise scale by kg^0.75 and warn. Past a puppy column's last row: hold its last amount. The label's
  "move to adult food" row gives a note, plus an earlier note from 90% of that weight.
- **Mixing** splits by share of the day: each food gives that share of its own full-day amount, which is a split by
  energy, not by weight. If a label food with no energy figure is mixed with a calorie-based food, warn that the
  split is approximate.
- Weight change notes: give the safe pace (1–2% a week, in kg) but **no timeline**. Feeding for the target is gentler
  than that pace, so loss is often slower. Warn and suggest the vet when the target is more than 25% from the
  current weight; stop when it's more than 50% (almost always a typo).
- Rounding: daily amounts to whole grams under 50 g, otherwise to 5 g, and never 0 g. Per meal is whole grams from
  the rounded daily amount, so meals add up to the day. Cans to quarters.
- A catalogued food is only used for the life stage its label covers: puppy-only labels are refused for adults, and
  adult-only labels for puppies, even when the energy is known. A listed food with energy but no table at all (e.g. a
  "450 g per 5 kg" rule only) is fed from calories and is adult-only. Custom foods (`custom: true`, typed in by the owner)
  can feed puppies from calories, with a note to check the bag says growth or all life stages. Very young puppies
  (under 25% of adult weight) on calorie estimates are pointed to the vet.
- **Veterinary diets** (`"vetDiet": true`, e.g. renal or prescription foods): amounts still come from the label,
  but the result leads with a warning that the vet's plan and amounts come first, and that weight changes belong to
  the vet's plan.
- **Never invent label numbers.** Only what's printed on the owner's guide or on a cited page (maker's site
  first), recorded in `source.links` and `source.notes`.
- Any change to `src/feeding/` needs tests with hand-checked expectations. If a test disagrees with the code, work
  out which is right before changing either.

## Working on it

```bash
npm install
npm run dev        # http://localhost:5174 (preview config "hungrydog")
npm test           # vitest: maths, and every data file validated
npm run build      # typecheck + production build
npm run food:report -- [ids] [--demo]     # re-draws food tables, flags implausible values
npm run food:report -- --diff a.json b.json  # compares two transcriptions of one label
```

Before calling UI work done: `npm test`, `npm run build`, then check in the browser at **375×812** (phone),
**744×1133** and **1133×744** (iPad mini) and **1440×900**, light and dark. Touch targets at least 44px. Check the
console for errors. The user may be clicking in the browser pane at the same time, so use a separate tab for checks.

## Agents (`.claude/agents/`)

The main session orchestrates; agents do focused jobs and report back.

- `feeding-guide-curator`: turns a feeding guide the owner shares into a `src/data/foods/` file. Writes data only.
- `breed-researcher`: adds sourced breed weight ranges to `src/data/breeds.json`. Writes data only.
- `nutrition-math-reviewer`: use after changing `src/feeding/` or feeding-advice wording. Read-only.
- `responsive-ui-reviewer`: use after visible UI changes; checks phone, tablet and desktop. Read-only.
- `security-reviewer`: use after changing `nginx.conf`, the `Dockerfile`, `docker-compose.yml`, the workflow,
  dependencies or anything handling user input or storage, and before public releases. Read-only.

## Adding foods and releasing

- New or corrected foods go through the `add-food` skill (`.claude/skills/add-food/SKILL.md`): intake, research,
  two independent readings compared with `npm run food:report -- --diff`, `npm test` + `npm run food:report`, a check in
  the app, the owner's sign-off, then a commit of just that file.
- Shipping is the `release` skill: test, build, commit, push, wait for the image build.

## Deployment

Same as Fret Wiz. GitHub Actions (`.github/workflows/build.yml`) tests, builds and pushes
`ghcr.io/morganasaurus/hungrydog` (`latest` from `main`, plus `sha-<short>` and version tags). It runs as a Portainer
stack on the `portainer` VM: `docker-compose.yml`, host port 8097 → container 8080. The container is unprivileged
nginx with a read-only root, all capabilities dropped and strict security headers (`nginx.conf`). Commits use the
neutral author `HungryDog <Morganasaurus@users.noreply.github.com>`; never put personal names in the repo.
