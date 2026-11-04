/**
 * Encart « Importer depuis Doctolib » de Ma journée.
 *
 * Tant que l'extension n'est pas publiée sur le Chrome Web Store, l'encart et
 * le code d'appairage sont masqués : les utilisateurs ne pourraient pas
 * l'installer. Pour les tests, ouvrir une fois Ma journée avec `?doctolib=1`
 * l'affiche sur ce poste (`?doctolib=0` le masque à nouveau).
 *
 * À la publication : passer DOCTOLIB_EXTENSION_PUBLISHED à true et renseigner
 * DOCTOLIB_EXTENSION_STORE_URL.
 */
export const DOCTOLIB_EXTENSION_PUBLISHED = false
export const DOCTOLIB_EXTENSION_STORE_URL: string | null = null

export const DOCTOLIB_TESTING_KEY = 'myosteoflow_doctolib_extension_testing'
