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

  **Not supported yet:** puppy tables by age, cups-only tables, separate pregnancy, nursing or senior tables. For
  those, tell the owner, and either store what fits plus `labelNotes`, or plan a schema change. A schema change
  means new types, `validate.ts`, maths in `guide.ts`/`plan.ts`, tests, and a `nutrition-math-reviewer` pass
  before any data uses it.

## 2. Research (curator)

Run the `feeding-guide-curator` agent (from the Homelab folder, use a general-purpose agent pointed at
`.claude/agents/feeding-guide-curator.md`). Give it the product, the country, any guide text or file path, and what
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

## 6. Owner sign-off

Show the owner:
- the re-drawn table from `food:report`
- the energy figure and where it came from
- any differences from the maker's page and any flags
- the spot-check result

Ask them to compare the table with the bag. Don't commit until they confirm.

## 7. Commit and release

- Commit just the food file: `git add src/data/foods/<id>.json`, with the message `Add food: <Brand> <Name>` (or
  `Fix food: …`). Follow the session's attribution rules and keep the repo's neutral git identity.
- Ship it with the release steps in `CLAUDE.md` (push to `main` → CI tests → image → redeploy in Portainer) when
  the owner asks.
- After a batch of foods, update the memory file for HungryDog if anything about the process changed.
