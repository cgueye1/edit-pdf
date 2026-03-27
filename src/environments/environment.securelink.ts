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
  /** Après upload-filled-pdf, enchaîne ensure-certificate + sign PKI */
  pkiAfterUpload: true,
};
