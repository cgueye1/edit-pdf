import { PDFField } from './pdf.model';

/**
 * Template de formulaire - Structure complète d'un formulaire réutilisable
 */
export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string; // Ex: 'Bancaire', 'RH', 'Administratif', etc.
  thumbnail?: string; // URL ou base64 de l'aperçu
  basePdf?: ArrayBuffer; // PDF de base (optionnel, peut être vierge)
  fields: TemplateField[]; // Champs du formulaire
  metadata: {
    author?: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
  };
  settings: {
    allowMultipleSubmissions?: boolean;
    requiresSignature?: boolean;
    autoSave?: boolean;
  };
}

/**
 * Champ de template avec toutes ses propriétés et validations
 */
export interface TemplateField extends PDFField {
  // Propriétés de base (héritées de PDFField)
  // id, type, x, y, width, height, page, etc.

  // Propriétés spécifiques au template
  name: string; // Nom unique du champ (pour référence)
  displayName?: string; // Nom affiché à l'utilisateur
  description?: string; // Description/aide pour l'utilisateur
  defaultValue?: string | boolean | number; // Valeur par défaut
  
  // Validation avancée
  validation: FieldValidation;
  
  // Options spécifiques selon le type
  options?: {
    // Pour les select/dropdown
    choices?: Array<{ label: string; value: string }>;
    
    // Pour les dates
    dateFormat?: string; // 'DD/MM/YYYY', 'MM/DD/YYYY', etc.
    minDate?: Date;
    maxDate?: Date;
    
    // Pour les nombres
    decimals?: number; // Nombre de décimales
    currency?: boolean; // Format monétaire
    
    // Pour les textes
    multiline?: boolean;
    maxLines?: number;
    
    // Pour les images
    allowedFormats?: string[]; // ['png', 'jpg', 'pdf']
    maxFileSize?: number; // En bytes
    
    // Pour les signatures
    requiredSignature?: boolean;
  };
  
  // Style et apparence
  style?: {
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    borderRadius?: number;
  };
  
  // Conditions d'affichage (champs conditionnels)
  conditionalDisplay?: {
    dependsOn?: string; // ID du champ dont dépend ce champ
    condition?: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
    value?: any; // Valeur de comparaison
  };
}

/**
 * Règles de validation complètes
 */
export interface FieldValidation {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // Regex
  customValidator?: string; // Nom de la fonction de validation personnalisée
  errorMessage?: string; // Message d'erreur personnalisé
}

/**
 * Instance de formulaire rempli (soumission)
 */
export interface FormSubmission {
  id: string;
  templateId: string;
  templateName: string;
  submittedAt: Date;
  submittedBy?: string;
  fields: Array<{
    fieldId: string;
    fieldName: string;
    value: any;
  }>;
  pdfFile?: ArrayBuffer; // PDF généré avec les données
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  metadata?: Record<string, any>;
}

/**
 * Catégorie de template
 */
export interface TemplateCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
}

















