import type { Messages } from "./en.js";

// German, with the terms of Wix's German dashboard (Website, Hauptsprache, Übersetzungsmanager).
export const de: Messages = {
  "nav.translate": "Übersetzen",
  "nav.settings": "Einstellungen",

  "apiKeyHelp.text":
    "Noch kein Supertext-Konto? {signup}. Generieren Sie Ihren API-Schlüssel unter {apiKey} (erfordert die Admin-Rolle).",
  "apiKeyHelp.signup": "Erstellen Sie eines auf supertext.com",
  "apiKeyHelp.apiKey": "supertext.com → Integrations → API",

  "translate.heading": "Mit Supertext übersetzen",
  "translate.intro":
    "Übersetzen Sie die Inhalte Ihrer Website mit Supertext AI in deren weitere Sprachen. Die Übersetzungen werden in Wix Multilingual gespeichert, wo Sie sie im Übersetzungsmanager prüfen können.",
  "translate.noKey.heading": "Supertext-API-Schlüssel hinzufügen",
  "translate.noKey.text":
    "Die App benötigt einen Supertext-API-Schlüssel, bevor sie übersetzen kann. Geben Sie ihn unter {settings} ein.",
  "translate.noKey.settings": "Einstellungen",
  "translate.oneLanguage.heading": "Zweite Sprache hinzufügen",
  "translate.oneLanguage.text":
    "Ihre Website hat nur eine Sprache. Fügen Sie in der Verwaltung Ihrer Website mit Wix Multilingual weitere Sprachen hinzu und kehren Sie dann hierher zurück.",
  "translate.noSchemas": "Wix Multilingual hat auf dieser Website noch keine übersetzbaren Inhalte.",
  "translate.step1": "1. Inhalte auswählen",
  "translate.type": "Inhaltstyp",
  "translate.otherApps": "Weitere",
  "translate.empty": "Noch nichts von diesem Typ vorhanden.",
  "translate.item": "Element",
  "translate.selectAll": "Alle auf dieser Seite auswählen ({count})",
  "translate.firstPage": "Erste Seite",
  "translate.nextPage": "Nächste Seite",
  "translate.step2": "2. Sprachen auswählen",
  "translate.from": "Übersetzt wird aus {language}, der Hauptsprache Ihrer Website.",
  "translate.hidden": "auf der Website ausgeblendet",
  "translate.noLanguage": "noch keine Supertext-Sprache: wählen Sie eine unter {settings}",
  "translate.noLanguage.settings": "Einstellungen → Sprachen",
  "translate.overwrite": "Vorhandene Übersetzungen überschreiben",
  "translate.overwriteHint": "Ohne diese Option bleiben bereits übersetzte Felder unverändert.",
  "translate.overwriteWarning":
    "Bereits übersetzte Felder werden ersetzt, auch Änderungen, die im Übersetzungsmanager von Hand gemacht wurden.",
  "translate.submit": "Mit Supertext übersetzen",
  "translate.submitCount.one": "{count} Element mit Supertext übersetzen",
  "translate.submitCount.other": "{count} Elemente mit Supertext übersetzen",
  "translate.selectSomething": "Wählen Sie mindestens ein Element und eine Sprache aus.",
  "translate.starting": "Wird gestartet …",

  "state.none": "Nicht übersetzt",
  "state.partial": "Teilweise übersetzt",
  "state.done": "Übersetzt",

  "job.heading": "Übersetzung",
  "job.running": "Wird übersetzt … {completed} von {total}",
  "job.done": "Fertig: {translated} übersetzt, {unchanged} unverändert, {failed} fehlgeschlagen.",
  "job.failed": "Die Übersetzung wurde abgebrochen: {reason}",
  "job.translated.one": "Übersetzt ({count} Feld)",
  "job.translated.other": "Übersetzt ({count} Felder)",
  "job.kept": "{count} beibehalten",
  "job.tooLong": "{count} zu lang für Wix, nicht gespeichert",
  "job.unchanged": "Bereits übersetzt, unverändert",
  "job.review": "Prüfen Sie die Übersetzungen im {manager}.",
  "job.manager": "Übersetzungsmanager",

  "settings.heading": "Supertext-Einstellungen",
  "settings.saved": "Einstellungen gespeichert.",
  "settings.invalidCodes": "Gespeichert, außer diesen Sprachcodes, die Supertext nicht anbietet: {codes}.",
  "settings.apiKey.heading": "Supertext-API-Schlüssel",
  "settings.apiKey.label": "API-Schlüssel",
  "settings.apiKey.placeholder": "Fügen Sie Ihren Supertext-API-Schlüssel ein",
  "settings.apiKey.placeholderSaved":
    "Ein Schlüssel ist gespeichert (verschlüsselt). Geben Sie einen neuen ein, um ihn zu ersetzen.",
  "settings.apiKey.server": "Noch kein eigener Schlüssel: Die App verwendet den auf dem Server hinterlegten Schlüssel.",
  "settings.apiKey.remove": "Gespeicherten Schlüssel entfernen",
  "settings.test": "Verbindung testen",
  "settings.testing": "Wird getestet …",
  "keyCheck.ok": "API-Schlüssel geprüft: Die Verbindung zu Supertext funktioniert.",
  "keyCheck.invalid":
    "Supertext hat den API-Schlüssel abgelehnt. Prüfen Sie, ob Sie den ganzen Schlüssel kopiert haben, oder erstellen Sie einen neuen unter {apiKey} (erfordert die Rolle Admin). Noch kein Supertext-Konto? Erstellen Sie eines auf {signup}.",
  "keyCheck.missing":
    "Es ist noch kein API-Schlüssel eingetragen. Noch kein Supertext-Konto? Erstellen Sie eines auf {signup}. Ihren API-Schlüssel erstellen Sie unter {apiKey} (erfordert die Rolle Admin).",
  "keyCheck.unreachable":
    "Der API-Schlüssel konnte nicht geprüft werden, weil Supertext nicht erreichbar ist. Die Einstellungen sind gespeichert; prüfen Sie ihn später erneut.",
  "keyCheck.error":
    "Der API-Schlüssel konnte nicht geprüft werden: Supertext hat mit einem Fehler geantwortet ({status}). Die Einstellungen sind gespeichert; prüfen Sie ihn später erneut.",
  "keyCheck.signup": "supertext.com",
  "keyCheck.checkedAt": "Letzte Prüfung des API-Schlüssels: {time}",
  "settings.languages.heading": "Sprachen",
  "settings.languages.text":
    "Die Supertext-Sprache, in die jede Sprache Ihrer Website übersetzt wird (bei der Hauptsprache: aus der übersetzt wird). Jede Liste ist mit der naheliegenden Wahl vorbelegt: dem gleichen Code, wenn Supertext ihn anbietet (zum Beispiel de-CH oder es), sonst dem üblichen Standard (Deutsch → Deutsch (Deutschland), Englisch → Englisch (USA), Chinesisch (Taiwan) → Chinesisch (traditionell)). Ändern Sie sie, wo Sie eine andere Variante brauchen, zum Beispiel Deutsch (Schweiz). Sprachen ohne naheliegende Wahl (zum Beispiel Englisch (Irland) oder Schweizerdeutsch) sind mit „Keine Supertext-Sprache“ markiert und werden erst übersetzt, wenn Sie eine Sprache wählen.",
  "settings.languages.main": "Hauptsprache",
  "settings.languages.site": "Sprache der Website",
  "settings.languages.supertext": "Supertext-Sprache",
  "settings.languages.choose": "— Wird nicht übersetzt: Supertext-Sprache wählen —",
  "settings.languages.missing": "Keine Supertext-Sprache",
  "settings.languages.review": "Übersetzungsprüfung",
  "settings.languages.reviewHelp":
    "Übersetzungsprüfung: Übersetzungen in eine Sprache mit diesem Häkchen laufen über den Prüfdienst von Supertext, damit Prüferinnen und Prüfer sie mit der Erweiterung Supertext Localization Review direkt auf der Website kontrollieren und korrigieren können. Ihre Korrekturen werden beim nächsten Übersetzen des Elements übernommen. Andere Sprachen gehen direkt an Supertext.",
  "settings.languages.reviewOff": "Die Übersetzungsprüfung ist auf diesem Server ausgeschaltet (SUPERTEXT_REVIEW_URL ist leer).",
  "settings.languages.unmapped":
    "Diese Sprachen haben noch keine Supertext-Sprache und werden erst übersetzt, wenn Sie eine wählen: {languages}.",
  // Translation files (export for translation, import translation)
  "files.export.heading": "Für Übersetzung exportieren",
  "files.export.text": "Laden Sie das oben angekreuzte Element als Datei für eine Übersetzerin, ein Übersetzungstool oder die Web-App von Supertext herunter und importieren Sie die übersetzte Datei unten.",
  "files.export.selectOne": "Kreuzen Sie oben genau ein Element an, um es zu exportieren.",
  "files.format": "Dateiformat",
  "files.format.xliff": "XLIFF 1.2 (für Übersetzungstools)",
  "files.format.html": "HTML (eine Sprache pro Datei)",
  "files.languages": "Zielsprachen",
  "files.download": "Datei herunterladen",
  "files.import.heading": "Übersetzung importieren",
  "files.import.text": "Laden Sie eine hier exportierte und übersetzte Datei hoch. Ihre Übersetzungen werden wie die von Supertext in Wix Multilingual gespeichert.",
  "files.file": "Übersetzte Datei (XLIFF oder HTML)",
  "files.includeChanged": "Auch Texte importieren, deren Ausgangstext sich seit dem Export geändert hat",
  "files.import.submit": "Übersetzung importieren",
  "files.importing": "Wird importiert…",
  "files.summary.ok": "Importiert: {count}",
  "files.summary.changed": "Übersprungen, Ausgangstext seit dem Export geändert: {count}",
  "files.summary.untranslated": "In der Datei nicht übersetzt: {count}",
  "files.summary.invalid": "Formatierung verändert, nicht importiert: {count}",
  "files.summary.missing": "Nicht in der Datei: {count}",
  "files.summary.kept": "Beibehalten, bereits übersetzt: {count}",
  "files.summary.notWritten": "Nicht gespeichert, zu lang für das Feld oder andere Teile desselben Rich Texts nicht übersetzt: {count}",
  "settings.style.heading": "Übersetzung",
  "settings.style.label": "Anrede",
  "settings.style.default": "Supertext entscheiden lassen",
  "settings.style.more": "Formell (z. B. „Sie“)",
  "settings.style.less": "Informell (z. B. „du“)",
  "settings.style.noPoliteness":
    "Formelle oder informelle Anrede ist für {languages} nicht verfügbar; dort entscheidet Supertext.",
  "settings.publish": "Übersetzungen als bereit zur Veröffentlichung markieren",
  "settings.publishHint":
    "Aus: Die Übersetzungen warten im Übersetzungsmanager, bis Sie sie zur Veröffentlichung freigeben.",
  "settings.reports.heading": "Versionsinformationen",
  "settings.reports.label": "Versionsinformationen an Supertext senden",
  "settings.reports.help":
    "Sendet die URL der Website sowie die Versionen dieser App und der Laufzeitumgebung an Supertext, wenn Sie diese Einstellungen speichern und nach einem Update. So sieht der Supertext-Support, welche Version Sie einsetzen. Es werden keine Inhalte, kein API-Schlüssel und keine Personendaten übertragen.",
  "settings.reports.forcedOff":
    "Auf dem Server der App für alle Websites ausgeschaltet (SUPERTEXT_VERSION_REPORTS).",
  "settings.reports.forcedOn":
    "Auf dem Server der App für alle Websites eingeschaltet (SUPERTEXT_VERSION_REPORTS).",
  "settings.save": "Speichern",
  "settings.about.heading": "Info",
  "settings.about.version": "Supertext Translation für Wix, Version {version}",

  "error.missing_api_key":
    "Kein Supertext-API-Schlüssel konfiguriert. Fügen Sie ihn unter Einstellungen hinzu. Noch kein Supertext-Konto? Erstellen Sie eines auf https://www.supertext.com/person/en/account/signin. Generieren Sie Ihren API-Schlüssel unter https://www.supertext.com/en/integrations/api (erfordert die Admin-Rolle).",
  "error.no_file_id": "Supertext hat keine Datei-ID zurückgegeben.",
  "error.translation_error": "Supertext konnte das Dokument nicht übersetzen.",
  "error.quota_exceeded": "Ihr Supertext-Übersetzungslimit ist überschritten.",
  "error.file_deleted": "Die Supertext-Datei wurde gelöscht, bevor sie heruntergeladen werden konnte.",
  "error.timeout": "Zeitüberschreitung beim Warten auf die Supertext-Übersetzung.",
  "error.transport_error": "Supertext ist nicht erreichbar.",
  "error.authentication_failure":
    "Authentifizierung fehlgeschlagen. Bitte prüfen Sie den Supertext-API-Schlüssel. Noch kein Supertext-Konto? Erstellen Sie eines auf https://www.supertext.com/person/en/account/signin. Generieren Sie Ihren API-Schlüssel unter https://www.supertext.com/en/integrations/api (erfordert die Admin-Rolle).",
  "error.not_found": "Die angeforderte Supertext-Ressource wurde nicht gefunden.",
  "error.payload_too_large": "Der Inhalt ist zu groß, um von Supertext in einem Durchgang übersetzt zu werden.",
  "error.too_many_requests": "Zu viele Anfragen an Supertext. Bitte versuchen Sie es gleich nochmals.",
  "error.service_unavailable": "Der Supertext-Dienst ist derzeit nicht verfügbar.",
  "error.unexpected_status": "Supertext hat mit HTTP {status} geantwortet.",
  "error.invalid_language_pair":
    "Supertext übersetzt nicht aus „{source}“ in „{target}“. Wählen Sie unter Einstellungen → Sprachen eine andere Supertext-Sprache dafür.",
  "error.invalid_language_pair_unknown":
    "Supertext übersetzt nicht in diese Sprache. Wählen Sie unter Einstellungen → Sprachen eine andere Supertext-Sprache dafür.",
  "error.unsupported_language":
    "„{language}“ hat noch keine Supertext-Sprache, deshalb wurde nichts gesendet. Wählen Sie die Supertext-Sprache dafür unter Einstellungen → Sprachen.",
  "error.unsupported_feature":
    "Supertext bietet für „{target}“ keine formelle oder informelle Anrede an. Wählen Sie „Supertext entscheiden lassen“ unter Einstellungen → Übersetzung.",
  "error.incomplete_response": "Die Supertext-Übersetzung ist unvollständig zurückgekommen; für dieses Element wurde nichts gespeichert.",
  "error.sourceMissing": "Der Originaltext dieses Elements wurde nicht gefunden.",
  "error.schemaMissing": "Dieser Inhaltstyp existiert auf der Website nicht mehr.",
  "error.multilingualMissing":
    "Wix Multilingual ist auf dieser Website nicht eingerichtet. Fügen Sie zuerst die App Wix Multilingual und eine zweite Sprache hinzu.",
  "error.wixAuth":
    "Wix hat die Anfrage abgelehnt. Installieren Sie die App erneut, um ihr die nötigen Berechtigungen zu erteilen.",
  "error.wixNotConfigured": "Der App fehlen ihre Wix-Zugangsdaten (WIX_APP_ID, WIX_APP_SECRET).",
  "error.wixUnreachable": "Wix ist nicht erreichbar: {reason}",
  "error.wixUnavailable": "Wix ist derzeit nicht verfügbar. Bitte versuchen Sie es gleich nochmals.",
  "error.wixHttp": "Wix hat mit HTTP {status} geantwortet.",
  "error.wixRejected": "Wix hat die Übersetzung abgelehnt.",
  "error.interrupted":
    "Die App wurde während der Übersetzung neu gestartet. Starten Sie sie erneut; fertige Elemente bleiben erhalten.",
  "error.session": "Diese Seite ist abgelaufen. Laden Sie sie aus der Verwaltung Ihrer Wix-Website neu.",
  "error.nothing_to_translate": "Nichts zu übersetzen.",
  "error.file_invalid": "Diese Datei ist keine gültige XLIFF- oder HTML-Übersetzungsdatei.",
  "error.file_missing_metadata": "Diese Datei wurde nicht von der Supertext-App exportiert, oder ihr Kopfbereich wurde entfernt.",
  "error.file_too_large": "Die Datei ist zu groß (höchstens 10 MB).",
  "error.file_other_system": "Diese Datei gehört zu einem anderen System ({plugin}).",
  "error.file_item_gone": "Das Element, aus dem diese Datei exportiert wurde, existiert nicht mehr.",
  "error.file_no_language": "Die Website hat keine Sprache {language}.",
  "error.file_select_one": "Wählen Sie genau ein Element zum Exportieren aus.",
  "error.file_select_language": "Wählen Sie mindestens eine Sprache aus.",
  "error.file_html_one_language": "Eine HTML-Datei enthält genau eine Sprache. Wählen Sie eine Sprache oder XLIFF.",
  "error.file_choose": "Wählen Sie eine Datei aus.",
};
