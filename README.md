# BertCards

A small static deck-builder site for an in-development CCG.

A legal deck = **1 Exemplar + 30 Power + 6 Location**. Cards live in `Card_list.csv`; the site fetches it at load time. No backend, no build step — just a folder of files.

## Run locally

The site uses `fetch()` to load `Card_list.csv`, which doesn't work over `file://`. You need a local HTTP server.

### Start

From the project root:

```sh
python3 -m http.server 8765
```

Then open http://localhost:8765 in a browser. The port is arbitrary — pick anything free.

If you want it backgrounded so the terminal stays usable:

```sh
python3 -m http.server 8765 &
```

### Stop

If the server is running in the foreground, hit `Ctrl+C` in its terminal.

If you backgrounded it or aren't sure where it's running:

```sh
lsof -ti :8765 | xargs kill
```

(Swap `8765` for whichever port you used.)

### Other server options

Anything that serves static files works. A few alternatives if you don't have Python handy:

- `npx serve` (Node)
- `php -S localhost:8765` (PHP)
- VS Code's "Live Server" extension

## Project layout

- `index.html`, `styles.css`, `app.js` — the site
- `Card_list.csv` — source of truth for card data
- `CLAUDE.md` — context and conventions for working in this repo with Claude
- `JOURNAL.md` — running log of changes
