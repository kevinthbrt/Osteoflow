/**
 * Encart « Importer depuis Doctolib » de Ma journée.
 *
 * Tant que l'extension n'est pas publiée sur le Chrome Web Store, tout ce qui
 * touche à Doctolib est masqué : les utilisateurs ne pourraient pas
 * l'installer. Exception : un poste où l'extension (chargée à la main pour
 * les tests) s'est déjà connectée, ou ouvert une fois avec `?doctolib=1`
 * (`?doctolib=0` masque à nouveau).
 *
 * À la publication : passer DOCTOLIB_EXTENSION_PUBLISHED à true et renseigner
 * DOCTOLIB_EXTENSION_STORE_URL.
 */
export const DOCTOLIB_EXTENSION_PUBLISHED = false
export const DOCTOLIB_EXTENSION_STORE_URL: string | null = null

export const DOCTOLIB_TESTING_KEY = 'myosteoflow_doctolib_extension_testing'
