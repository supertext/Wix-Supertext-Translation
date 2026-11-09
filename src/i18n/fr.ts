import type { Messages } from "./en.js";

// French (formal "vous"), with the terms of Wix's French dashboard (site, langue principale,
// Gestionnaire de traduction). A no-break space ( ) goes before ? ! : ;
export const fr: Messages = {
  "nav.translate": "Traduire",
  "nav.settings": "Paramètres",

  "apiKeyHelp.text":
    "Pas encore de compte Supertext ? {signup}. Générez votre clé API sur {apiKey} (rôle Admin requis).",
  "apiKeyHelp.signup": "Créez-en un sur supertext.com",
  "apiKeyHelp.apiKey": "supertext.com → Integrations → API",

  "translate.heading": "Traduire avec Supertext",
  "translate.intro":
    "Traduisez le contenu de votre site dans ses autres langues avec Supertext AI. Les traductions sont enregistrées dans Wix Multilingual, où vous pouvez les vérifier dans le Gestionnaire de traduction.",
  "translate.noKey.heading": "Ajoutez votre clé API Supertext",
  "translate.noKey.text": "L'application a besoin d'une clé API Supertext pour traduire. Saisissez-la sous {settings}.",
  "translate.noKey.settings": "Paramètres",
  "translate.oneLanguage.heading": "Ajoutez une deuxième langue",
  "translate.oneLanguage.text":
    "Votre site n'a qu'une seule langue. Ajoutez des langues avec Wix Multilingual dans le tableau de bord de votre site, puis revenez ici.",
  "translate.noSchemas": "Wix Multilingual n'a pas encore de contenu traduisible sur ce site.",
  "translate.step1": "1. Choisissez le contenu",
  "translate.type": "Type de contenu",
  "translate.otherApps": "Autres",
  "translate.empty": "Rien de ce type pour l'instant.",
  "translate.item": "Élément",
  "translate.selectAll": "Tout sélectionner sur cette page ({count})",
  "translate.firstPage": "Première page",
  "translate.nextPage": "Page suivante",
  "translate.step2": "2. Choisissez les langues",
  "translate.from": "Traduction depuis {language}, la langue principale de votre site.",
  "translate.hidden": "masquée sur le site",
  "translate.noLanguage": "pas encore de langue Supertext : choisissez-en une sous {settings}",
  "translate.noLanguage.settings": "Paramètres → Langues",
  "translate.overwrite": "Remplacer les traductions existantes",
  "translate.overwriteHint": "Sans cette option, les champs déjà traduits sont conservés.",
  "translate.overwriteWarning":
    "Les champs déjà traduits seront remplacés, y compris les modifications faites à la main dans le Gestionnaire de traduction.",
  "translate.submit": "Traduire avec Supertext",
  "translate.submitCount.one": "Traduire {count} élément avec Supertext",
  "translate.submitCount.other": "Traduire {count} éléments avec Supertext",
  "translate.selectSomething": "Sélectionnez au moins un élément et une langue.",
  "translate.starting": "Démarrage…",

  "state.none": "Non traduit",
  "state.partial": "Partiellement traduit",
  "state.done": "Traduit",

  "job.heading": "Traduction",
  "job.running": "Traduction en cours… {completed} sur {total}",
  "job.done": "Terminé : {translated} traduits, {unchanged} inchangés, {failed} en échec.",
  "job.failed": "La traduction s'est arrêtée : {reason}",
  "job.translated.one": "Traduit ({count} champ)",
  "job.translated.other": "Traduit ({count} champs)",
  "job.kept": "{count} conservés",
  "job.tooLong": "{count} trop longs pour Wix, non enregistrés",
  "job.unchanged": "Déjà traduit, inchangé",
  "job.review": "Vérifiez les traductions dans le {manager}.",
  "job.manager": "Gestionnaire de traduction",

  "settings.heading": "Paramètres Supertext",
  "settings.saved": "Paramètres enregistrés.",
  "settings.invalidCodes": "Enregistré, sauf ces codes de langue, que Supertext ne propose pas : {codes}.",
  "settings.apiKey.heading": "Clé API Supertext",
  "settings.apiKey.label": "Clé API",
  "settings.apiKey.placeholder": "Collez votre clé API Supertext",
  "settings.apiKey.placeholderSaved":
    "Une clé est enregistrée (chiffrée). Saisissez-en une nouvelle pour la remplacer.",
  "settings.apiKey.server": "Pas encore de clé propre : l'application utilise la clé définie sur le serveur.",
  "settings.apiKey.remove": "Supprimer la clé enregistrée",
  "settings.test": "Tester la connexion",
  "settings.testing": "Test en cours…",
  "keyCheck.ok": "Clé API vérifiée : la connexion à Supertext fonctionne.",
  "keyCheck.invalid":
    "Supertext a refusé la clé API. Vérifiez que vous avez copié la clé entière ou générez-en une nouvelle sur {apiKey} (rôle Admin requis). Pas encore de compte Supertext ? Créez-en un sur {signup}.",
  "keyCheck.missing":
    "Aucune clé API n'est encore saisie. Pas encore de compte Supertext ? Créez-en un sur {signup}. Générez votre clé API sur {apiKey} (rôle Admin requis).",
  "keyCheck.unreachable":
    "La clé API n'a pas pu être vérifiée, car Supertext n'est pas joignable. Les paramètres sont enregistrés ; réessayez plus tard.",
  "keyCheck.error":
    "La clé API n'a pas pu être vérifiée : Supertext a répondu par une erreur ({status}). Les paramètres sont enregistrés ; réessayez plus tard.",
  "keyCheck.signup": "supertext.com",
  "keyCheck.checkedAt": "Dernière vérification de la clé API : {time}",
  "settings.languages.heading": "Langues",
  "settings.languages.text":
    "La langue Supertext vers laquelle chacune des langues de votre site est traduite (pour la langue principale : à partir de laquelle elle est traduite). Chaque liste présélectionne le choix évident : le même code si Supertext le propose (par exemple de-CH ou es), sinon la valeur par défaut habituelle (allemand → allemand (Allemagne), anglais → anglais (États-Unis), chinois (Taïwan) → chinois (traditionnel)). Modifiez-la là où vous avez besoin d’une autre variante, par exemple allemand (Suisse). Les langues sans choix évident (par exemple anglais (Irlande) ou suisse allemand) sont marquées « Aucune langue Supertext » et ne sont traduites qu’une fois une langue choisie.",
  "settings.languages.main": "langue principale",
  "settings.languages.site": "Langue du site",
  "settings.languages.supertext": "Langue Supertext",
  "settings.languages.choose": "— Non traduite : choisissez une langue Supertext —",
  "settings.languages.missing": "Aucune langue Supertext",
  "settings.languages.review": "Révision des traductions",
  "settings.languages.reviewHelp":
    "Révision des traductions : les traductions vers une langue cochée passent par le service de révision de Supertext, afin que les réviseurs puissent les vérifier et les corriger directement sur le site avec l'extension Supertext Localization Review. Leurs corrections sont reprises lors de la prochaine traduction de l'élément. Les autres langues vont directement à Supertext.",
  "settings.languages.reviewOff": "La révision des traductions est désactivée sur ce serveur (SUPERTEXT_REVIEW_URL est vide).",
  "settings.languages.unmapped":
    "Ces langues n'ont pas encore de langue Supertext et ne sont pas traduites tant que vous n'en choisissez pas une : {languages}.",
  // Translation files (export for translation, import translation)
  "files.export.heading": "Exporter pour traduction",
  "files.export.text": "Téléchargez l’élément coché ci-dessus sous forme de fichier pour un traducteur, un outil de traduction ou l’application web de Supertext, puis importez le fichier traduit ci-dessous.",
  "files.export.selectOne": "Cochez exactement un élément ci-dessus pour l’exporter.",
  "files.format": "Format de fichier",
  "files.format.xliff": "XLIFF 1.2 (pour les outils de traduction)",
  "files.format.html": "HTML (une langue par fichier)",
  "files.languages": "Langues cibles",
  "files.download": "Télécharger le fichier",
  "files.import.heading": "Importer une traduction",
  "files.import.text": "Chargez un fichier exporté ici puis traduit. Ses traductions sont enregistrées dans Wix Multilingual comme celles de Supertext.",
  "files.file": "Fichier traduit (XLIFF ou HTML)",
  "files.includeChanged": "Importer aussi les textes dont la source a changé depuis l’export",
  "files.import.submit": "Importer une traduction",
  "files.importing": "Importation…",
  "files.summary.ok": "Importés : {count}",
  "files.summary.changed": "Ignorés, source modifiée depuis l’export : {count}",
  "files.summary.untranslated": "Non traduits dans le fichier : {count}",
  "files.summary.invalid": "Mise en forme modifiée, non importés : {count}",
  "files.summary.missing": "Absents du fichier : {count}",
  "files.summary.kept": "Conservés, déjà traduits : {count}",
  "files.summary.notWritten": "Non enregistrés, trop longs pour le champ ou autres parties du même texte enrichi non traduites : {count}",
  "settings.style.heading": "Traduction",
  "settings.style.label": "Forme d'adresse",
  "settings.style.default": "Laisser Supertext décider",
  "settings.style.more": "Formelle (p. ex. « vous »)",
  "settings.style.less": "Informelle (p. ex. « tu »)",
  "settings.style.noPoliteness":
    "Le vouvoiement ou le tutoiement n'est pas disponible pour {languages} ; Supertext décide pour ces langues.",
  "settings.publish": "Marquer les traductions comme prêtes à être publiées",
  "settings.publishHint":
    "Désactivé : les traductions attendent dans le Gestionnaire de traduction jusqu'à ce que vous les marquiez comme prêtes à être publiées.",
  "settings.reports.heading": "Informations de version",
  "settings.reports.label": "Envoyer les informations de version à Supertext",
  "settings.reports.help":
    "Envoie à Supertext l'URL du site ainsi que les versions de cette app et de l'environnement d'exécution lorsque vous enregistrez ces paramètres et après une mise à jour. Le support Supertext voit ainsi quelle version vous utilisez. Aucun contenu, aucune clé API et aucune donnée personnelle ne sont transmis.",
  "settings.reports.forcedOff":
    "Désactivé pour tous les sites sur le serveur de l'app (SUPERTEXT_VERSION_REPORTS).",
  "settings.reports.forcedOn":
    "Activé pour tous les sites sur le serveur de l'app (SUPERTEXT_VERSION_REPORTS).",
  "settings.save": "Enregistrer",
  "settings.about.heading": "À propos",
  "settings.about.version": "Supertext Translation pour Wix, version {version}",

  "error.missing_api_key":
    "Aucune clé API Supertext n'est configurée. Ajoutez-la sous Paramètres. Pas encore de compte Supertext ? Créez-en un sur https://www.supertext.com/person/en/account/signin. Générez votre clé API sur https://www.supertext.com/en/integrations/api (rôle Admin requis).",
  "error.no_file_id": "Supertext n'a pas renvoyé d'identifiant de fichier.",
  "error.translation_error": "Supertext n'a pas pu traduire le document.",
  "error.quota_exceeded": "Votre limite de traduction Supertext est dépassée.",
  "error.file_deleted": "Le fichier Supertext a été supprimé avant d'avoir pu être téléchargé.",
  "error.timeout": "Délai dépassé en attendant la traduction Supertext.",
  "error.transport_error": "Impossible de joindre Supertext.",
  "error.authentication_failure":
    "L'authentification a échoué. Veuillez vérifier la clé API Supertext. Pas encore de compte Supertext ? Créez-en un sur https://www.supertext.com/person/en/account/signin. Générez votre clé API sur https://www.supertext.com/en/integrations/api (rôle Admin requis).",
  "error.not_found": "La ressource Supertext demandée est introuvable.",
  "error.payload_too_large": "Le contenu est trop volumineux pour être traduit en une fois par Supertext.",
  "error.too_many_requests": "Trop de requêtes envoyées à Supertext. Veuillez réessayer dans un instant.",
  "error.service_unavailable": "Le service Supertext est actuellement indisponible.",
  "error.unexpected_status": "Supertext a répondu avec HTTP {status}.",
  "error.invalid_language_pair":
    "Supertext ne traduit pas de « {source} » vers « {target} ». Choisissez une autre langue Supertext pour cette langue sous Paramètres → Langues.",
  "error.invalid_language_pair_unknown":
    "Supertext ne traduit pas vers cette langue. Choisissez une autre langue Supertext pour cette langue sous Paramètres → Langues.",
  "error.unsupported_language":
    "« {language} » n'a pas encore de langue Supertext ; rien n'a donc été envoyé. Choisissez sa langue Supertext sous Paramètres → Langues.",
  "error.unsupported_feature":
    "Supertext ne propose pas le vouvoiement ou le tutoiement pour « {target} ». Choisissez « Laisser Supertext décider » sous Paramètres → Traduction.",
  "error.incomplete_response": "La traduction Supertext est revenue incomplète\u00a0; rien n'a été enregistré pour cet élément.",
  "error.sourceMissing": "Le texte original de cet élément est introuvable.",
  "error.schemaMissing": "Ce type de contenu n'existe plus sur le site.",
  "error.multilingualMissing":
    "Wix Multilingual n'est pas configuré sur ce site. Ajoutez d'abord l'application Wix Multilingual et une deuxième langue.",
  "error.wixAuth":
    "Wix a refusé la requête. Réinstallez l'application pour lui accorder les autorisations nécessaires.",
  "error.wixNotConfigured": "Il manque à l'application ses identifiants Wix (WIX_APP_ID, WIX_APP_SECRET).",
  "error.wixUnreachable": "Impossible de joindre Wix : {reason}",
  "error.wixUnavailable": "Wix est actuellement indisponible. Veuillez réessayer dans un instant.",
  "error.wixHttp": "Wix a répondu avec HTTP {status}.",
  "error.wixRejected": "Wix a refusé la traduction.",
  "error.interrupted":
    "L'application a redémarré pendant la traduction. Relancez-la ; les éléments terminés sont conservés.",
  "error.session": "Cette page a expiré. Rechargez-la depuis le tableau de bord Wix.",
  "error.nothing_to_translate": "Rien à traduire.",
  "error.file_invalid": "Ce fichier n’est pas un fichier de traduction XLIFF ou HTML valide.",
  "error.file_missing_metadata": "Ce fichier n’a pas été exporté par l’app Supertext, ou son en-tête a été supprimé.",
  "error.file_too_large": "Le fichier est trop volumineux (10 Mo au maximum).",
  "error.file_other_system": "Ce fichier appartient à un autre système ({plugin}).",
  "error.file_item_gone": "L’élément à partir duquel ce fichier a été exporté n’existe plus.",
  "error.file_no_language": "Le site n’a pas de langue {language}.",
  "error.file_select_one": "Sélectionnez exactement un élément à exporter.",
  "error.file_select_language": "Sélectionnez au moins une langue.",
  "error.file_html_one_language": "Un fichier HTML contient exactement une langue. Choisissez une langue, ou XLIFF.",
  "error.file_choose": "Choisissez un fichier.",
};
