# Working on this repository

Part of Supertext's translation plugins project: Supertext AI translation for the top open source CMS, PIM and shop systems. Each system has its own repo named `Supertext/<System>-Supertext-Translation`.

This repo is a **Wix app** (self-hosted): a dashboard page extension whose iFrame points at this Node.js/TypeScript service (Hono, server-rendered pages), which reads and writes translations through the **Wix Multilingual** REST APIs (Locales, Translation Schema, Translation Content) and is hosted on Railway. See `docs/DEVELOPER.md`.

## Documentation rule (always)

Every plugin repo keeps three guides, and **every change that affects behaviour, settings, installation or the code structure updates them in the same commit**:

| File | Audience | Must cover |
| --- | --- | --- |
| `docs/INSTALLATION.md` | Administrators | Requirements, install/update/uninstall, API key, language setup, all settings, troubleshooting |
| `docs/USER_GUIDE.md` | Editors | How to translate and review in the CMS's own UI, what is and isn't translated, what errors mean |
| `docs/DEVELOPER.md` | Developers | Architecture, Supertext API protocol, local setup, tests, CI/deploy, releasing, known limitations/roadmap |

Also: `README.md` stays a short overview linking the three guides, and `CHANGELOG.md` gets an entry under *Unreleased* for every user-visible change. Before finishing any task, check the docs still match the code.

## Supertext account and API key links (always)

Everywhere an administrator enters or is told about the API key — the settings field's help text, the "no API key" / "authentication failed" messages, `docs/INSTALLATION.md`, `README.md` and `.env.example` — show both links (same as the WordPress plugin):

- Create a Supertext account (or log in): https://www.supertext.com/person/en/account/signin
- Generate the AI API key: https://www.supertext.com/en/integrations/api (supertext.com → Integrations → API; requires the **Admin** role)

Wording: "No Supertext account yet? Create one at supertext.com. Generate your API key at supertext.com → Integrations → API (requires the Admin role)." In the UI, links open in a new tab (`target="_blank" rel="noopener"`); where the CMS shows plain text only, use the bare URLs. New screens or messages that mention the key get the links too.

## UI languages (always)

The app's pages are in English, German, French and Italian, following the `locale` parameter Wix passes to the dashboard page. Strings live in `src/i18n/{en,de,fr,it}.ts` (typed: a missing key fails `npm run typecheck`; `tests/i18n.test.ts` checks placeholders, URLs, "Supertext" and "Wix"). **New or changed strings get all four languages in the same commit.** Formal address (Sie, vous, Lei), Wix's own terms in each language, "Supertext", placeholders and URLs never translated. Errors shown in the UI are `LocalizedError`s with a `code` (`error.<code>`).

## Plugin version on the settings screen (always)

The settings page shows the version from `package.json` (read at runtime by `src/version.ts`, never a second copy) and links it to the GitHub release.

## Plugin list (always)

`README.md` ends with the shared list of all Supertext plugins (between the `<!-- supertext-plugins:start -->` and `<!-- supertext-plugins:end -->` markers). It is identical in every Supertext plugin repo: when a plugin is added, renamed or its description changes, update the list in **all** repos, not just this one. Wix is listed as *In development* until it has been tested on a real Wix site.

## Releases (always)

Releases are published by `.github/workflows/release.yml`: never tag or create a GitHub release by hand. To release, follow `docs/DEVELOPER.md` → *Releasing* (new version section in `CHANGELOG.md`, same number in `package.json`) and push to `main`. A push without a new version releases nothing. A Wix app has no installable file: Railway deploys the code, permissions and extensions are published in the Wix app dashboard.

## Repo setup (always)

Every Supertext plugin repo has, and a new one gets from the start:

- `LICENSE` matching the license its manifest declares (`composer.json`, `package.json`, `pyproject.toml`, `.csproj`, plugin header).
- `SECURITY.md`: report vulnerabilities privately through GitHub's private vulnerability reporting or support@supertext.com, never in public issues.
- `.github/dependabot.yml`: weekly updates for its package ecosystem and GitHub Actions, minor and patch updates grouped into one pull request.
- `.github/workflows/checks.yml` (actionlint + zizmor on every push and PR, dependency review on PRs) and `.github/workflows/links.yml` (lychee weekly and on docs changes; broken links open the issue "Broken links in the docs"). Third-party actions are pinned to commit SHAs.
- `.github/workflows/dependabot-merge.yml`: merges Dependabot's minor and patch package updates once all other checks pass (built-in token, so GitHub Actions updates and majors stay for a person). See `docs/DEVELOPER.md` → *Dependency updates*.
- On GitHub: the About box filled in (one-sentence description, website https://www.supertext.com, topics), `main` protected against force-pushes and deletion, Wiki and Projects off, Dependabot alerts and private vulnerability reporting on, secret scanning with push protection and CodeQL default setup on, and the Supertext social preview image.
- A row in the plugin list (see *Plugin list*) and in the org profile (`Supertext/.github` → `profile/README.md`).

Claude sessions can't change GitHub repo settings (HTTP 403): add a new repo to Remy's setup script (`set-github-about`) instead of trying.

## Checks and alerts (always)

Before starting work in a repo, look at its open findings and fix what the task touches or what is quick: code scanning alerts (`gh api 'repos/Supertext/Wix-Supertext-Translation/code-scanning/alerts?state=open'`), secret scanning alerts (`…/secret-scanning/alerts?state=open`), open Dependabot PRs and the issue "Broken links in the docs". New workflows and workflow changes must pass actionlint and zizmor; PHP code must pass PHPStan at the repo's level. See `docs/DEVELOPER.md` → *Code quality and security checks*.

## Demo accounts rule (always)

The demo is a Wix site set up by hand (see `docs/DEVELOPER.md` → *Demo*): Wix accounts are personal and created by Wix, so the `DEMO_*` accounts are Wix collaborators (admin for Supertext staff, an editor-level role that can use apps for tests and screenshots), invited by hand. Values never go in the repo, in chat or in logs.

## Screenshots rule (always)

The user guide and installation guide include screenshots, taken by `npm run docs:screenshots` (Playwright, `tests/docs/screenshots.ts`) against the stand-in Wix and Supertext APIs, which return real translations of the sample site (`tests/standin/samples.json`), stored in `docs/images/` at 1× scale with alt text, and regenerated in the same commit whenever the UI they show changes. The README's demo movie: `npm run docs:movie` (`tests/docs/movie.ts`, shared kit in `tests/docs/movie/`); the install and configuration movie: `npm run docs:movie:install` (`tests/docs/movie-install.ts`, same kit, MP4 only). Screenshots of Wix's own screens (language setup, Translation Manager) are added from the demo site once it exists. No secrets, no customer data, no local URLs.

## Shared Supertext protocol

AI file translation API v1, same as the WordPress plugin: POST HTML file → poll status → GET translation → DELETE. Details in `docs/DEVELOPER.md`. Never commit API keys or the Wix app secret; use environment variables (`SUPERTEXT_API_KEY`, `WIX_APP_SECRET`) or the app's settings (stored encrypted).

Lessons from the live API, apply them here: header `Authorization: Supertext-Auth-Key <key>` (strip a pasted prefix), retry HTTP 429 (per-second rate limit), keep a whole text in one `data-st-id` element (each one is translated on its own): one segment per text field, HTML field or Ricos text block, and **languages:** only the codes Supertext's `GET features` lists (the SDK's `Languages`, `src/vendor/supertext-sdk/v1`): bare sources (`en`); targets regional only for de/en/fr/it/pt (`de-CH`, `en-US`), `zh-Hans`/`zh-Hant`, `sr-Latn`/`sr-Cyrl`, `gsw-u-sd-chzh`/`chbe`, bare for the rest (`es`, `nl`, `sl`). **No guessing:** the site's mapping (a combo box per site language under Settings → Languages, `languageCodes`), else an exact match, else the SDK default (`Languages.defaultTarget`: de→de-DE, en→en-US, fr→fr-FR, it→it-IT, pt→pt-PT, zh→zh-Hans, sr→sr-Latn, zh-TW→zh-Hant, es-ES→es …), else the error `unsupported_language` (nothing sent); see `docs/DEVELOPER.md` → *Language codes*.

**Commando Center:** version reports and the automatic API key check go through Supertext Plugin Health's `InstallationReporter` with the SDK's `checkApiKey()` (`src/reporting.ts`, state per site instance in `site_settings.reporter_state`, setting `versionReports` / `SUPERTEXT_VERSION_REPORTS`); hosted app: no ping, no callback URL, site URL = the Wix site's URL (`GET /apps/v1/instance`); see `docs/DEVELOPER.md` → *Commando Center*. Reporting must never break a save, a page or a translation.

## This repo

- Supertext calls go through the **Supertext SDK** (TypeScript, API in `v1/`), vendored in `src/vendor/supertext-sdk/` from https://github.com/Supertext/Supertext-API-SDK-and-Guide; reach it only through `src/supertext/index.ts`. Never edit the vendored files: fix the SDK upstream and run `scripts/vendor-sdk.sh [ref]`. Version reports use **Supertext Plugin Health** (TypeScript), vendored the same way in `src/vendor/supertext-plugin-health/` from https://github.com/Supertext/Commando-Center-Supertext-Translation (`plugin-health/`); never edit it either: fix it there and run `scripts/vendor-plugin-health.sh <tag>`. Supertext errors use the SDK's codes as message keys (`error.<code>`).
- Before committing: `npm run typecheck`, `npm test`, `npm run build`. CI also runs the built app against the stand-ins (`tests/standin/server.ts`).
- End-to-end tests against the real Supertext API: `.github/workflows/e2e.yml` with `tests/e2e/` (the app's Docker image, the Wix stand-in, Playwright through the app's own pages; see "End-to-end tests" in `docs/DEVELOPER.md`). The key is only the GitHub secret `SUPERTEXT_API_KEY`, set by Remy; sessions never use a live key. Behaviour changes need matching checks in `tests/e2e/live.ts`.
- Every request must verify Wix's signed instance (`src/auth/instance.ts`); never trust an instance ID sent in plain text. The instance ID is the site's key in the store.
- Translated fields are decided by the schema (`src/translation/fields.ts`): `SHORT_TEXT`, `LONG_TEXT`, `HTML`, `RICH_CONTENT`; keep "What is translated" in `docs/USER_GUIDE.md` and the flow in `docs/DEVELOPER.md` in sync.
- Translation review: per target language in `SiteSettings.reviewLocales` (checkbox `review:<locale>` on Settings → Languages, column `review_locales`); `SUPERTEXT_REVIEW_URL` (default `REVIEW_URL` in `src/supertext/index.ts`, `''` = off) is the review service; `runJob` takes the review client per locale. Key check, reports and translation files never use it.
- New settings go in `src/store/store.ts` (and the Postgres table in `src/store/postgres.ts`), `src/views/settings.tsx`, the form handler in `src/app.ts` **and** the settings table in `docs/INSTALLATION.md`.
- Changes to the Wix calls go through `src/wix/client.ts` and the stand-in (`tests/standin/wix.ts`) together. Check real Wix behaviour with `npm run wix:probe` (read-only) before relying on it.
- Hosting: Railway service *Wix* in *supertext-cms-demos*, building the `Dockerfile` (set on the service; Railway ignores `railway.json`), health check `/health`, its own database `wix_supertext` on the shared Postgres. Don't export-ignore anything the Dockerfile copies.
