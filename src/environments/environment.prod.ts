export const environment = {
  production: true,
  /** API : URL relative pour pdf.secure.innovimpactdev.cloud (proxy nginx /api/ → backend) */
  apiUrl: 'https://api.secure.innovimpactdev.cloud',
  /** Base URL pour charger les PDF (API ou MinIO présigné) */
  fileUrl: 'https://api.secure.innovimpactdev.cloud/api/',
  /** Si true, DocsService appelle l’API Secure Link au lieu de Solimus */
  useSecureLink: true,
  /** Renseigné dans environment.securelink (build production-securelink). Vide = URL du navigateur pour le QR en local. */
  pdfPublicBaseUrl: '',
  mobileSignatureDeepLink: '',
};

