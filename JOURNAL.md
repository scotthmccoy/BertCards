# BertCards Journal

A running log of work on the BertCards deck-builder site.

## 2026-04-30

**v1 scaffold for the deck-builder site.**

Decisions:
- Stack: plain HTML/CSS/JS, no build step. Hosting target: Cloudflare Pages (or GitHub Pages). No backend in v1; decks live in `localStorage` with shareable URL hashes.
- Reasoning: ~20 users initially, accounts/cloud-sync would be a week of plumbing for features they may not miss.
- Deck rules wired in: 1 Exemplar + 30 Power + 6 Location. Validation surface in the deck panel.

What was built:
- `index.html` — header with Share/Clear, two-pane layout (browser left, deck panel right with three zones).
- `styles.css` — dark theme, color-coded categories (Power red, Location green, Exemplar gold), responsive at <900px.
- `app.js` — runtime CSV parser (handles quoted multi-line fields), card normalization, browser with search + category/type filters, deck-zone management with quantity grouping, localStorage persistence, URL hash share.
- Filters out the "Zzz" rows from the CSV (they look like design WIP) and section-header stub rows.

Open questions / TODO:
- **No "Exemplar" type exists in the CSV** — only Leader/Attachment/Event/Resource (Power) and Field/Forum (Location). Built the Exemplar slot to accept any card via a "Set as Exemplar" button. Need clarification on what counts as a legal exemplar.
- Copy limits per card not yet known — currently no per-card limit enforced (only total deck size).
- Factions/colors/alignment rules unknown — `Algn.` column has values like `NN`, `S1`, `S2` but their meaning isn't yet wired into validation.
- Many cards are unnamed in the CSV; UI falls back to showing the type. Once names land we'll get cleaner deck lists for free.
- Hosting not yet set up. When ready: push to GitHub, connect Cloudflare Pages, point at the repo root.

Also added:
- `CLAUDE.md` with project context and the journal convention.
- Verified parser against the real CSV: 377 rows → 328 cards (49 dropped — section stubs + `Zzz` rows). Breakdown: Power 278 (Leader 84, Attachment 137, Attachment-Weapon 1, Event-Instant 23, Resource 33) and Location 50 (Field 43, Forum 7). All 13 "Event - Clash" rows in the CSV are empty placeholders and currently get filtered out — once they have content they'll appear automatically.
- Note for browser testing: I confirmed all four files serve over HTTP but I can't open a browser, so visual rendering is unverified — please load http://localhost:8765 and let me know if anything looks off.
- Filled out `README.md` with start/stop instructions for the local HTTP server, plus a quick layout reference.
- Direct push to `main` was blocked by the harness's safety rule; commit `0d864bb` is local-only until the user adds a permission allow-rule or asks for a feature-branch push.
