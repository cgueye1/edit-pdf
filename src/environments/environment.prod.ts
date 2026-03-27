export const environment = {
  production: true,
  /** API : URL relative pour pdf.secure.innovimpactdev.cloud (proxy nginx /api/ → backend) */
  apiUrl: 'https://api.secure.innovimpactdev.cloud',
  /** Base URL pour charger les PDF (API ou MinIO présigné) */
  fileUrl: 'https://api.secure.innovimpactdev.cloud/api/',
  /** Si true, DocsService appelle l’API Secure Link au lieu de Solimus */
  useSecureLink: true,
  /** Après upload-filled-pdf, enchaîne ensure-certificate + sign PKI (si l’API a PKI_ENABLED) */
  pkiAfterUpload: true,
};

