# Museum References

A Pinterest-style wall of open-access artwork aggregated live from major
museum APIs around the world. Search fans out to every enabled museum in
parallel and results interleave into one masonry wall.

## Sources

| Museum | Key required? | Notes |
|---|---|---|
| [Art Institute of Chicago](https://api.artic.edu/docs/) | No | Richest response — image, dimensions, blur placeholder, alt text in one request. Default browse source. |
| [Cleveland Museum of Art](https://openaccess-api.clevelandart.org/) | No | Full metadata + image variants in one request. |
| [Victoria and Albert Museum](https://developers.vam.ac.uk/) | No | Full metadata + IIIF images in one request. |
| [The Met](https://metmuseum.github.io/) | No | Search returns IDs only; each result needs a follow-up detail fetch. |
| [Rijksmuseum](https://data.rijksmuseum.nl/docs/) | No | Their legacy keyless API was shut down 2026-01-05 (410 Gone). The current replacement is Linked Art / CIDOC-CRM JSON-LD with no free-text search (only `creator`/`title`) and a 3-hop chain to resolve an actual image URL. By far the slowest source — kept to a small page size and capped concurrency. |
| [Smithsonian Institution](https://api.data.gov/signup/) | **Yes**, free & instant | Sign up at api.data.gov (registers you for their whole platform). |
| [Harvard Art Museums](https://github.com/harvardartmuseums/api-docs) | **Yes**, manual approval | Requested via a Google Form, not instant. Terms restrict use to non-commercial purposes and forbid caching results beyond two weeks. |
| [SMK (National Gallery of Denmark)](https://api.smk.dk/) | No | Full metadata + image in one request, CC0. |
| [Europeana](https://pro.europeana.eu/page/get-api) | **Yes**, free & instant | A personal key is auto-issued via your Europeana account — no waiting, unlike Harvard. Aggregates ~4000 European institutions, so per-item licensing varies (CC0/PDM/CC-BY/CC-BY-SA) rather than being uniformly CC0 like the rest of this table. Artist names are frequently unavailable — many records only carry a bare VIAF/agent URI, not a readable name. |
| [Wikimedia Commons](https://commons.wikimedia.org/w/api.php) | No | Search only returns file pages, not structured data, so each page batches a follow-up call resolving up to 50 files' image + metadata at once (not a per-item fetch). |

**Not included:**
- **The Walters Art Museum** — its API and site both return HTTP 403, and
  key registration has been broken since 2022 with an unresolved GitHub issue.
- **National Gallery of Ireland** — no public REST/JSON API exists; their
  "open data" page only offers bulk-downloadable CC-licensed image files,
  the one dataset listed on data.gov.ie 404s, and their online collection
  search runs on eMuseum with no documented CORS-enabled endpoint.
- **Minneapolis Institute of Art** and **National Gallery of Art (DC)** —
  both dropped their live search APIs in favor of static bulk CC0 data
  dumps on GitHub (a full CSV/JSON export, not a queryable endpoint) — a
  fetch-once-and-cache architecture rather than a fit for this app's
  per-query adapter pattern.
- **Yale University Art Gallery** — its LUX platform is Linked Art at the
  same complexity tier as Rijksmuseum (which this app already pays that
  cost for), plus requires a registered developer key. Not enough marginal
  value to duplicate.
- **Brooklyn Museum, Te Papa** — both need registered keys with
  uncertain/manual-feeling approval; Brooklyn's images are also
  CC BY-NC-ND (non-commercial, no derivatives), more restrictive than
  every other source here.

Adding another museum later is: write a module in `src/sources/` matching
the `MuseumSource` interface, then add it to the array in
`src/sources/index.ts`. Nothing else needs to change.

## Setup

Requires Node 20+ and npm.

```powershell
npm install
npm run dev
```

The app runs with zero configuration — the seven keyless sources work
immediately. To enable Smithsonian, Harvard, and/or Europeana, copy
`.env.example` to `.env` and fill in whichever keys you have:

```powershell
Copy-Item .env.example .env
```

### Windows PATH note

If `node`/`npm`/`git` aren't resolving in a fresh shell even though they're
installed, this machine has Node via nvm-windows and Git installed, but
their locations aren't on the resolved `PATH` in every shell. Prepend them
manually:

```powershell
$env:Path = 'C:\nvm4w\nodejs;C:\Program Files\Git\cmd;' + $env:Path
```

## Architecture

- `src/types/artwork.ts` — the normalized `Artwork` shape every museum adapter
  produces. The UI never has museum-specific logic; it only ever renders this.
- `src/sources/` — one adapter module per museum, all satisfying the
  `MuseumSource` interface (`src/sources/types.ts`), plus the registry
  (`index.ts`).
- `src/hooks/useArtworkSearch.ts` — fans a query out to every enabled +
  configured source via `Promise.allSettled` (so one broken museum can't
  block the rest), interleaves results round-robin, and paginates via
  React Query's `useInfiniteQuery`.
- `src/components/MasonryWall` — CSS multi-column masonry. Chosen over a
  JS masonry library because most source APIs don't reliably report image
  dimensions, so a measuring layout engine would thrash on every image load.
- `src/lib/fetchJson.ts` / `pLimit.ts` — a timeout-wrapped fetch tagged with
  the failing source's id, and a small concurrency limiter used by the
  Met and Rijksmuseum adapters' N+1 detail fetches.

## Attribution & licensing

Each museum's own open-access terms apply to its images and data — most are
CC0 or public domain, but check the source table above (Harvard in
particular is non-commercial-only with a caching limit) before reusing
anything beyond browsing in this app.
