/**
 * Configuration pour déploiement avec Secure Link.
 * Front : https://secure.innovimpactdev.cloud/ — API : https://api.secure.innovimpactdev.cloud/
 * Utilisée avec la config build : production-securelink
 */
export const environment = {
  production: true,
  /** API Secure Link (HTTPS) */
  apiUrl: 'https://api.secure.innovimpactdev.cloud',
  /** Base URL pour charger les fichiers PDF (API ou MinIO présigné) */
  fileUrl: 'https://api.secure.innovimpactdev.cloud/api/',
  /** Si true, DocsService appelle l’API Secure Link au lieu de Solimus */
  useSecureLink: true,
  /**
   * URL publique absolue de l’éditeur PDF (sans slash final).
   * Sert au QR « signature mobile » : doit être la même que sur le navigateur (ex. /pdf/ derrière nginx).
   */
  pdfPublicBaseUrl: 'https://secure.innovimpactdev.cloud/pdf',
  /**
   * Schéma pour ouvrir l’app mobile (Race / Secure Link) si installée.
   * Ex. innovimpact://secure-pdf/signature — doit correspondre à l’enregistrement natif de l’app.
   * Chaîne vide = pas de tentative d’ouverture d’app, uniquement la page web.
   */
  mobileSignatureDeepLink: 'secureforms://sign',
};
