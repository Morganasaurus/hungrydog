#!/usr/bin/env node
// Food data report: re-draws each food's tables so they can be compared with the label cell by cell, and flags
// values that look implausible. Flags are prompts to double-check, not errors: labels are sometimes odd.
//
//   npm run food:report                    all real foods
//   npm run food:report -- orijen-puppy-large [more ids]
//   npm run food:report -- --demo          include the made-up demo foods
//   npm run food:report -- --diff a.json b.json
//                                          compare two independent transcriptions of the same label
//
// Plain Node, no dependencies. The energy formulas mirror src/feeding/energy.ts (keep them in step).

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "src", "data");

const rer = (kg) => 70 * Math.pow(kg, 0.75);
const adultKcal = (kg) => 1.6 * rer(kg);
const puppyKcal = (kg, adultKg) => 130 * Math.pow(kg, 0.75) * 3.2 * (Math.exp(-0.87 * Math.min(kg / adultKg, 1)) - 0.1);

// Label energy vs our estimate outside these ratios gets a flag. Puppy labels often run well below NRC.
const ADULT_RATIO = [0.7, 1.4];
const PUPPY_RATIO = [0.55, 1.5];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const loadDir = (dir) =>
  readdirSync(join(dataDir, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(dataDir, dir, f)));

const pct = (r) => `${Math.round(r * 100)}%`;
const table = (head, rows) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");

function report(food) {
  const out = [];
  const flags = [];
  const e = food.energy?.kcalPer100g;
  out.push(`## ${food.brand} ${food.name} (\`${food.id}\`)${food.demo ? " (demo)" : ""}`);
  out.push(
    [
      `Type: ${food.type}`,
      `Energy: ${e ? `${e} kcal/100 g (${Math.round(e * 10)} kcal/kg)` : "not recorded"}`,
      food.package ? `Package: ${food.package.label} ${food.package.grams} g` : null,
      `Covers: ${[food.adultGuide && "adult", food.puppyGuide && "puppy"].filter(Boolean).join(" + ") || "calories only"}`,
      `Source: ${food.source.kind}, added ${food.source.addedOn}, ${food.source.links?.length ?? 0} link(s)`,
    ]
      .filter(Boolean)
      .join(" · "),
  );

  if (food.adultGuide) {
    const rows = food.adultGuide.map((p, i) => {
      const hi = p.gramsHigh ?? p.gramsLow;
      const prev = food.adultGuide[i - 1];
      if (prev && hi < (prev.gramsHigh ?? prev.gramsLow)) flags.push(`Adult: ${p.weightKg} kg gets less than ${prev.weightKg} kg.`);
      let kcal = "";
      if (e) {
        const mid = ((p.gramsLow + hi) / 2) * (e / 100);
        const ratio = mid / adultKcal(p.weightKg);
        kcal = `${Math.round(mid)} kcal (${pct(ratio)})`;
        if (ratio < ADULT_RATIO[0] || ratio > ADULT_RATIO[1])
          flags.push(`Adult: ${p.weightKg} kg row is ${pct(ratio)} of a typical estimate. Check the cell and the energy unit.`);
      }
      return [`${p.weightKg} kg`, hi === p.gramsLow ? `${p.gramsLow} g` : `${p.gramsLow}–${hi} g`, kcal || "–"];
    });
    out.push("### Adult guide (per day)", table(["Dog", "Food", e ? "Energy (vs 1.6 × RER)" : "Energy"], rows));
  }

  if (food.puppyGuide) {
    const cols = food.puppyGuide.columns;
    const weights = [...new Set(cols.flatMap((c) => c.points.map((p) => p.weightKg)))].sort((a, b) => a - b);
    const cell = (c, w) => c.points.find((p) => p.weightKg === w);
    const rows = weights.map((w) => {
      let last = null;
      return [
        `${w} kg`,
        ...cols.map((c) => {
          const p = cell(c, w);
          if (!p) return "–";
          if (last && p.grams < last.grams && !last.transition)
            flags.push(`Puppy: at ${w} kg, the ${c.adultKg} kg column (${p.grams} g) is less than the ${last.adultKg} kg column (${last.grams} g).`);
          if (e) {
            const ratio = (p.grams * e) / 100 / puppyKcal(w, c.adultKg);
            if (w < c.adultKg && (ratio < PUPPY_RATIO[0] || ratio > PUPPY_RATIO[1]))
              flags.push(`Puppy: ${w} kg → ${c.adultKg} kg cell is ${pct(ratio)} of the NRC estimate.`);
          }
          last = { ...p, adultKg: c.adultKg };
          return `${p.grams}${p.transition ? "*" : ""}`;
        }),
      ];
    });
    out.push(
      "### Puppy guide (g per day; rows = puppy weight now, columns = expected adult weight; * = move to adult food)",
      table(["Puppy", ...cols.map((c) => `${c.adultKg} kg`)], rows),
    );
    if (food.puppyGuide.transitionTo) out.push(`Move to: ${food.puppyGuide.transitionTo}`);
  }

  if (food.labelNotes?.length) out.push(`### Label notes\n${food.labelNotes.map((n) => `- ${n}`).join("\n")}`);
  if (food.source.notes) out.push(`### Source notes\n${food.source.notes}`);
  if (food.source.links?.length) out.push(food.source.links.map((l) => `- ${l.title}: ${l.url} (${l.accessed})`).join("\n"));
  out.push("### Flags", flags.length ? flags.map((f) => `- ⚠ ${f}`).join("\n") : "- none");
  return { text: out.join("\n\n"), flags: flags.length };
}

// Compares the numbers in two transcriptions of the same label. Prints every difference.
function diff(a, b) {
  const cells = (f) => {
    const m = new Map();
    if (f.energy) m.set("energy kcal/100g", f.energy.kcalPer100g);
    if (f.package) m.set("package grams", f.package.grams);
    for (const p of f.adultGuide ?? []) m.set(`adult ${p.weightKg} kg`, `${p.gramsLow}–${p.gramsHigh ?? p.gramsLow}`);
    for (const c of f.puppyGuide?.columns ?? [])
      for (const p of c.points) m.set(`puppy ${p.weightKg} kg → adult ${c.adultKg} kg`, `${p.grams}${p.transition ? "*" : ""}`);
    return m;
  };
  const ma = cells(a);
  const mb = cells(b);
  const keys = [...new Set([...ma.keys(), ...mb.keys()])];
  const diffs = keys.filter((k) => String(ma.get(k)) !== String(mb.get(k)));
  console.log(`Compared ${keys.length} values: ${diffs.length} difference(s).`);
  for (const k of diffs) console.log(`- ${k}: ${ma.get(k) ?? "(missing)"} vs ${mb.get(k) ?? "(missing)"}`);
  return diffs.length;
}

const args = process.argv.slice(2);
if (args[0] === "--diff") {
  if (args.length !== 3) {
    console.error("Usage: npm run food:report -- --diff a.json b.json");
    process.exit(2);
  }
  process.exit(diff(readJson(args[1]), readJson(args[2])) ? 1 : 0);
}

const includeDemo = args.includes("--demo");
const ids = args.filter((a) => !a.startsWith("--"));
const foods = [...loadDir("foods"), ...(includeDemo ? loadDir("demo") : [])];
const chosen = ids.length ? foods.filter((f) => ids.includes(f.id)) : foods;
const missing = ids.filter((id) => !foods.some((f) => f.id === id));
if (missing.length) {
  console.error(`Not found: ${missing.join(", ")}`);
  process.exit(2);
}
let total = 0;
for (const f of chosen) {
  const r = report(f);
  total += r.flags;
  console.log(r.text + "\n");
}
console.log(`${chosen.length} food(s), ${total} flag(s).`);
