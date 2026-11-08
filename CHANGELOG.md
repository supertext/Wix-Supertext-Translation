# Changelog

All notable changes to Supertext Translation for Wix.

## Unreleased

- Docs: demo movie in the README (`docs/images/demo.gif`, recorded against the stand-ins with `npm run docs:movie`; the MP4 version, not committed, is narrated with the Piper voice “alba”) and an install and configuration movie (`npm run docs:movie:install`: the app in the Wix dashboard, the API key, the language mapping, *Save* with the key check, *Test connection*; narrated MP4, not committed).
- Added: the Supertext support form is linked in the README, the user guide and GitHub's "New issue" page.
- **Translation review** per language (Settings → Languages, a checkbox next to each target language's Supertext language, off by default): translations into a language with *Translation review* ticked go through Supertext's review service (Supertext Localization Review), where customers and Supertext linguists correct them on the website with a Chrome extension; corrections come back into Wix with the next translation (with *Overwrite existing translations*), and texts translated before keep their (reviewed) wording. Same API key, billing, languages and messages; other languages keep going directly to Supertext. New server variable `SUPERTEXT_REVIEW_URL` (defaults to Supertext's review service; empty turns review off for all sites). Existing sites start with review off (new column `review_locales`, added on start). All four interface languages; language settings screenshots updated.
- Requests to Supertext name the app's version in the User-Agent (`Wix-Supertext-Translation/<version>`), as before; the review service gets the same.
- **Export for translation (XLIFF 1.2 or HTML) and import of translated files; Supertext SDK 0.5.0.** On the translate page, below the translate button: export the ticked item for a translator, a translation tool or Supertext's web app (XLIFF with one or more languages, HTML with one), and import the translated file (up to 10 MB). The import writes the translations like Supertext's (same *ready to publish* setting), keeps translated fields unless *Overwrite existing translations*, skips texts whose source changed since the export unless asked, writes a rich text only when all its paragraphs are translated, and shows a summary per item and language. All four interface languages; two new screenshots. Bundled Supertext SDK updated to 0.5.0 (commit `a47ca07`).
- **Languages: obvious defaults.** A site language nobody chose a Supertext language for is translated into its usual variant (`de` → `de-DE`, `en` → `en-US`, `fr` → `fr-FR`, `it` → `it-IT`, `pt` → `pt-PT`, `zh-TW` → `zh-Hant`, `es-ES` → `es` …) instead of being skipped, so it is ticked on the translate page. Each combo box under Settings → Languages is preselected with the saved choice, else that suggestion; only languages without one (`en-IE`, `de-LI`, `gsw`, `sr-RS` …) are still flagged *No Supertext language*. Saved choices stay as they are. Supertext SDK 0.4.0 (commit `6aaad33`).
- **Supertext's look:** deep-green header with the Supertext logo, warm off-white background, mint for the main action, the active tab and finished translations, pill-shaped buttons and language choices, Inter bundled with the app (no external fonts), and the Supertext favicon. Screenshots updated.
- Version reports and the API key check result now use Supertext Plugin Health 0.1.0 (bundled in `src/vendor/supertext-plugin-health`); Supertext SDK updated to 0.3.0 (commit `f7bd414`). No change for sites: settings and stored state stay as they are.
- Supertext SDK 0.2.1 (API in its `v1` namespace; `scripts/vendor-sdk.sh` copies the whole source tree).
- **Languages: no more guessed regions.** A site language is translated into the Supertext language chosen for it under Settings → Languages (now a list of the languages Supertext offers, for the main language too), else into its own code if Supertext offers exactly that (`de-CH`, `es`), else not at all: the item says *"German" has no Supertext language yet* and where to choose one (`unsupported_language`), and nothing is sent. Sites with bare languages such as *German* (`de`), which were sent as `de-DE` before, need a choice under Settings → Languages. The settings page lists the languages without a Supertext language, and the translate page leaves them unticked. Only codes Supertext offers can be saved.
- Formal/informal address is sent only for languages where Supertext offers it (not for English, Swiss German, Romansh, Albanian, Serbian); the settings page names them. New message for `unsupported_feature`.
- **Version information for Supertext support** (Commando Center): new setting *Send version information to Supertext* (on by default; `SUPERTEXT_VERSION_REPORTS=0` turns it off for all sites). Sends the site URL, the app, Node.js and SDK versions and the API key check result when the settings are saved and after updates; never content or the key. No callback/ping (hosted app).
- **Automatic API key check:** saving the settings checks the key and shows the result with its time (*API key checked …*, *Supertext rejected the API key …* with the account and API key links); *Test connection* shows the same messages. A translation rejected with 401/403 updates the stored result.
- Docs: language mapping, version information, new troubleshooting entries; new screenshot of the language settings, settings screenshot updated.

- Uses the Supertext SDK (TypeScript, vendored in `src/vendor/supertext-sdk`) for all calls to Supertext instead of its own client. Supertext error messages now use the SDK's error codes; a language code entered without region in the settings (e.g. `de`) is sent with its default region (`de-DE`) instead of being rejected by Supertext.

- Fixed: a target language Supertext doesn't know is now reported as an unsupported language pair (was: *The requested Supertext resource was not found*).
- Fixed: translations of items that had none in that language yet were rejected by Wix (*Entity not found*); they are now created, and existing ones updated.

## 0.1.0 — 2026-10-09

First version (in development: tested against a stand-in of the Wix APIs, not yet on a real Wix site).

- Wix app with a dashboard page: choose a content type (Wix Stores products and categories, Wix Blog posts and any other content Wix Multilingual can translate), select items and languages, translate with Supertext AI, see each item's result.
- Reads the original texts from Wix Multilingual and writes the translations back there, field by field, marked as translated by an external app and, by default, ready to publish.
- Rich text (Ricos) keeps headings, lists, bold, italics, underline and links; HTML fields keep their markup; images and other media aren't sent.
- Existing translations are kept unless *Overwrite existing translations* is ticked, with a warning.
- Settings per site: Supertext API key (stored encrypted, with account and API key links), *Test connection*, form of address, whether translations are marked ready to publish, the Supertext language code per site language, and the app version linked to its release.
- Interface in English, German, French and Italian, following the Wix dashboard language.
- Signed Wix instance checked on every request; Supertext's per-second limit (HTTP 429) and Wix's are retried.
