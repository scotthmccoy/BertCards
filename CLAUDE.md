# BertCards — Working Notes for Claude

A small static deck-builder site for a friend's in-development CCG.

## Stack & deploy

- Plain HTML/CSS/JS, no build step.
- Hosting target: Cloudflare Pages (GitHub Pages is fallback).
- No backend in v1. Decks persist via `localStorage`, sharing via URL hash.
- Audience is small (~20 users). Don't add frameworks, build tooling, or a server without checking first.

## Game rules wired into the app

A legal deck = **1 Exemplar + 30 Power + 6 Location**.

Open questions (don't assume answers — ask):
- The CSV has no Exemplar card type. The Exemplar slot currently accepts any card via a "Set as Exemplar" button. What actually counts as a legal Exemplar?
- Per-card copy limits (e.g. MTG's 4-of) — unknown.
- Factions / alignment: the `Algn.` column has codes like `NN`, `S1`, `S2`. Meaning unclear; not wired into validation.

## Files

- `index.html` — single-page layout: card browser (left), deck panel with 3 zones (right).
- `styles.css` — dark theme; category accent colors (Power red, Location green, Exemplar gold).
- `app.js` — CSV parser (handles quoted multi-line fields), browser/filter logic, deck management, persistence, share.
- `Card_list.csv` — source of truth for cards. Two header rows; data starts row 3. "Zzz" category rows are design WIP and are filtered out.

## Workflow conventions

- **Keep `JOURNAL.md` updated.** After any meaningful change in this repo, append a brief dated entry: what changed, what's still open, any decisions. Don't rewrite past entries — only append. If today already has an entry, add to it.
- Static site only — to test, run `python3 -m http.server` from the repo root and open in a browser. Opening `index.html` via `file://` won't work because of the `fetch('Card_list.csv')` call.
