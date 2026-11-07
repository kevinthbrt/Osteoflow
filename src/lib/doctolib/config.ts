/**
 * Encart « Importer depuis Doctolib » de Ma journée.
 *
 * Tant que l'extension n'est pas publiée sur le Chrome Web Store, tout ce qui
 * touche à Doctolib est masqué : les utilisateurs ne pourraient pas
 * l'installer. Exception : un poste où l'extension (chargée à la main pour
 * les tests) s'est déjà connectée, ou ouvert une fois avec `?doctolib=1`
 * (`?doctolib=0` masque à nouveau).
 *
 * À la publication, pas besoin de nouvelle version : il suffit de remplir
 * `public/myosteoflow/doctolib-extension.json` sur le site OsteoUpgrade
 * (`published: true` et `storeUrl`), lu par lib/doctolib/availability.ts.
 * Les deux constantes ci-dessous peuvent ensuite être fixées en dur lors
 * d'une version suivante.
 */
export const DOCTOLIB_EXTENSION_PUBLISHED = true
export const DOCTOLIB_EXTENSION_STORE_URL: string | null =
  'https://chromewebstore.google.com/detail/hjichcleckodofpdmoogcdjglalpcmad'

export const DOCTOLIB_TESTING_KEY = 'myosteoflow_doctolib_extension_testing'
