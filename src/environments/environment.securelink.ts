/**
 * Configuration pour déploiement avec Secure Link.
 * Utilisée avec la config build : production-securelink
 */
export const environment = {
  production: true,
  /** API Secure Link (ex. backend NestJS) */
  apiUrl: 'http://86.106.181.31:3002',
  /** Base URL pour charger les fichiers PDF (ex. API ou MinIO présigné) */
  fileUrl: 'http://86.106.181.31:3002/api/',
  /** Si true, DocsService appelle l’API Secure Link au lieu de Solimus */
  useSecureLink: true,
};
