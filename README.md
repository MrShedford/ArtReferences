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
| [Harvard Art Museums](https://github.com/harvardartmuseums/api-docs) | **Yes**, manual approval | Requested via a Google Form, not instant. Terms restrict use to non-commercial purposes, cap you at 2500 requests/day, and forbid caching results beyond two weeks. |
| [SMK (National Gallery of Denmark)](https://api.smk.dk/) | No | Full metadata + image in one request, CC0. |
| [Europeana](https://www.europeana.eu/en/for-developers) | **Yes**, free | Not auto-issued on signup: register a Europeana account, then request a key from the API key section of your account. Approval is fast (and a higher-rate "project key" can be requested the same way), but it is a request-and-approve step. Aggregates ~4000 European institutions, so per-item licensing varies (CC0/PDM/CC-BY/CC-BY-SA) rather than being uniformly CC0 like the rest of this table. Artist names are frequently unavailable — many records only carry a bare VIAF/agent URI, not a readable name. |
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
`src/sources/index.ts`. Nothing else needs to change — unless it needs an
API key, in which case also add an entry to the `SOURCES` table in
`api/museum.ts`, add its env var to `ENV_VAR_BY_SOURCE` in `api/config.ts`,
add its id to `SOURCE_IDS` in `api/user/[...path].ts`, and set
`requiresKey: true`. Those three tables are duplicated on purpose — see
"Why `api/` repeats itself" below.

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

Those three keys are **server-side** — no `VITE_` prefix — so they never
reach the browser. `npm run dev` serves `/api` from a dev-only Vite plugin
that reuses the same code as the deployed functions, so no Vercel CLI is
needed locally. Env vars are read when the dev server starts: restart it
after editing `.env`.

### Windows PATH note

If `node`/`npm`/`git` aren't resolving in a fresh shell even though they're
installed, this machine has Node via nvm-windows and Git installed, but
their locations aren't on the resolved `PATH` in every shell. Prepend them
manually:

```powershell
$env:Path = 'C:\nvm4w\nodejs;C:\Program Files\Git\cmd;' + $env:Path
```

## Deployment

A static Vite build plus two small serverless functions in `api/` — the
seven keyless museums are still called straight from the browser, and only
the three key-gated ones go through the proxy.

```powershell
npm run build   # produces dist/
```

**Vercel** auto-detects both halves: the Vite preset (build `npm run build`,
output `dist`) and the `api/` directory as functions. `vercel.json` carries
one rewrite, which became necessary when the app gained a client-side router
— without it a hard refresh on `/lists` hits Vercel's static handler, finds
no such file, and 404s. The negative lookahead keeps `/api/*` out of the
rewrite so the functions still resolve, and `/_vercel/*` for the same reason —
that's where Web Analytics serves its script and collects events, and a
catch-all that swallowed those would hand back `index.html` instead.

1. Push this repo to GitHub.
2. In Vercel: **Add New Project** → import the repo. No build settings to change.
3. Add environment variables under **Project Settings → Environment
   Variables**, for every environment you use:
   - Optional, for the key-gated museums: `SMITHSONIAN_API_KEY`,
     `HARVARD_API_KEY`, `EUROPEANA_API_KEY`. Without them those sources show
     as disabled.
   - Required *together* for accounts: `DATABASE_URL`, `SESSION_SECRET`,
     `VITE_GOOGLE_CLIENT_ID`. Without them sign-in and saving disappear and
     the app behaves exactly as it did before accounts existed. See
     "Accounts and saved lists" below.
4. Optional: turn on **Web Analytics** (project → **Analytics** → **Enable**).
   `@vercel/analytics` is already wired up in `src/main.tsx`, but it collects
   nothing until the project has analytics switched on, and the switch only
   takes effect on the *next* deployment. Search text is deliberately withheld
   — a `beforeSend` hook strips the `?q=` param, so searches count as views of
   `/` and the queries themselves never leave the browser.
5. Deploy. Every push to `main` auto-deploys after this.

**Three things worth knowing:**

- Adding or changing an env var does **not** affect an existing deployment —
  you have to redeploy for it to take effect. This bites hardest with
  `VITE_GOOGLE_CLIENT_ID`, which unlike the others is **baked into the bundle
  at build time** rather than read at runtime: a deploy built without it has
  no client ID at all, and adding the var afterwards changes nothing until
  you rebuild.
- Preview deployments get a fresh random `*.vercel.app` hostname, which won't
  be one of the authorized JavaScript origins registered with Google, so
  sign-in fails on previews. Either add a stable preview alias domain to the
  origins list, or accept that login works on production and locally only.
  Everything else on a preview works normally.
- Keys stay on the server. `api/museum.ts` injects them into the upstream
  request, so nothing key-shaped is in the JS bundle; `api/config.ts` tells
  the client only *which* sources are usable, so the UI can disable the rest.
  This is why the vars carry no `VITE_` prefix — a `VITE_*` var is compiled
  straight into the public bundle and would be readable in dev tools, which
  matters for Harvard's named, non-commercial, 2500/day key in particular.
  Proxy responses are edge-cached for five minutes to keep repeat searches
  off that quota.
- The proxy scrubs the key from every response body before returning it.
  Europeana echoes yours back on success — as a top-level `apikey` field and
  inside each item's `link` URL — so forwarding the body verbatim would leak
  the key the proxy exists to hide. Upstream error bodies are never forwarded
  at all, for the same reason.

## Accounts and saved lists

Sign in with Google, save artworks to lists, browse them at `/lists`. Every
card gets a Save button: clicking it saves to an auto-created list called
"Saved", and the chevron beside it picks a different list or makes a new one.
Signed-in users can also set a display name that overrides the one Google
supplies.

All of it is optional. With `DATABASE_URL`, `SESSION_SECRET` or
`VITE_GOOGLE_CLIENT_ID` unset, `/api/user` returns 503, the sign-in button
reads "Sign-in unavailable", no Save buttons render, and the wall is
byte-identical to what an anonymous visitor saw before any of this existed.
`GET /api/user/ping` reports which of the three are present.

### Setup

1. **Database.** Create a Neon project — either from the Vercel dashboard
   (Storage → Create → Neon, which injects `DATABASE_URL` for you) or at
   [console.neon.tech](https://console.neon.tech). Use the **pooled**
   connection string, the one with `-pooler` in the host: the HTTP driver is
   built for that endpoint. Put it in `.env` for local dev.

2. **Schema.** `npm run db:push`, or paste `db/schema.sql` into Neon's SQL
   Editor. It's idempotent, so re-running is a no-op.

3. **Session secret.**
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
   Into `.env` as `SESSION_SECRET`. Changing it later signs everyone out.

4. **Google.** At [console.cloud.google.com](https://console.cloud.google.com):
   OAuth consent screen → External, then Credentials → Create credentials →
   OAuth client ID → Web application.
   - **Add no scopes.** Identity Services tokens carry `openid`/`email`/
     `profile` by default, and publishing with only those needs no Google
     verification review.
   - **Authorized JavaScript origins** must include
     `http://127.0.0.1:5173` — the dev server binds `127.0.0.1`, not
     `localhost`, and Google treats them as different origins. Register only
     `localhost` and the button silently refuses to render, reporting it to
     the console and nowhere else. The port is pinned with `strictPort` for
     the same reason: drifting to `:5174` would break sign-in just as quietly.
   - **Authorized redirect URIs: leave empty.** This is the token flow.

`VITE_GOOGLE_CLIENT_ID` is the one deliberate exception to this project's
"no `VITE_` prefix" rule. An OAuth client ID is designed to be public and the
button cannot work otherwise; there is no client *secret* anywhere. The
browser hands Google's ID token to `/api/user/session`, which verifies it
against Google's published keys — `api/user/[...path].ts` reads the same var
to check the token's `aud` claim.

### How the session works

The browser gets an ID token from Google Identity Services and posts it to
`/api/user/session`. The server verifies the signature against Google's JWKS
with Web Crypto (no JWT library — the RS256-only, key-from-JWKS-only shape
makes `alg: none` and HS256 confusion impossible by construction), then sets
an `HttpOnly; SameSite=Lax` cookie holding
`base64url({uid,exp}).HMAC-SHA256`.

It's deliberately *not* a JWT and there is no sessions table. Stateless means
no database round trip on the `/api/user/me` call every page load makes; the
cost is no server-side revocation, which a 30-day cap and a sign-out that
clears the cookie cover well enough here.

### Why `api/` repeats itself

`api/museum.ts` says it, and it applies double to `api/user/[...path].ts`:
**no relative imports.** Two commits (`d26bf67`, then `c8d2736`) chased
`FUNCTION_INVOCATION_FAILED` on deployed functions that worked perfectly
locally; explicit `.ts` extensions didn't fix it, and the resolution was to
delete `api/_shared/` entirely. Bare specifiers from `node_modules` —
`@neondatabase/serverless` — and builtins like `node:crypto` resolve down a
different path and are fine.

So the entire user/lists/session surface is **one file** with internal
method-and-path dispatch, rather than four files sharing helpers. Every
endpoint needs the same `db()`, `readSession()` and `jsonError()`; duplicating
~150 lines of crypto four ways is well past the point where duplication beats
an import, and one file means there is nothing to share and nothing to
resolve. The ten source ids are duplicated there for the same reason
`api/config.ts` duplicates three env var names.

## Architecture

- `src/types/artwork.ts` — the normalized `Artwork` shape every museum adapter
  produces. The UI never has museum-specific logic; it only ever renders this.
- `src/sources/` — one adapter module per museum, all satisfying the
  `MuseumSource` interface (`src/sources/types.ts`), plus the registry
  (`index.ts`).
- `api/` — the only code that touches an API key or the database.
  `museum.ts` holds the hard-coded endpoint + key-param + allowed-param table
  for the three key-gated museums (hard-coded so the proxy can't be pointed at
  an arbitrary host) and proxies to them; `config.ts` reports which are
  configured; `user/[...path].ts` is every account, list and saved-item
  endpoint. All three are deliberately **self-contained with no relative
  imports** — see "Why `api/` repeats itself" above. `vite.config.ts` mounts
  their real method exports as dev middleware, so `npm run dev` exercises the
  same entry points production does. That shim has to reproduce more of the
  platform than it used to: method dispatch, a buffered request body, and
  `Set-Cookie` read back via `getSetCookie()` — `Headers.forEach` joins
  repeated headers with `", "`, which silently corrupts cookies whose
  `Expires` date contains a comma.
- `src/router.tsx` — two code-based routes (`/` and `/lists`). Code-based
  rather than the file-based plugin: two routes don't justify a codegen step
  plus a generated `routeTree.gen.ts` that lands inside `tsconfig.app.json`'s
  `include` and has to satisfy `noUnusedLocals`. The search query and enabled
  museums live in the URL, so a search survives navigating to `/lists` and
  back, and is shareable.
- `src/hooks/useSaveMutations.ts` — `useSavedMap()` fetches the whole
  account's saved state as `{ uid: listId[] }` in **one** request. The wall
  renders 100+ cards that each need to know whether they're saved; this keeps
  that at zero requests per card and one thing to invalidate. Returning the
  list ids rather than a bare uid list is what lets the Save dropdown tick the
  right lists without a second query.
- `db/schema.sql` — the whole schema, idempotent, applied by `npm run db:push`.
  Saved items store the **full `Artwork` snapshot** as JSONB rather than a
  reference: `MuseumSource` only exposes `search()`, never `getById`, so a
  saved uid could never be resolved back into an artwork. `blurDataUrl` is
  stripped before storage — it's a 1–2 KB base64 blob (AIC only) worth it for
  a loading shimmer on the wall, not on every saved row.
- `src/hooks/useConfiguredSources.ts` — asks `/api/config` which key-gated
  sources this deployment can serve. The client can't check for itself, since
  the keys never reach it; a failed request degrades to "none configured".
- `src/hooks/useArtworkSearch.ts` — fans a query out to every enabled +
  available source via `Promise.allSettled` (so one broken museum can't
  block the rest), interleaves results round-robin, and paginates via
  React Query's `useInfiniteQuery`.
- `src/components/MasonryWall` — fixed columns filled by
  `src/lib/distributeIntoColumns.ts`, which assigns each artwork to the
  shortest column using a height *estimated* from its aspect ratio. Nothing is
  measured from the DOM, so there's no read-back thrash — the objection that
  rules out a measuring masonry library. This replaced CSS `column-count`:
  balanced multicol re-fragments the entire wall whenever a card changes height
  or a page is appended, so cards migrate between columns and the wall jumps
  under the cursor. Fixed columns are independent stacks, so appending touches
  only one column's bottom and a resize only moves cards below it.
  Column count is in `src/hooks/useColumnCount.ts` and must stay in step with
  the `$bp-*` breakpoints in `src/styles/_variables.scss`.
- `src/components/ArtworkCard` — always reserves height via `aspect-ratio`:
  exact for the 4 sources that report dimensions, else a 3:4 placeholder that
  snaps to the real ratio on load. Resolved ratios are cached by uid so the
  snap doesn't replay when cards remount (column count change, filter toggle).
- `src/lib/fetchJson.ts` / `pLimit.ts` — a timeout-wrapped fetch tagged with
  the failing source's id, and a small concurrency limiter used by the
  Met and Rijksmuseum adapters' N+1 detail fetches.

## Attribution & licensing

Each museum's own open-access terms apply to its images and data — most are
CC0 or public domain, but check the source table above (Harvard in
particular is non-commercial-only with a caching limit) before reusing
anything beyond browsing in this app.
