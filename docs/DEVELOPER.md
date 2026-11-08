# Developer guide — Supertext Translation for Wix

A self-hosted ("self-managed") Wix app: one dashboard page extension whose iFrame points at this Node.js service, which talks to Wix through the REST APIs of Wix Multilingual and to Supertext through the AI file translation API. Hosted on Railway.

## Repository layout

```
src/
  server.ts               entry: database, static files, HTTP server
  app.ts                  routes (Hono): dashboard pages, API for the page's script, webhooks, health
  config.ts               environment variables
  version.ts              version from package.json, release link
  reporting.ts            Commando Center: version reports and the API key check per site (Plugin Health's InstallationReporter, the SDK's key check)
  auth/instance.ts        verifies Wix's signed app instance (HMAC-SHA256 with the app secret)
  wix/client.ts           Wix REST client: OAuth token, Locales, Translation Schema, Translation Content
  wix/ricos.ts            Ricos rich content ↔ HTML segments
  translation/
    fields.ts             which fields are translated; item state per language
    translate.ts          one item × one language: collectSegments → Supertext → buildFields/saveFields
    files.ts              translation files: export, import, reference format (SDK TranslationFiles)
    jobs.ts               a job: items × languages, progress, error handling
    site.ts               languages, translatable schemas, list pages for the translate page
    language-codes.ts     Wix locale → Supertext code (the site's mapping, else an exact code; SDK's Languages)
  supertext/index.ts      the Supertext SDK with this app's defaults (User-Agent, stand-in endpoint, REVIEW_URL)
  vendor/supertext-sdk/   the Supertext SDK for TypeScript, vendored (don't edit; see "Supertext SDK")
  vendor/supertext-plugin-health/  Supertext Plugin Health for TypeScript, vendored (don't edit; see "Supertext Plugin Health")
  store/
    store.ts              Store interface, in-memory store, AES-GCM for API keys
    postgres.ts           PostgreSQL store (creates its database and tables)
  i18n/                   en, de, fr, it messages; translator; LocalizedError
  views/                  server-rendered pages (hono/jsx): translate (with the export and import cards), job panel, import summary, settings
public/                   app.js (selection, start, polling, export download, import upload, test connection), app.css (Supertext's look, see "Look and feel"), supertext-logo.svg, favicon.svg, fonts/ (Inter, SIL Open Font License)
scripts/probe.ts          read-only look at a real site's Wix Multilingual data
scripts/vendor-sdk.sh         refreshes src/vendor/supertext-sdk from the SDK repository
scripts/vendor-plugin-health.sh  refreshes src/vendor/supertext-plugin-health from the Commando Center repository
tests/                    Vitest tests; standin/ (Wix and Supertext stand-ins, sample site); docs/screenshots.ts, docs/movie.ts, docs/movie-install.ts (kit in docs/movie/)
```

## How it fits into Wix

- **Dashboard page extension** (self-hosted iFrame). Wix opens `APP_URL/?instance=<signed>&locale=<dashboard language>&…`. The page passes the signed instance on in links and forms, and the browser script sends it as `X-Wix-Instance` with every API call. Every request is checked with `verifyInstance()` (HMAC-SHA256 of the data part with the app secret, base64url; anonymous visitors refused). The instance ID is the site's key in the database.
- **Access tokens:** `POST https://www.wixapis.com/oauth2/token` with `grant_type: client_credentials`, `client_id` (app ID), `client_secret`, `instance_id`. Valid 4 hours; cached in memory for 3.5. (Wix's legacy "custom authentication" with refresh tokens isn't available to new apps.)
- **Webhook:** `POST /webhooks` receives Wix's JWT (RS256, verified with `WIX_PUBLIC_KEY`); on *App Removed* the site's settings and jobs are deleted.
- **Framing:** responses carry `Content-Security-Policy: frame-ancestors` for `manage.wix.com`, `*.wix.com`, `*.wixstudio.com`.

### Wix APIs and permissions

| Call | Endpoint | Permission scope |
| --- | --- | --- |
| The site's URL and ID (version reports) | `GET /apps/v1/instance` → `site.url`, `site.siteId` | the app's basic access (*App Instance*; still to confirm on a real site, `npm run wix:probe` prints it) |
| Site languages | `POST /locales/v2/locale/query` | `SCOPE.MULTILINGUAL.MANAGE_TRANSLATIONS` (Wix Multilingual) |
| All translation schemas of the site | `GET /translation-schema/v1/schemas/site` | `SCOPE.DC-MULTILINGUAL.READ_TRANSLATION_CONTENT` |
| Original texts and existing translations | `POST /translation-content/v1/contents/query` (filter `schemaId`, `entityId`, `locale`) | `SCOPE.DC-MULTILINGUAL.READ_TRANSLATION_CONTENT` |
| Create a translation (item has none in that language yet) | `POST /translation-content/v1/contents` | `SCOPE.DC-MULTILINGUAL.WRITE_TRANSLATION_CONTENT` |
| Update an existing translation | `POST /translation-content/v1/bulk/contents/update-by-key` | `SCOPE.DC-MULTILINGUAL.WRITE_TRANSLATION_CONTENT` |

HTTP 429 from Wix is retried like Supertext's (up to 4 times). Errors become `WixError`s with codes the UI translates (`wixAuth`, `multilingualMissing`, `wixUnavailable` …).

## How a translation runs

1. The translate page loads the locales (the primary one is the source), all schemas that have at least one translatable field (Wix Stores first, products first), and 25 items of the chosen schema: content in the **primary locale**, plus their content in the target locales to show *Not / Partly / Translated*.
2. *Translate* posts `schemaId`, item IDs (`entityId`, up to 100) and target locales. A job row is saved and runs in the web process; the page polls `GET /api/jobs/:id` every 2 s, which returns the job panel rendered in the user's language.
3. For each item and each locale, one after the other (`translation/translate.ts`):
   - **Fields** (`fields.ts`): the source content's fields whose schema field is `SHORT_TEXT`, `LONG_TEXT` (plain text), `HTML` (markup) or `RICH_CONTENT` (Ricos), not `hidden`, not `displayOnly`, and with text. Keys of repeated items (`choice(abc)`) match schema fields written with empty parentheses (`choice()`). A field with text in the target locale is kept unless *overwrite*.
   - **Segments:** each text or HTML field is one segment; Ricos is split into one segment per text block (`wix/ricos.ts`, below). All segments of the item go to the SDK's `translateTexts`, which packs them into one HTML document (several above 900,000 characters), one `<div data-st-id="N">` each, and reads them back by key.
   - **Supertext:** source and target from the site's language mapping (see *Language codes*); a target without a Supertext language is skipped for the whole job with `unsupported_language` (nothing sent). `politeness` from the form-of-address setting, sent only where `Languages.supportsPoliteness(target)` is true (not for `en-*`, `gsw-*`, `rm`, `sq`, `sr-*`); elsewhere Supertext decides.
   - **Write back** (`WixClient.saveContent`): if the item already has translation content in that locale, *Bulk Update Content By Key* (`schemaId` + `entityId` + `locale`; only the fields sent change); if not, *Create Content*. Update by key only works on content that exists: on a real site it answers *Entity not found* for a new translation. If Wix disagrees with what the list showed (not found on update, already exists on create), the other call follows. Each field goes with `published` (setting *Mark translations as ready to publish*) and `updatedBy: EXTERNAL_APP`. A text longer than the schema field's `maxLength` isn't written (*too long for Wix*). If Supertext returns fewer segments than sent, the SDK fails with `incomplete_response` and nothing is written for that item.
4. Errors: authentication, limit, missing Wix Multilingual or Wix permission errors stop the job (a 401/403 from Supertext also tells the Commando Center's key check, see below); `unsupported_language`, `unsupported_feature` and `INVALID_LANGUAGE_PAIR` skip that language for the rest of the job; a main language without a Supertext language stops the job; anything else fails only that item. Jobs still running when the app restarts are marked *interrupted* on the next start.

### Translation files (XLIFF and HTML)

*Export for translation* and *Import translation* (cards on the translate page, `public/app.js`) use the SDK's `TranslationFiles` (SDK 0.5.0, version-neutral, re-exported by `src/supertext/index.ts`). Glue: `src/translation/files.ts`; routes `POST /api/files/export` (JSON → the file) and `POST /api/files/import` (multipart → JSON with the summaries and the summary rendered by `views/files.tsx`), both behind `X-Wix-Instance` like every API call.

- **Segments:** `collectSegments` in `translate.ts`, shared with the API translation: one per text/HTML field (key = the Wix field key, e.g. `name`, `choice(small)`), one per Ricos text block (key = `<field key>#<n>`). The API path sends the same keys to `translateTexts`. The export collects with *overwrite* (every field, translated ones too); the import collects with the import's *overwrite* option, so fields with a translation are *kept* as in a job.
- **Job metadata:** `plugin` = `Wix-Supertext-Translation`; `reference` = `<schema id>:<entity id>:<Wix locale>` (`fileReference` / `parseReference`; ids, never titles); `sourceLanguage`/`targetLanguage` = the site's mapping (`sourceCodeOf`/`targetCodeOf`), else the Wix code with `_` → `-`, so unmapped languages never block an export. XLIFF: one job per locale in one file; HTML: exactly one. File name `wix-<entity id>-<target>.xlf|.html` (`wix-<entity id>.xlf` for several), `application/x-xliff+xml` / `text/html; charset=utf-8`, `Content-Disposition: attachment`; the script saves the response as a blob (the instance header can't go with a plain link).
- **Import:** `refuseLargeUpload` checks `Content-Length` before the body is parsed and the file's size (10 MB); nothing is stored. `TranslationFiles.read` errors become `file_invalid` / `file_missing_metadata` / `file_too_large`; per job: other `plugin` → `file_other_system`, unparsable reference, unknown schema or no source content → `file_item_gone`, a locale the site doesn't have as a target → `file_no_language`. Then `importTranslations(file, collected.segments)`; `ok` (and `source_changed` with *Also import texts whose source changed*) go through `buildFields` + `saveFields`, the API path's write-back (create or update by key, `published` from the setting, `updatedBy: EXTERNAL_APP`, `maxLength`). A Ricos field is written only when all its blocks have a translation (`rebuild` would leave the others in the source language); its translated blocks count as *not written*. `untranslated`, `invalid_markup`, `missing` are counted, never written.

### Ricos rich content

Every block whose children are all `TEXT` nodes (paragraphs, headings, the paragraphs inside list items, quotes, table cells, collapsible items …) becomes one segment, as the shared rule requires (a whole paragraph per `data-st-id`). Each text run's decorations become an inline tag carrying `data-st-d` = the index of its decoration set: `<a href>` for links, `<b>`/`<i>`/`<u>` for plain bold/italic/underline, `<span>` for anything else (colours, font sizes, mentions …). Line breaks travel as `<br>`. After translation the runs are rebuilt from the tags (nested tags combine their decorations), so formatting survives reordering. Button labels (`buttonData.text`) and image alt texts (`imageData.altText`) are plain-text segments; `CODE_BLOCK` isn't translated. Node IDs and all other data stay as they were.

## Interface languages

English, German, French and Italian, following the `locale` parameter Wix adds to the dashboard page (the browser's language, e.g. `de`), then `Accept-Language`, then English. Strings live in `src/i18n/{en,de,fr,it}.ts`; `en.ts` defines the keys and the others are typed `Messages`, so a missing key fails `npm run typecheck`, and `tests/i18n.test.ts` checks placeholders, URLs, "Supertext" and "Wix". **Every new or changed string gets all four languages in the same commit**, formal address (Sie, vous, Lei), Wix's own terms (*Übersetzungsmanager*, *Gestionnaire de traduction*, *Gestione traduzioni*; *Website*, *langue principale*), French ` ` before `? ! : ;`. Errors are `LocalizedError`s (English message for logs, `code` → `error.<code>`); Supertext errors use the SDK's codes as they are (`error.authentication_failure`, `error.quota_exceeded` …; `errorInfo()` in `src/i18n/error.ts` turns a `SupertextError` into the message data, and an `invalid_language_pair` without the codes into `invalid_language_pair_unknown`). The job panel is rendered on the server in the requested language.

## Look and feel

The pages follow supertext.com, like Supertext's HubSpot app: a compact deep-green header bar (`#003230`, rounded bottom corners, 50 px high because it sits right below Wix's own dashboard bar) with Supertext's mint logo (`public/supertext-logo.svg`, the website's own SVG) and pill-shaped tabs, the warm off-white background (`#f7f5f3`), deep-green text and outlines, mint (`#78ffaf`) for the main action, the active tab, selected languages and finished translations, light grey lines (`#dfe1df`), and pill-shaped buttons. Text is set in Inter, bundled in `public/fonts/` (variable font, Latin and Latin Extended; SIL Open Font License in `Inter-LICENSE.txt`), so no font is loaded from elsewhere. Supertext's heading font (ABC Ginto Nord) is licensed and not bundled; headings use Inter Bold. The colours are CSS variables at the top of `public/app.css`; keyboard focus shows a deep-green outline. Below 640 px the header, cards and buttons tighten and the item table scrolls inside its card. The favicon is the logo's S mark on deep green.

## Supertext API protocol

AI file translation API v1 at `https://api.supertext.com/v1/`, same as the WordPress plugin:

1. `POST translate/ai/file` (multipart): `file` (type exactly `text/html`), `target_lang`, `source_lang` (primary subtag only), optional `politeness` (`more`/`less`) → `{ file_id }`.
2. `GET translate/ai/file/{id}/status` every 2 s until `done` (`error`, `limit_exceeded`, `deleted` stop; timeout 3 minutes).
3. `GET translate/ai/file/{id}/translation` → the translated HTML.
4. `DELETE translate/ai/file/{id}`, always.

All of this is done by the **Supertext SDK** (next section): header `Authorization: Supertext-Auth-Key <key>` (a pasted prefix is stripped), HTTP 429 retried up to 4 times (`Retry-After`, else 1/2/4/8 s with jitter), `GET features` to check the key (`checkApiKey()`: after a settings save, *Test connection*), the User-Agent `supertext-sdk-typescript Wix-Supertext-Translation/<version>`. The key is the site's own (Settings, AES-256-GCM encrypted in the database with `APP_ENCRYPTION_KEY`, else a key derived from `WIX_APP_SECRET`), else `SUPERTEXT_API_KEY`.

### Supertext SDK

The app uses the TypeScript SDK from [Supertext-API-SDK-and-Guide](https://github.com/Supertext/Supertext-API-SDK-and-Guide) (`sdk/typescript`, 0.5.0), the shared client of all Supertext plugins. It provides the API client and the API key check (`checkApiKey()`, `apiKeyFingerprint()`, `SDK_VERSION`); version reports come from Supertext Plugin Health (next section). It isn't on npm yet, so it is **vendored** in `src/vendor/supertext-sdk/` (its source tree as it is: the version-neutral `index.ts` and `version.ts`, the API in `v1/`; with `LICENSE`, `COMMIT` = the SDK commit, `VERSION` and a `README.md`). Don't edit those files: fix the SDK upstream, then

```bash
scripts/vendor-sdk.sh [commit-or-branch]   # default: main; SDK_DIR=/path/to/clone uses a local clone as it is
npm run typecheck && npm test
```

The app reaches the SDK only through `src/supertext/index.ts` (imports from `v1/`, and `TranslationFiles` from the version-neutral `index.ts`), so moving to the npm package later means replacing the folder with `npm install supertext-sdk` and changing those imports to `supertext-sdk/v1` and `supertext-sdk`.

### Supertext Plugin Health

[Supertext Plugin Health](https://github.com/Supertext/Commando-Center-Supertext-Translation/tree/main/plugin-health) (`plugin-health/typescript` in the Commando Center repository, 0.1.0) sends the version reports and the API key check result to the Supertext Commando Center (`InstallationReporter`, `reportsEnabled()`, `reporterState()`; its ping answer isn't used, the app is hosted). It has no dependencies and doesn't call Supertext: `src/reporting.ts` passes it `SDK_VERSION` and a key checker built on the SDK (`createSupertextClient(…).checkApiKey()` and `apiKeyFingerprint`). It is **vendored** in `src/vendor/supertext-plugin-health/` (`index.ts`, with `LICENSE`, `COMMIT`, `VERSION` and a `README.md`) and compiled with the app. Don't edit those files: fix it in Commando-Center-Supertext-Translation/plugin-health, then

```bash
scripts/vendor-plugin-health.sh <tag>   # e.g. plugin-health-v0.1.0; default: main; PLUGIN_HEALTH_DIR=/path/to/clone uses a local clone as it is
npm run typecheck && npm test
```

## Language codes

Supertext accepts exactly the codes its `GET features` lists (the SDK's `Languages`, `src/vendor/supertext-sdk/v1/languages.ts`): **sources** bare (`en`, `de`, `gsw` …); **targets** regional only for de/en/fr/it/pt (`de-CH`, `de-DE`, `de-AT`, `en-US`, `en-GB`, `fr-CH`, `fr-FR`, `it-CH`, `it-IT`, `pt-BR`, `pt-PT`), with a script for Chinese and Serbian (`zh-Hans`, `zh-Hant`, `sr-Latn`, `sr-Cyrl`), `gsw-u-sd-chzh`/`gsw-u-sd-chbe` for Swiss German, and bare for all others (`es`, `nl`, `sl`, `ja` …). Anything else gets HTTP 404 `INVALID_LANGUAGE_PAIR`.

**No guessing beyond the SDK's defaults.** `src/translation/language-codes.ts` resolves a Wix locale with `Languages.target()` / `Languages.source()`:

1. the site's **mapping** (`SiteSettings.languageCodes`, Wix locale ID → Supertext code, column `language_codes`): one mapping serves both directions; for the main language a mapped code is sent in its source form (`de-CH` → `de`);
2. else an **exact match** of the locale ID (case and `_`/`-` ignored: `de-ch` → `de-CH`, `es` → `es`; for the source also its first subtag: `en-US` → `en`);
3. else, for targets, the SDK's **default** (`Languages.defaultTarget`, `DEFAULT_TARGETS`, SDK 0.4.0): `de` → `de-DE`, `en` → `en-US`, `fr` → `fr-FR`, `it` → `it-IT`, `pt` → `pt-PT`, `zh`/`zh-CN`/`zh-SG` → `zh-Hans`, `zh-TW`/`zh-HK`/`zh-MO` → `zh-Hant`, `sr` → `sr-Latn`, a region of a bare target → the bare target (`es-ES` → `es`);
4. else the SDK's `unsupported_language`: nothing is sent. The job item says *"Swiss German" has no Supertext language yet … Settings → Languages*, in the editor's language. Locales without a default (`en-IE`, `de-LI`, `fr-BE`, `sr-RS`, `gsw`) need a mapping.

The settings page (**Languages**) has one combo box per site language, the main language included: the saved code selected, else the suggestion (`Languages.suggestTarget()` = exact match, else default; for the main language its source code), else *— Not translated: choose a Supertext language —*. The options are `Languages.SOURCES` for the main language and `Languages.targetOptions()` for the others, shown as *Name (code)* with the name in the interface language (`Intl.DisplayNames`) and sorted by it. Saving stores the selected code of every row, so a preselected default becomes the saved choice (the stored format didn't change, so earlier mappings stay as they are). A warning lists only the languages without mapping and without default; the translate page leaves those unchecked and links to the settings; all others are ticked. Only codes Supertext offers are saved (in their exact form); others are reported as *Saved, except these language codes …*. The form of address hint names the languages where formal/informal isn't available.

### Translation review

`SiteSettings.reviewLocales` (column `review_locales`, JSONB array of Wix locale IDs, `[]` for existing rows; checkbox `review:<locale>` next to each target's combo box under Settings → Languages, off by default) lists the target languages translated through Supertext's review service, the translation proxy of [Supertext Localization Review](https://github.com/Supertext/Localization-Review-Supertext-Translation). It speaks the same API v1, forwards to the live Supertext API with the site's key, stores every segment per key and serves reviewers' corrections on the next upload, so nothing else in the protocol changes. `runJob` asks `JobDeps.supertext(settings, review)` for each locale and keeps at most two clients per job (direct, review), created lazily; `translateTexts` uploads, polls, downloads and deletes with the same client, so a job is always collected where it was submitted. In `app.ts` the review client is `createSupertextClient` with the same key, User-Agent and fetch and `endpoint` = `SUPERTEXT_REVIEW_URL` (default `REVIEW_URL` in `src/supertext/index.ts`, `https://localizationreview-production.up.railway.app/v1/`). `effectiveReviewUrl()` makes it `''` when the variable is set to `''` or equals the normal endpoint (then no second client; the checkboxes are disabled and the saved choices kept). The key check, version reports and translation files never use the review service. Tests: `tests/flow.test.ts` → *translation review* (a review language's upload, status, download and delete go to the review stand-in host `review.test`, the others to `supertext.test`; `SUPERTEXT_REVIEW_URL=''` turns it off; the default is `REVIEW_URL`; the key check stays direct; the checkbox is saved per target only).

The stand-in (`tests/standin/supertext.ts`) accepts only the listed target codes (HTTP 404 otherwise) and answers `politeness` for a target without it with HTTP 400 `FEATURE_ERROR`, like the live API.

## Commando Center: version reports and the API key check

Protocol: [Commando-Center-Supertext-Translation](https://github.com/Supertext/Commando-Center-Supertext-Translation) → `docs/DEVELOPER.md` → *Report protocol*. Plugin Health's `InstallationReporter` and `reportsEnabled()` and the SDK's `checkApiKey()` implement it; `src/reporting.ts` (`Reporting`) gives it what the app knows about each site, runs one reporter action and stores the new state, never throwing.

- **One installation per Wix site.** The reporter's state (Plugin Health's JSON, the same format the SDK 0.2 reporter stored, so the switch sent no new `installed`: reported versions, last failure, the latest key check with the key's fingerprint) lives per instance ID in `site_settings.reporter_state` (`Store.getReporterState` / `saveReporterState`; added to existing databases with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` on start). Calls per site are serialized and read the site's settings when they run.
- **Setting:** `SiteSettings.versionReports` (*Send version information to Supertext*, on by default; column `version_reports`), on the settings page. `SUPERTEXT_VERSION_REPORTS` on the server (`0/false/off/no`, `1/true/on/yes`) decides for all sites (`reportsEnabled()`); the checkbox is then disabled with a note. `SUPERTEXT_REPORT_URL` sends reports elsewhere (tests, CI and screenshots use the stand-in's `POST /report`).
- **Report fields:** `site_url` = the site's published URL from Wix (`GET /apps/v1/instance` → `site.url`), else, for an unpublished site, `https://manage.wix.com/dashboard/<siteId>` (stable, and where Supertext staff find the site); looked up at most every 6 hours per site. If Wix can't be asked, the key is still checked but nothing is reported. Plugin `Wix-Supertext-Translation` with the version from `package.json`; system `Wix` (no version: Wix is a hosted platform); runtime Node.js; no `callback`: **a hosted app has no ping endpoint**.
- **When:**
  - `afterSettingsSaved`: `POST /settings`, after saving (awaited, at most 10 s for the key check and 3 s for the report). The settings page shows the result with its time (`KeyCheckMessage` in `views/layout.tsx`, the center's five texts in four languages, *supertext.com* and *supertext.com → Integrations → API* linked in a new tab).
  - `onRequest`: the translate page, the settings page and starting a job (`POST /api/jobs`), in the background after the request (`setImmediate`; never on the site's own pages, which the app doesn't serve). Reports `upgraded` after an app or Node.js update, `api_key_check` when the server's `SUPERTEXT_API_KEY` changed (fingerprint), `installed` for a site that never reported.
  - `authenticationFailed`: a translation failed with HTTP 401/403 (`onAuthenticationFailure` in `jobs.ts`); reported only when the key status changes.
  - `testConnection`: *Test connection* with the saved key (`POST /api/test`, returns `{ ok, status, html }`). A key typed into the field but not saved is checked with `checkApiKey()` only, without touching the stored check.
- The API key is never logged, stored in the state or sent; only the SDK's fingerprint is kept. Tests (`tests/reporting.test.ts`, `tests/flow.test.ts`) use the stand-in or a fake transport, never the live center.

## Local development

Requirements: Node.js 22.12+ (CI runs the tests on Node 22, 24 and 26; the Docker image uses Node 22). No Wix account needed for most work: the stand-ins answer like the Wix and Supertext APIs for a sample site (`tests/standin/seed.ts`: a Swiss chocolate shop in English with German, French and Italian, two products, a category, a blog post; `samples.json` holds human translations of its texts).

```bash
npm install
npm run standin            # stand-in Wix API :8766, stand-in Supertext :8765; prints a signed dashboard URL
WIX_APP_ID=app WIX_APP_SECRET=standin-secret WIX_API_BASE=http://127.0.0.1:8766 \
SUPERTEXT_API_ENDPOINT=http://127.0.0.1:8765/v1/ SUPERTEXT_API_KEY=any \
SUPERTEXT_REPORT_URL=http://127.0.0.1:8765/report npm run dev   # reports to the stand-in, not the live center
# open the printed URL (http://127.0.0.1:8080/?instance=…&locale=en)
```

Without `DATABASE_URL`, settings and jobs live in memory.

Against a real site you need the app's credentials and an HTTPS URL Wix can reach (a tunnel such as `cloudflared tunnel --url http://localhost:8080`, set as the dashboard page's iFrame URL of a development copy of the app).

### Looking at a real site's data

```bash
WIX_APP_ID=… WIX_APP_SECRET=… npm run wix:probe -- <instanceId> [entityType or schema ID]
```

Read-only. Prints the site's URL and ID (what the version reports use), lists the site's locales, every translation schema (app, entity type, fields and how the app would treat them), how much content each has in the main language and in others, and one sample item. The instance ID is logged by the app whenever the translate page is opened (`translate page opened on instance …`).

## Tests

```bash
npm test             # Vitest: instance signing, Ricos round trip, field selection, Wix client, i18n, language codes, reporting, full flow, translation files (the SDK has its own tests upstream)
npm run typecheck
npm run build
```

`tests/flow.test.ts` runs the whole app (`createApp`) against the stand-ins with an in-memory store: the translate page, jobs, overwrite, settings, the language mapping, Translation review, unsupported languages and politeness, language-pair and authentication errors, the key check and the reports (to the stand-in's `/report`), encrypted keys. `tests/languages.test.ts` covers the language rules, `tests/reporting.test.ts` the reporting glue with a fake transport (site URL, off switches, failure back-off, never throwing). `tests/files.test.ts` exports and imports through the routes against the stand-ins: reference round trip, keys and codes, every import outcome, rich text with missing blocks, upload size.

## Screenshots

```bash
npm run docs:screenshots   # Playwright, 1× scale, into docs/images/
```

`tests/docs/screenshots.ts` starts the stand-ins and the app in-process and captures the app's pages (no key yet, the language mapping with an unmapped language and Translation review ticked for German (the review service is a second stand-in address, never the real one), settings with the key check, translate page, results, list afterwards, overwrite warning, export for translation and the import summary after a round trip, German UI). Regenerate them in the same commit as any UI change they show. Chromium: Playwright's own (`npx playwright install chromium`) or `CHROME=/path/to/chrome`.

## Demo movie

`docs/images/demo.gif` (at the top of the README) is recorded by `tests/docs/movie.ts` with Supertext's shared movie kit (`tests/docs/movie/movie-kit.mjs`, its types in `movie-kit.d.mts`, and `assets/`: intro and outro cards, caption bar, cursor, cuts the waiting time; Inter under the SIL OFL, `assets/fonts/Inter-LICENSE.txt`). Like the screenshots, it starts the stand-in Wix and Supertext APIs and the app in-process (`tests/docs/movie/env.ts`; the Supertext stand-in holds its status answers for 2.5 s so the waiting state is visible, and the movie cuts the wait), saves a fake key off camera, then shows, with a spoken line for every step (the GIF is silent): the products of the sample store in English, *Dark chocolate praline box* ticked, German kept and French and Italian unticked, *Translate 1 item with Supertext*, the waiting state, the result (*Translated (4 fields)*, review in the *Translation Manager*) and the list with the product translated into German. Wix's own screens (the Translation Manager) aren't shown: the stand-in has no UI.

```bash
pip install piper-tts      # the voice (once)
npm run docs:movie         # CHROME=/path/to/chrome as for the screenshots; MOVIE_PORT (default 8798)
```

The MP4 is narrated with [Piper](https://pypi.org/project/piper-tts/) (`pip install piper-tts`): the kit's `say()` speaks each step's line, shows its caption and holds until the line is finished; the time spent making the speech is cut. The voice model (63 MB, pinned revision, checked by SHA-256) downloads itself once into `tests/docs/movie/voice/` (git-ignored; never commit it). Without Piper, or with `MOVIE_VOICE=0`, the movie is made silent with the captions only.

Voice: Piper voice “alba” (en_GB), trained on a dataset from the University of Edinburgh's Centre for Speech Technology Research, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

It needs `ffmpeg` and writes 1280×720 at 30 fps. The GIF (800 px, 12 fps, keep it under 3 MB) is committed; the MP4 (about 45 s) isn't: it goes to `tests/docs/movie/out/Wix-Supertext-Translation.mp4` (git-ignored) or to `MOVIE_OUT`. Record it again when the translate page changes. The kit is the same in every Supertext plugin repo: don't restyle it here.

### Install movie

`tests/docs/movie-install.ts` (`npm run docs:movie:install`) records the install and configuration movie with the same kit, voice and stand-ins (MP4 only, no GIF). A hosted app has no install commands, so there is no terminal scene, and adding the app to a site happens in Wix's own screens, which aren't shown (one spoken line sums it up, and one that the languages come from Wix Multilingual). It shows the app in the dashboard asking for a key, *Settings*: the API key field with the fake key `st-demo-0000-0000-0000` and where to get a key, *Languages* (English as the main language, German (Switzerland) → *German (Switzerland) (de-CH)*, *Translation review* left off), *Save* with the key check, *Test connection*, and the *Translate* tab where editors start. The MP4 (about 75 s) goes to `tests/docs/movie/out/Wix-Supertext-Translation-install.mp4` (git-ignored) or to `MOVIE_OUT`; it isn't committed. Record it again when the settings change.

## CI

`.github/workflows/ci.yml`: typecheck, tests, build, then a smoke test of the built app against the stand-ins (dashboard page, a job translating two products into two languages, a forged instance refused).

## Hosting (Railway)

The service **Wix** in the Railway project *supertext-cms-demos* builds this repo's `Dockerfile` (context = repo root; set on the service, Railway ignores `railway.json`). Health check `/health`. Every push to `main` deploys.

| Variable | Value |
| --- | --- |
| `APP_URL` | the service's public URL (the dashboard page's iFrame URL) |
| `WIX_APP_ID`, `WIX_APP_SECRET` | from dev.wix.com → the app → OAuth |
| `WIX_PUBLIC_KEY` | from dev.wix.com → the app → Webhooks (for the *App Removed* webhook); optional |
| `DATABASE_URL` | the shared Postgres service's URL with database `wix_supertext` (created on first start) |
| `APP_ENCRYPTION_KEY` | random secret for stored API keys; optional (falls back to the app secret) |
| `SUPERTEXT_API_KEY` | optional default key (the demo site) |
| `SUPERTEXT_REVIEW_URL` | optional: another review service than Supertext's for languages with *Translation review* (unset: `REVIEW_URL`); `''` turns review off for all sites. Only with the live API: leave it `''` when `SUPERTEXT_API_ENDPOINT` points at staging or testing |
| `SUPERTEXT_VERSION_REPORTS` | optional: `0` turns version reports off for all sites (default: each site's setting, on) |
| `SUPERTEXT_REPORT_URL` | never in production (Plugin Health's default is the live Commando Center); tests point it at a stand-in |

Never commit these values.

## Setting up the app in Wix

Once, in the Wix app dashboard (dev.wix.com, Supertext's Wix developer account):

1. **Create app** → *Supertext Translation*. Note the app ID and secret (OAuth page) for Railway.
2. **Permissions:** Wix Multilingual – *Translation Content + Published Content Read*, *Write Translation Content*, and *Wix Multilingual* (manage translations, for the locales).
3. **Extensions → Dashboard Page:** iFrame URL = `APP_URL`, relative route `translate`, page name *Supertext Translation*, sidebar name *Translate with Supertext*.
4. **Webhooks:** *App Removed* → `APP_URL/webhooks`; copy the public key into `WIX_PUBLIC_KEY`.
5. **Test app** on the demo site (below); the install link from the app dashboard is what site owners get until there is an App Market listing.

## Demo

The demo is a Wix site, not a container: Wix hosts the site, Railway only the app backend. Set it up by hand (Wix sites can't be created or seeded from outside):

1. A free Wix site *Supertext Demo* with Wix Stores and Wix Blog, main language English.
2. Wix Multilingual with German, French and Italian (Switzerland).
3. A few products, a category and a blog post in English (the texts of `tests/standin/seed.ts`).
4. **Accounts** (the demo accounts rule, as far as Wix allows): Supertext staff get access as **collaborators** with the *Admin (Co-Owner)* role; for tests and screenshots invite an editor-level collaborator with a role that can use apps (e.g. *Website Manager*). Wix accounts are personal and created by Wix, so they can't be created from Railway variables; passwords stay in Keeper, never in the repo or chat.
5. Install the app (app dashboard → Test app → the demo site), then enter the API key under Settings or set `SUPERTEXT_API_KEY` on Railway.

## Dependency updates

Dependabot (`.github/dependabot.yml`) opens weekly pull requests: minor and patch updates grouped into one, GitHub Actions in another, each major update on its own. Merge one when CI is green and it doesn't change what the app supports.

One major version is ignored on purpose: `@types/node` (the types must match the oldest Node version the app supports, Node 22, not the newest). Lift the ignore rule when the app moves to a new minimum Node version.

## Code quality and security checks

- **Checks** workflow (`.github/workflows/checks.yml`): [actionlint](https://github.com/rhysd/actionlint) and [zizmor](https://docs.zizmor.sh/) lint the workflows on every push and pull request. Dependency review fails a pull request that adds a package with a known vulnerability (moderate or worse). Third-party actions are pinned to commit SHAs; Dependabot keeps the pins up to date. To run the workflow lint locally: `pip install actionlint-py zizmor`, then `actionlint` and `zizmor .github/workflows` in the repo root.
- **Links** workflow (`.github/workflows/links.yml`): [lychee](https://lychee.cli.rs/) checks the links in all Markdown files weekly and whenever docs change on `main`. Broken links open (or update) the issue "Broken links in the docs". Links that can't work from CI (local URLs, placeholders, pages behind a login) are excluded in `.lycheeignore`.
- JavaScript and TypeScript are analysed by CodeQL (see below), so this repo runs no separate static analyser.
- GitHub settings (set by Remy's setup script, not stored in the repo): **secret scanning with push protection** (a push containing a known token format is rejected; findings under *Security → Secret scanning*) and **CodeQL default setup** (findings under *Security → Code scanning* and as comments on pull requests; PHP isn't covered by CodeQL, which is why the PHP plugins run PHPStan).
- `.github/workflows/support-triage.yml`: support requests from the Supertext integrations website arrive as issues labelled `support` (contact details stay in the Supertext CMS). Claude classifies each one: answers questions (marked `<!-- supertext:reply -->`, emailed to the sender by the CMS) and closes them, fixes bugs as pull requests for review (never merged automatically), labels feature requests `feature-request`. Only people with triage rights can add labels, so outsiders can't start it. Needs the organisation secret `ANTHROPIC_API_KEY`; the workflow is the same in every Supertext repo.

Before starting work in this repo, look at its open findings: code scanning alerts, secret scanning alerts, Dependabot PRs and the "Broken links in the docs" issue.

## Releasing

`package.json` holds the version (the release workflow's `VERSION_FILES`); the settings page reads it at runtime.

1. Move the *Unreleased* entries in `CHANGELOG.md` under a new `## X.Y.Z — YYYY-MM-DD` heading, leaving *Unreleased* empty.
2. Set the same version in `package.json` and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`).
3. Push to `main`. `.github/workflows/release.yml` tags `vX.Y.Z` and creates the GitHub release with the changelog section; 0.x versions are pre-releases. Railway deploys the code on the same push.

Never tag or create releases by hand. Changes to permissions or extensions are made in the Wix app dashboard and published as a new app version there.

## Known limitations / roadmap

- **First test on a real Wix site (October 2026, Wix Stores test site):** the app is installed, reads the site's locales (bare languages there, e.g. `de`, `fr`), lists the Wix Stores products from Translation Content in the main language and translates them with Supertext. Writing a *new* translation with *Update Content By Key* failed with *Entity not found*, hence *Create Content* for new translations. Still to confirm on the site: that creating translations in Wix Stores' schemas is allowed and shows up in the Translation Manager and on the live site, and Wix Blog.
- Screenshots of Wix's own screens (Wix Multilingual's language setup, the Translation Manager with a translated product) follow once the demo site exists; the guides show the app's pages from the stand-ins until then.
- Version reports: `GET /apps/v1/instance` (the site URL) is tried against the stand-in only so far; check on the test site that it answers without an extra permission and returns `site.url` (`npm run wix:probe`). Until then a failing call only means no report.
- A translation memory and reviewers' corrections come from the review service only for languages with *Translation review* on; corrections reach Wix only with the next translation (with *Overwrite existing translations*; no push).
- Jobs run inside the web process (one Railway instance); a restart marks a running job *interrupted*. A queue comes later.
- Up to 25 items per page and 100 per job; "translate everything" comes later.
- No translation of the Wix Editor's own pages and texts (Wix Multilingual handles those in the Editor).
- No App Market listing yet: needs a listing, privacy policy and Wix's review; until then the install link from the app dashboard.
