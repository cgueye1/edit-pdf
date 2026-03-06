import { Injectable } from '@angular/core';
import { FormTemplate, TemplateField, FormSubmission, TemplateCategory } from '../models/template.model';
import { PDFDocumentState } from '../models/pdf.model';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly TEMPLATES_KEY = 'pdf_form_templates';
  private readonly SUBMISSIONS_KEY = 'pdf_form_submissions';
  private readonly CATEGORIES_KEY = 'pdf_form_categories';

  /**
   * Sauvegarder un template
   */
  saveTemplate(template: FormTemplate): void {
    const templates = this.getAllTemplates();
    const index = templates.findIndex(t => t.id === template.id);
    
    template.metadata.updatedAt = new Date();
    
    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }
    
    localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(templates));
  }

  /**
   * Récupérer tous les templates
   */
  getAllTemplates(): FormTemplate[] {
    const data = localStorage.getItem(this.TEMPLATES_KEY);
    if (!data) return [];
    
    const templates = JSON.parse(data) as FormTemplate[];
    // Convertir les dates
    return templates.map(t => ({
      ...t,
      metadata: {
        ...t.metadata,
        createdAt: new Date(t.metadata.createdAt),
        updatedAt: new Date(t.metadata.updatedAt),
      }
    }));
  }

  /**
   * Récupérer un template par ID
   */
  getTemplateById(id: string): FormTemplate | null {
    const templates = this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Supprimer un template
   */
  deleteTemplate(id: string): boolean {
    const templates = this.getAllTemplates();
    const filtered = templates.filter(t => t.id !== id);
    
    if (filtered.length < templates.length) {
      localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(filtered));
      return true;
    }
    return false;
  }

  /**
   * Créer un template à partir d'un document PDF existant
   */
  createTemplateFromDocument(
    document: PDFDocumentState,
    name: string,
    description?: string,
    category?: string
  ): FormTemplate {
    const template: FormTemplate = {
      id: this.generateId(),
      name,
      description,
      category,
      fields: document.fields.map(field => this.convertFieldToTemplateField(field)),
      metadata: {
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      settings: {
        allowMultipleSubmissions: true,
        requiresSignature: document.fields.some(f => f.type === 'signature'),
        autoSave: true,
      },
    };

    this.saveTemplate(template);
    return template;
  }

  /**
   * Convertir un PDFField en TemplateField
   */
  private convertFieldToTemplateField(field: any): TemplateField {
    return {
      ...field,
      name: field.name || `field_${field.id}`,
      displayName: field.label || field.name || `Champ ${field.type}`,
      validation: {
        required: field.required || field.validation?.required || false,
        minLength: field.validation?.minLength,
        maxLength: field.validation?.maxLength,
        min: field.validation?.min,
        max: field.validation?.max,
        pattern: field.validation?.pattern,
        errorMessage: field.validation?.errorMessage,
      },
      options: this.getDefaultOptionsForFieldType(field.type),
    };
  }

  /**
   * Options par défaut selon le type de champ
   */
  private getDefaultOptionsForFieldType(type: string): any {
    switch (type) {
      case 'date':
        return { dateFormat: 'DD/MM/YYYY' };
      case 'number':
        return { decimals: 0, currency: false };
      case 'email':
        return {};
      case 'image':
        return { allowedFormats: ['png', 'jpg', 'jpeg'], maxFileSize: 5 * 1024 * 1024 }; // 5MB
      default:
        return {};
    }
  }

  /**
   * Sauvegarder une soumission de formulaire
   */
  saveSubmission(submission: FormSubmission): void {
    const submissions = this.getAllSubmissions();
    submissions.push(submission);
    localStorage.setItem(this.SUBMISSIONS_KEY, JSON.stringify(submissions));
  }

  /**
   * Récupérer toutes les soumissions
   */
  getAllSubmissions(): FormSubmission[] {
    const data = localStorage.getItem(this.SUBMISSIONS_KEY);
    if (!data) return [];
    
    const submissions = JSON.parse(data) as FormSubmission[];
    return submissions.map(s => ({
      ...s,
      submittedAt: new Date(s.submittedAt),
    }));
  }

  /**
   * Récupérer les soumissions d'un template
   */
  getSubmissionsByTemplate(templateId: string): FormSubmission[] {
    return this.getAllSubmissions().filter(s => s.templateId === templateId);
  }

  /**
   * Valider un champ selon ses règles
   */
  validateField(field: TemplateField, value: any): { valid: boolean; error?: string } {
    const validation = field.validation;

    // Validation required
    if (validation.required) {
      if (value === null || value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        return {
          valid: false,
          error: validation.errorMessage || `${field.displayName || field.name} est obligatoire`,
        };
      }
    }

    // Si la valeur est vide et non requise, c'est valide
    if (!value || value === '') {
      return { valid: true };
    }

    // Validation minLength/maxLength (pour strings)
    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return {
          valid: false,
          error: validation.errorMessage || 
            `${field.displayName || field.name} doit contenir au moins ${validation.minLength} caractères`,
        };
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return {
          valid: false,
          error: validation.errorMessage || 
            `${field.displayName || field.name} ne doit pas dépasser ${validation.maxLength} caractères`,
        };
      }
    }

    // Validation min/max (pour numbers)
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return {
          valid: false,
          error: validation.errorMessage || 
            `${field.displayName || field.name} doit être supérieur ou égal à ${validation.min}`,
        };
      }
      if (validation.max !== undefined && value > validation.max) {
        return {
          valid: false,
          error: validation.errorMessage || 
            `${field.displayName || field.name} doit être inférieur ou égal à ${validation.max}`,
        };
      }
    }

    // Validation pattern (regex)
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return {
          valid: false,
          error: validation.errorMessage || 
            `${field.displayName || field.name} n'est pas au bon format`,
        };
      }
    }

    // Validations spécifiques par type
    if (field.type === 'email' && typeof value === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return {
          valid: false,
          error: validation.errorMessage || 'Format d\'email invalide',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Valider tous les champs d'un formulaire
   */
  validateForm(template: FormTemplate, fieldValues: Record<string, any>): {
    valid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    for (const field of template.fields) {
      const value = fieldValues[field.id] ?? fieldValues[field.name];
      const validation = this.validateField(field, value);
      
      if (!validation.valid && validation.error) {
        errors[field.id] = validation.error;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Gérer les catégories
   */
  getCategories(): TemplateCategory[] {
    const data = localStorage.getItem(this.CATEGORIES_KEY);
    if (!data) {
      // Catégories par défaut
      const defaultCategories: TemplateCategory[] = [
        { id: 'banking', name: 'Bancaire', icon: 'fa-university', color: '#0066cc' },
        { id: 'hr', name: 'Ressources Humaines', icon: 'fa-users', color: '#cc6600' },
        { id: 'admin', name: 'Administratif', icon: 'fa-folder', color: '#666666' },
        { id: 'legal', name: 'Juridique', icon: 'fa-gavel', color: '#990000' },
        { id: 'other', name: 'Autre', icon: 'fa-file', color: '#999999' },
      ];
      localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(defaultCategories));
      return defaultCategories;
    }
    return JSON.parse(data);
  }

  /**
   * Générer un ID unique
   */
  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

















