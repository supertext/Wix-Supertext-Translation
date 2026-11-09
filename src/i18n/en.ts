// English: the source language and the fallback for missing keys.
// Placeholders in braces ({count}, {settings}) are filled in by the code;
// never translate them. Keys ending in .one / .other are plural forms.

export const en = {
  // Navigation
  "nav.translate": "Translate",
  "nav.settings": "Settings",

  // API key help (shown wherever the key is mentioned)
  "apiKeyHelp.text":
    "No Supertext account yet? {signup}. Generate your API key at {apiKey} (requires the Admin role).",
  "apiKeyHelp.signup": "Create one at supertext.com",
  "apiKeyHelp.apiKey": "supertext.com → Integrations → API",

  // Translate page
  "translate.heading": "Translate with Supertext",
  "translate.intro":
    "Translate your site's content into its other languages with Supertext AI. Translations are saved in Wix Multilingual, where you can review them in the Translation Manager.",
  "translate.noKey.heading": "Add your Supertext API key",
  "translate.noKey.text": "The app needs a Supertext API key before it can translate. Enter it under {settings}.",
  "translate.noKey.settings": "Settings",
  "translate.oneLanguage.heading": "Add a second language",
  "translate.oneLanguage.text":
    "Your site has only one language. Add languages with Wix Multilingual in your site's dashboard, then come back here.",
  "translate.noSchemas": "Wix Multilingual has no translatable content on this site yet.",
  "translate.step1": "1. Choose what to translate",
  "translate.type": "Content type",
  "translate.otherApps": "Other",
  "translate.empty": "Nothing of this type yet.",
  "translate.item": "Item",
  "translate.selectAll": "Select all on this page ({count})",
  "translate.firstPage": "First page",
  "translate.nextPage": "Next page",
  "translate.step2": "2. Choose the languages",
  "translate.from": "Translating from {language}, your site's main language.",
  "translate.hidden": "hidden on the site",
  "translate.noLanguage": "no Supertext language yet: choose one under {settings}",
  "translate.noLanguage.settings": "Settings → Languages",
  "translate.overwrite": "Overwrite existing translations",
  "translate.overwriteHint": "Without this option, fields that are translated already are kept.",
  "translate.overwriteWarning":
    "Fields that are translated already will be replaced, including changes made by hand in the Translation Manager.",
  "translate.submit": "Translate with Supertext",
  "translate.submitCount.one": "Translate {count} item with Supertext",
  "translate.submitCount.other": "Translate {count} items with Supertext",
  "translate.selectSomething": "Select at least one item and one language.",
  "translate.starting": "Starting…",

  // Item states
  "state.none": "Not translated",
  "state.partial": "Partly translated",
  "state.done": "Translated",

  // Progress and results
  "job.heading": "Translation",
  "job.running": "Translating… {completed} of {total}",
  "job.done": "Done: {translated} translated, {unchanged} unchanged, {failed} failed.",
  "job.failed": "The translation stopped: {reason}",
  "job.translated.one": "Translated ({count} field)",
  "job.translated.other": "Translated ({count} fields)",
  "job.kept": "{count} kept",
  "job.tooLong": "{count} too long for Wix, not saved",
  "job.unchanged": "Already translated, unchanged",
  "job.review": "Review the translations in the {manager}.",
  "job.manager": "Translation Manager",

  // Settings page
  "settings.heading": "Supertext settings",
  "settings.saved": "Settings saved.",
  "settings.invalidCodes": "Saved, except these language codes, which Supertext doesn't offer: {codes}.",
  "settings.apiKey.heading": "Supertext API key",
  "settings.apiKey.label": "API key",
  "settings.apiKey.placeholder": "Paste your Supertext API key",
  "settings.apiKey.placeholderSaved": "A key is saved (stored encrypted). Enter a new one to replace it.",
  "settings.apiKey.server": "No key of your own yet: the app uses the key set on the server.",
  "settings.apiKey.remove": "Remove the saved key",
  "settings.test": "Test connection",
  "settings.testing": "Testing…",
  "keyCheck.ok": "API key checked: the connection to Supertext works.",
  "keyCheck.invalid":
    "Supertext rejected the API key. Check that you copied the whole key, or generate a new one at {apiKey} (requires the Admin role). No Supertext account yet? Create one at {signup}.",
  "keyCheck.missing":
    "No API key is set yet. No Supertext account yet? Create one at {signup}. Generate your API key at {apiKey} (requires the Admin role).",
  "keyCheck.unreachable":
    "The API key couldn't be checked because Supertext can't be reached. The settings are saved; check again later.",
  "keyCheck.error":
    "The API key couldn't be checked: Supertext answered with an error ({status}). The settings are saved; check again later.",
  "keyCheck.signup": "supertext.com",
  "keyCheck.checkedAt": "Last API key check: {time}",
  "settings.languages.heading": "Languages",
  "settings.languages.text":
    "The Supertext language each of your site's languages is translated into (for the main language: translated from). Each list preselects the obvious choice: the same code if Supertext offers it (for example de-CH or es), else the usual default (German → German (Germany), English → English (US), Chinese (Taiwan) → Chinese (Traditional)). Change it where you need another variant, for example German (Switzerland). Languages without an obvious choice (for example English (Ireland) or Swiss German) are marked “No Supertext language” and aren't translated until you pick one.",
  "settings.languages.main": "main language",
  "settings.languages.site": "Site language",
  "settings.languages.supertext": "Supertext language",
  "settings.languages.choose": "— Not translated: choose a Supertext language —",
  "settings.languages.missing": "No Supertext language",
  "settings.languages.review": "Translation review",
  "settings.languages.reviewHelp":
    "Translation review: translations into a language with this ticked go through Supertext's review service, so reviewers can check and correct them on the website with the Supertext Localization Review extension. Their corrections are used the next time the item is translated. Other languages go directly to Supertext.",
  "settings.languages.reviewOff": "Translation review is turned off on this server (SUPERTEXT_REVIEW_URL is empty).",
  "settings.languages.unmapped":
    "These languages have no Supertext language yet and aren't translated until you choose one: {languages}.",
  // Translation files (export for translation, import translation)
  "files.export.heading": "Export for translation",
  "files.export.text": "Download the item ticked above as a file for a translator, a translation tool or Supertext's web app, and import the translated file below.",
  "files.export.selectOne": "Tick exactly one item above to export it.",
  "files.format": "File format",
  "files.format.xliff": "XLIFF 1.2 (for translation tools)",
  "files.format.html": "HTML (one language per file)",
  "files.languages": "Target languages",
  "files.download": "Download file",
  "files.import.heading": "Import translation",
  "files.import.text": "Upload a file exported here and translated. Its translations are saved in Wix Multilingual like Supertext's own.",
  "files.file": "Translated file (XLIFF or HTML)",
  "files.includeChanged": "Also import texts whose source changed since the export",
  "files.import.submit": "Import translation",
  "files.importing": "Importing…",
  "files.summary.ok": "Imported: {count}",
  "files.summary.changed": "Skipped, source changed since the export: {count}",
  "files.summary.untranslated": "Not translated in the file: {count}",
  "files.summary.invalid": "Formatting changed, not imported: {count}",
  "files.summary.missing": "Not in the file: {count}",
  "files.summary.kept": "Kept, already translated: {count}",
  "files.summary.notWritten": "Not saved, too long for the field or other parts of the same rich text not translated: {count}",
  "settings.style.heading": "Translation",
  "settings.style.label": "Form of address",
  "settings.style.default": "Let Supertext decide",
  "settings.style.more": "Formal (e.g. German “Sie”)",
  "settings.style.less": "Informal (e.g. German “du”)",
  "settings.style.noPoliteness":
    "Formal or informal address isn't available for {languages}; Supertext decides there.",
  "settings.publish": "Mark translations as ready to publish",
  "settings.publishHint":
    "Off: translations wait in the Translation Manager until you mark them ready to publish.",
  "settings.reports.heading": "Version information",
  "settings.reports.label": "Send version information to Supertext",
  "settings.reports.help":
    "Sends the site URL and the versions of this app and the runtime to Supertext when you save these settings and after an update, so Supertext support can see which version you run. No content, no API key and no personal data are sent.",
  "settings.reports.forcedOff": "Turned off for all sites on the app's server (SUPERTEXT_VERSION_REPORTS).",
  "settings.reports.forcedOn": "Turned on for all sites on the app's server (SUPERTEXT_VERSION_REPORTS).",
  "settings.save": "Save",
  "settings.about.heading": "About",
  "settings.about.version": "Supertext Translation for Wix, version {version}",

  // Errors from Supertext and Wix (codes set by LocalizedError)
  "error.missing_api_key":
    "No Supertext API key configured. Add it under Settings. No Supertext account yet? Create one at https://www.supertext.com/person/en/account/signin. Generate your API key at https://www.supertext.com/en/integrations/api (requires the Admin role).",
  "error.no_file_id": "Supertext did not return a file id.",
  "error.translation_error": "Supertext failed to translate the document.",
  "error.quota_exceeded": "Your Supertext translation limit is exceeded.",
  "error.file_deleted": "The Supertext file was deleted before it could be downloaded.",
  "error.timeout": "Timed out waiting for the Supertext translation.",
  "error.transport_error": "Could not reach Supertext.",
  "error.authentication_failure":
    "Authentication failed. Please check the Supertext API key. No Supertext account yet? Create one at https://www.supertext.com/person/en/account/signin. Generate your API key at https://www.supertext.com/en/integrations/api (requires the Admin role).",
  "error.not_found": "The requested Supertext resource was not found.",
  "error.payload_too_large": "The content is too large for Supertext to translate in one go.",
  "error.too_many_requests": "Too many requests to Supertext. Please try again shortly.",
  "error.service_unavailable": "The Supertext service is currently unavailable.",
  "error.unexpected_status": "Supertext answered with HTTP {status}.",
  "error.invalid_language_pair":
    "Supertext doesn't translate from \"{source}\" into \"{target}\". Choose another Supertext language for it under Settings → Languages.",
  "error.invalid_language_pair_unknown":
    "Supertext doesn't translate into this language. Choose another Supertext language for it under Settings → Languages.",
  "error.unsupported_language":
    "\"{language}\" has no Supertext language yet, so nothing was sent. Choose its Supertext language under Settings → Languages.",
  "error.unsupported_feature":
    "Supertext doesn't offer formal or informal address for \"{target}\". Choose \"Let Supertext decide\" under Settings → Translation.",
  "error.incomplete_response": "The Supertext translation came back incomplete; nothing was saved for this item.",
  "error.sourceMissing": "The original text of this item was not found.",
  "error.schemaMissing": "This content type no longer exists on the site.",
  "error.multilingualMissing":
    "Wix Multilingual isn't set up on this site. Add the Wix Multilingual app and a second language first.",
  "error.wixAuth": "Wix refused the request. Reinstall the app to grant it the permissions it needs.",
  "error.wixNotConfigured": "The app is missing its Wix credentials (WIX_APP_ID, WIX_APP_SECRET).",
  "error.wixUnreachable": "Could not reach Wix: {reason}",
  "error.wixUnavailable": "Wix is currently unavailable. Please try again shortly.",
  "error.wixHttp": "Wix answered with HTTP {status}.",
  "error.wixRejected": "Wix rejected the translation.",
  "error.interrupted": "The app restarted during the translation. Start it again; finished items are kept.",
  "error.session": "This page has expired. Reload it from the Wix dashboard.",
  "error.nothing_to_translate": "Nothing to translate.",
  "error.file_invalid": "This file isn't a valid XLIFF or HTML translation file.",
  "error.file_missing_metadata": "This file wasn't exported by the Supertext app, or its header was removed.",
  "error.file_too_large": "The file is too large (at most 10 MB).",
  "error.file_other_system": "This file belongs to another system ({plugin}).",
  "error.file_item_gone": "The item this file was exported from no longer exists.",
  "error.file_no_language": "The site has no language {language}.",
  "error.file_select_one": "Select exactly one item to export.",
  "error.file_select_language": "Select at least one language.",
  "error.file_html_one_language": "An HTML file holds exactly one language. Choose one language, or XLIFF.",
  "error.file_choose": "Choose a file.",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
