---
name: add-food
description: The pipeline for adding a dog food (or correcting one) in HungryDog's database, from the owner's feeding guide through research, transcription, cross-checks and sign-off to a commit. Use whenever the owner shares a feeding guide, names a food to add, or reports a wrong amount for a listed food.
argument-hint: "[brand and product name]"
---

Add or update one food in `src/data/foods/`. The main session orchestrates; the `feeding-guide-curator` agent does
the research and data entry. Work through the steps in order and stop at the first failure.

**Ground rules:** never invent a number; the owner's guide (the bag they actually have) wins over web sources; metric
only; one food per file, with file name = `id`. Label photos and PDFs are the maker's artwork, so they never go
into the public repo.

## 1. Intake

- Get the guide: a photo, PDF, pasted text or a link, plus the exact product name and the country it was bought
  in (formulas differ by country). If the image is only in the chat, subagents can't see it. Ask the owner to also
  save it to a private folder outside this repo (the homelab workspace's `hungrydog-sources/<id>/`) if they want an audit copy,
  and handle transcription yourself (step 3).
- Check it's not already listed: `npm run food:report -- <id>`, or grep the brand in `src/data/foods/`.
- Check the table fits the schema (`src/feeding/types.ts`):
  - adult table by dog weight (single amounts or ranges, or weight bands)
  - puppy table by puppy weight × expected adult weight
  - an energy figure
  - phosphorus from the guaranteed analysis (shown for dogs with kidney disease); ask the owner to include the
    analysis panel in the photo

  **Not supported yet:** puppy tables by age, cups-only tables, separate pregnancy, nursing or senior tables. For
  those, tell the owner, and either store what fits plus `labelNotes`, or plan a schema change. A schema change
  means new types, `validate.ts`, maths in `guide.ts`/`plan.ts`, tests, and a `nutrition-math-reviewer` pass
  before any data uses it.

## 2. Research (curator)

Run the `feeding-guide-curator` agent (from the Homelab folder, use a general-purpose agent pointed at
`.claude/agents/feeding-guide-curator.md`, with `model: "sonnet"` to match the agent). Run it in the background
while you do reading A yourself. Give it the product, the country, any guide text or file path, and what
to look for. It searches the maker's own pages for:
- the energy figure
- the official feeding table
- product sizes

It records every page in `source.links`.

## 3. Transcribe, twice

Two independent readings of the same table catch misread cells.

- **Reading A:** whoever can see the guide (you, if it's only in the chat; otherwise the curator) writes the food
  file.
- **Reading B:** an independent second reading, done without looking at A, written to the scratchpad. Use the
  maker's published table if the curator found one; otherwise make a second pass over the image yourself.
- Compare: `npm run food:report -- --diff src/data/foods/<id>.json <scratchpad>/<id>-b.json`. Settle every
  difference against the guide itself. Where the maker's page and the owner's bag genuinely differ, keep the bag's
  numbers and say so in `source.notes`.

## 4. Automated checks

```bash
npm test                          # schema, ids, every data file valid
npm run food:report -- <id>       # re-drawn tables + plausibility flags
```

Every flag gets an explanation: either it's a transcription error (fix it) or the label really says that (note it
in `source.notes`). Flags check:
- energy far from a typical estimate
- puppy amounts that drop as adult size grows
- adult amounts that drop as weight rises

## 5. Check it in the app

Start the `hungrydog` preview and enter one row by hand, for example one cell of the puppy table. Confirm the app
shows the label's amount, then try a weight between two rows.

## 6. Branch, commit and pull request

Each food (or a small batch the owner sent together) gets its own branch and pull request. The owner reviews it on
their phone or iPad and **merging is their sign-off**.

1. Start from an up-to-date `main`: `git switch main && git pull`, then `git switch -c food/<id>` (or
   `fix/<id>` for a correction, `food/<batch-name>` for several).
2. Commit only the food file(s): `git add src/data/foods/<id>.json`, message `Add food: <Brand> <Name>` (or
   `Fix food: …`). Follow the session's attribution rules and keep the repo's neutral git identity. If the work
   also changed app code (a schema change, a new rule), commit that separately on the same branch, with its tests.
3. Push the branch and open a pull request with `gh pr create`. Title: the commit message. Body:
   - the re-drawn table from `food:report` (the normal-weight column only for condition tables)
   - the energy figure and where it came from
   - the sources (maker pages) and any differences between the owner's label and the maker's page
   - any flags and their explanation
   - the in-app spot check (one row by hand, one in-between weight)
   - judgement calls the owner should know about
   End with the session's PR attribution line.
4. CI runs the tests and build, and the **foods** check puts the re-drawn tables on the run's summary page.
5. Tell the owner the PR is ready, with its link, and ask them to compare the table with the bag and merge it.
   Don't merge it yourself unless they ask.

**Before the GitHub repo exists**, skip the push and PR: commit on `main` and show the owner the same summary in
chat, then wait for their confirmation.

## 7. Release

- Merging to `main` builds the image. Then, when the owner asks, follow the `release` skill's last steps: wait for
  the build and remind them to **Pull and redeploy** the hungrydog stack in Portainer.
- Clean up: `git switch main && git pull && git branch -d food/<id>`.
- After a batch of foods, update the memory file for HungryDog if anything about the process changed.
