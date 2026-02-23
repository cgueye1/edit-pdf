import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../../services/template.service';
import { PdfService } from '../../../services/pdf.service';
import { FormTemplate, TemplateField } from '../../../models/template.model';
import { PDFField, PDFDocumentState } from '../../../models/pdf.model';
import { PdfViewerComponent } from '../../pdf-viewer/pdf-viewer.component';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PdfViewerComponent],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./template-editor.component.css'],
})
export class TemplateEditorComponent implements OnInit {
  template: FormTemplate | null = null;
  isNewTemplate = false;
  pdfUrl: string = '';
  pdfFile: File | null = null;
  totalPages = 0;
  currentPage = 1;
  activeTool: string | null = null;
  selectedField: TemplateField | null = null;
  showFieldProperties = false;
  showValidationPanel = false;
  typewriterMode = true;
  showToolbar = true; // Afficher la toolbar dès le démarrage // Mode machine à écrire activé par défaut (comme files-editor.com)
  // Par défaut, on peut cliquer et taper directement - c'est le comportement principal

  // Propriétés du template
  templateName = '';
  templateDescription = '';
  templateCategory = '';

  zoomLevel: number = 100;
  scale: number = 1.5;

  zoomIn(): void {
    this.scale = Math.min(this.scale + 0.2, 3);
    this.zoomLevel = Math.round(this.scale * 100);
  }

  zoomOut(): void {
    this.scale = Math.max(this.scale - 0.2, 0.5);
    this.zoomLevel = Math.round(this.scale * 100);
  }

  fitToScreen(): void {
    this.scale = 1.0;
    this.zoomLevel = 100;
  }

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private templateService: TemplateService,
    private pdfService: PdfService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const templateId = this.route.snapshot.paramMap.get('id');
    const queryParams = this.route.snapshot.queryParams;

    // Initialiser le niveau de zoom
    this.zoomLevel = Math.round(this.scale * 100);

    // Mode machine à écrire activé par défaut (comme files-editor.com)
    // L'utilisateur peut cliquer directement sur le PDF pour taper du texte
    this.activeTool = 'text';

    if (templateId === 'new') {
      // Nouveau template
      this.isNewTemplate = true;
      this.templateName = queryParams['name'] || 'Nouveau Template';
      this.templateDescription = queryParams['description'] || '';
      this.templateCategory = queryParams['category'] || '';
      this.initializeNewTemplate();
    } else if (templateId) {
      // Charger un template existant
      this.template = this.templateService.getTemplateById(templateId);
      if (this.template) {
        this.templateName = this.template.name;
        this.templateDescription = this.template.description || '';
        this.templateCategory = this.template.category || '';
        this.loadTemplate();
      } else {
        alert('Template non trouvé');
        this.router.navigate(['/admin']);
      }
    }
  }

  initializeNewTemplate(): void {
    // Créer un PDF vierge
    this.createBlankPdf();
  }

  async createBlankPdf(): Promise<void> {
    try {
      await this.pdfService.createBlankPdf(595, 842);
      const pdfBytes = await this.pdfService.getPdfBytes();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      this.pdfUrl = URL.createObjectURL(blob);
      this.totalPages = 1;
    } catch (error) {
      console.error('Erreur lors de la création du PDF:', error);
    }
  }

  async loadTemplate(): Promise<void> {
    if (!this.template) return;

    try {
      if (this.template.basePdf) {
        await this.pdfService.loadPdf(this.template.basePdf);
        const pdfBytes = await this.pdfService.getPdfBytes();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        this.pdfUrl = URL.createObjectURL(blob);
      } else {
        await this.createBlankPdf();
      }

      // Redessiner tous les champs du template
      await this.redrawAllFields();
    } catch (error) {
      console.error('Erreur lors du chargement du template:', error);
    }
  }

  async redrawAllFields(): Promise<void> {
    if (!this.template) return;

    // Recharger le PDF de base
    if (this.template.basePdf) {
      await this.pdfService.loadPdf(this.template.basePdf);
    } else {
      await this.pdfService.createBlankPdf(595, 842);
    }

    // Redessiner tous les champs
    for (const field of this.template.fields) {
      await this.drawField(field);
    }

    // Mettre à jour l'affichage
    const pdfBytes = await this.pdfService.getPdfBytes();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
    this.pdfUrl = URL.createObjectURL(blob);
  }

  async drawField(field: TemplateField): Promise<void> {
    switch (field.type) {
      case 'text':
        await this.pdfService.addTextField(
          field.value as string || '',
          field.x,
          field.y,
          field.page,
          { fontSize: field.fontSize || 12, color: field.color || '#000000' }
        );
        break;
      case 'checkbox':
        await this.pdfService.addCheckbox(
          field.value as boolean || false,
          field.x,
          field.y,
          field.page
        );
        break;
      case 'input':
        await this.pdfService.addInputField(
          field.x,
          field.y,
          field.page,
          field.width,
          field.height,
          field.label,
          field.placeholder,
          { fontSize: field.fontSize || 12, color: field.color || '#000000' }
        );
        break;
      case 'textarea':
        await this.pdfService.addTextareaField(
          field.x,
          field.y,
          field.page,
          field.width,
          field.height,
          field.label,
          field.placeholder,
          { fontSize: field.fontSize || 12, color: field.color || '#000000' }
        );
        break;
      case 'image':
        if (field.value) {
          await this.pdfService.addImage(
            field.value as string,
            field.x,
            field.y,
            field.page,
            field.width,
            field.height
          );
        }
        break;
      case 'signature':
        if (field.value) {
          await this.pdfService.addSignature(
            field.value as string,
            field.x,
            field.y,
            field.page,
            field.width,
            field.height
          );
        }
        break;
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.pdfFile = input.files[0];
    this.loadPdf();
  }

  async loadPdf(): Promise<void> {
    if (!this.pdfFile) return;

    try {
      const arrayBuffer = await this.pdfFile.arrayBuffer();
      await this.pdfService.loadPdf(arrayBuffer);
      this.pdfUrl = URL.createObjectURL(this.pdfFile);
      this.totalPages = await this.pdfService.getPageCount();
      this.showToolbar = true; // Afficher la toolbar une fois le PDF chargé
    } catch (error) {
      console.error('Erreur lors du chargement du PDF:', error);
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  onToolSelected(tool: string): void {
    this.activeTool = tool;
    // Si on sélectionne un outil autre que select, désélectionner le champ
    if (tool !== 'select' && this.selectedField) {
      this.selectedField = null;
      this.showFieldProperties = false;
    }
  }

  // Gérer les touches du clavier pour supprimer les champs et raccourcis
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Ignorer si on est dans un input/textarea
    if (this.isInputFocused()) {
      return;
    }

    // Raccourcis clavier
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.activeTool = 'select';
    } else if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      this.activeTool = 'text';
    }

    // Supprimer avec Delete ou Backspace
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedField) {
      event.preventDefault();
      this.onFieldDeleted(this.selectedField.id);
    }
  }

  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
  }

  closePropertiesPanel(): void {
    this.selectedField = null;
    this.showFieldProperties = false;
  }

  getToolName(tool: string): string {
    const names: Record<string, string> = {
      'text': 'texte',
      'input': 'champ texte',
      'textarea': 'zone de texte',
      'checkbox': 'case à cocher',
      'image': 'image',
      'signature': 'signature',
    };
    return names[tool] || tool;
  }

  onModeToggle(): void {
    if (this.typewriterMode) {
      // Mode machine à écrire : outil texte toujours actif
      this.activeTool = 'text';
      this.selectedField = null;
      this.showFieldProperties = false;
    }
  }

  async onPageClick(event: { x: number; y: number; page: number }): Promise<void> {
    // En mode machine à écrire, toujours créer un champ texte
    if (this.typewriterMode) {
      await this.createTextFieldAtPosition(event.x, event.y, event.page - 1);
      return;
    }
    
    // Si aucun outil n'est sélectionné mais qu'on clique, créer un champ texte quand même
    if (!this.activeTool) {
      await this.createTextFieldAtPosition(event.x, event.y, event.page - 1);
      return;
    }

    // Si aucun outil n'est sélectionné, utiliser le mode texte par défaut
    if (!this.activeTool) {
      this.activeTool = 'text';
    }

    // Si on est en mode select, ne pas créer de nouveau champ
    if (this.activeTool === 'select') {
      // Désélectionner le champ actuel
      this.selectedField = null;
      this.showFieldProperties = false;
      return;
    }

    if (!this.template) {
      // Créer le template si c'est un nouveau
      this.template = {
        id: this.generateId(),
        name: this.templateName,
        description: this.templateDescription,
        category: this.templateCategory,
        fields: [],
        metadata: {
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        settings: {
          allowMultipleSubmissions: true,
          requiresSignature: false,
          autoSave: true,
        },
      };
    }

    try {
      let newField: TemplateField;

      switch (this.activeTool) {
        case 'text':
          const textField = await this.pdfService.addTextField(
            '',
            event.x,
            event.y,
            event.page - 1,
            { fontSize: 12, color: '#000000' }
          );
          newField = this.convertToTemplateField(textField);
          // Mettre le champ en mode édition immédiatement (comme PDFAid)
          setTimeout(() => {
            this.selectedField = newField;
            this.showFieldProperties = true;
            // Le PdfViewerComponent va automatiquement mettre le champ en édition
          }, 100);
          break;

        case 'input':
          // Créer un input directement sans prompt (comme PDFAid)
          const inputField = await this.pdfService.addInputField(
            event.x,
            event.y,
            event.page - 1,
            200,
            20,
            undefined,
            undefined
          );
          newField = this.convertToTemplateField(inputField);
          newField.name = `input_${Date.now()}`;
          newField.displayName = 'Champ texte';
          // Mettre en édition immédiatement
          setTimeout(() => {
            this.selectedField = newField;
            this.showFieldProperties = true;
          }, 100);
          break;

        case 'textarea':
          // Créer un textarea directement sans prompt (comme PDFAid)
          const textareaField = await this.pdfService.addTextareaField(
            event.x,
            event.y,
            event.page - 1,
            300,
            80,
            undefined,
            undefined
          );
          newField = this.convertToTemplateField(textareaField);
          newField.name = `textarea_${Date.now()}`;
          newField.displayName = 'Zone de texte';
          // Mettre en édition immédiatement
          setTimeout(() => {
            this.selectedField = newField;
            this.showFieldProperties = true;
          }, 100);
          break;

        case 'checkbox':
          const checkboxField = await this.pdfService.addCheckbox(
            false,
            event.x,
            event.y,
            event.page - 1
          );
          newField = this.convertToTemplateField(checkboxField);
          newField.name = `checkbox_${Date.now()}`;
          newField.displayName = 'Case à cocher';
          break;

        default:
          return;
      }

      this.template.fields.push(newField);
      this.selectedField = newField;
      this.showFieldProperties = true;
      await this.updateViewerPdf();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du champ:', error);
    }
  }

  convertToTemplateField(field: PDFField): TemplateField {
    return {
      ...field,
      name: `field_${field.id}`,
      displayName: field.label || `Champ ${field.type}`,
      validation: {
        required: field.required || false,
        minLength: field.validation?.minLength,
        maxLength: field.validation?.maxLength,
        min: field.validation?.min,
        max: field.validation?.max,
        pattern: field.validation?.pattern,
      },
      options: this.getDefaultOptionsForFieldType(field.type),
    };
  }

  getDefaultOptionsForFieldType(type: string): any {
    switch (type) {
      case 'date':
        return { dateFormat: 'DD/MM/YYYY' };
      case 'number':
        return { decimals: 0, currency: false };
      default:
        return {};
    }
  }

  onFieldSelected(field: TemplateField | PDFField): void {
    // Convertir PDFField en TemplateField si nécessaire
    if ('name' in field) {
      this.selectedField = field as TemplateField;
    } else {
      // Trouver le champ correspondant dans le template
      if (this.template) {
        const templateField = this.template.fields.find(f => f.id === field.id);
        if (templateField) {
          this.selectedField = templateField;
        }
      }
    }
    this.showFieldProperties = true;
  }

  onFieldUpdated(field: TemplateField): void {
    if (!this.template) return;

    const index = this.template.fields.findIndex(f => f.id === field.id);
    if (index >= 0) {
      // Pour les checkboxes, synchroniser width/height avec fontSize
      if (field.type === 'checkbox' && field.fontSize) {
        field.width = field.fontSize;
        field.height = field.fontSize;
      }
      
      this.template.fields[index] = field;
      
      // Si c'est un champ texte qui se termine par ":" et qu'il n'y a pas d'input à côté, en créer un automatiquement
      if (field.type === 'text' && field.value && typeof field.value === 'string' && field.value.trim().endsWith(':')) {
        this.createInputAfterLabel(field);
      }
      
      this.redrawAllFields();
    }
  }

  onFieldTextEdit(event: { field: PDFField; newText: string }): void {
    if (!this.template) return;

    const index = this.template.fields.findIndex(f => f.id === event.field.id);
    if (index >= 0) {
      // Mise à jour immédiate pour une édition fluide
      this.template.fields[index].value = event.newText;
      
      // Forcer la détection de changement pour une mise à jour visuelle immédiate
      this.cdr.detectChanges();
      
      // Si le texte se termine par ":", créer automatiquement un input après
      if (event.newText.trim().endsWith(':') && this.template) {
        // Utiliser setTimeout pour ne pas bloquer l'édition en cours
        setTimeout(() => {
          if (this.template) {
            this.createInputAfterLabel(this.template.fields[index]);
          }
        }, 100);
      }
      
      // Ne pas redessiner tous les champs à chaque frappe (trop lent, pas fluide)
      // this.redrawAllFields();
    }
  }

  // Créer automatiquement un input après un label (comme PDFAid)
  private async createInputAfterLabel(labelField: TemplateField): Promise<void> {
    if (!this.template) return;

    // Vérifier si un input existe déjà à côté de ce label
    const existingInput = this.template.fields.find(f => 
      f.type === 'input' && 
      f.page === labelField.page &&
      Math.abs(f.x - (labelField.x + labelField.width + 10)) < 50 &&
      Math.abs(f.y - labelField.y) < 30
    );

    if (existingInput) {
      return; // Un input existe déjà
    }

    // Calculer la position de l'input (à côté du label)
    const inputX = labelField.x + labelField.width + 10;
    const inputY = labelField.y;

    try {
      const inputField = await this.pdfService.addInputField(
        inputX,
        inputY,
        labelField.page,
        200,
        20,
        undefined,
        undefined
      );
      
      const newInputField = this.convertToTemplateField(inputField);
      newInputField.name = `input_${Date.now()}`;
      newInputField.displayName = 'Champ de saisie';
      
      this.template.fields.push(newInputField);
      await this.redrawAllFields();
    } catch (error) {
      console.error('Erreur lors de la création automatique de l\'input:', error);
    }
  }

  onFieldMoved(field: PDFField | TemplateField): void {
    if (!this.template) return;

    // Trouver le champ dans le template
    const index = this.template.fields.findIndex(f => f.id === field.id);
    if (index >= 0) {
      // Le PdfViewerComponent a déjà converti les coordonnées de l'écran vers le PDF
      // On utilise directement les coordonnées fournies
      const updatedField: TemplateField = {
        ...this.template.fields[index],
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      };
      
      this.template.fields[index] = updatedField;
      this.selectedField = updatedField;
      
      // Mettre à jour le PDF avec la nouvelle position
      this.redrawAllFields();
    }
  }

  onFieldDeleted(fieldId: string): void {
    if (!this.template) return;

    this.template.fields = this.template.fields.filter(f => f.id !== fieldId);
    if (this.selectedField?.id === fieldId) {
      this.selectedField = null;
      this.showFieldProperties = false;
    }
    this.redrawAllFields();
  }

  async saveTemplate(): Promise<void> {
    if (!this.template) {
      alert('Aucun template à sauvegarder');
      return;
    }

    if (!this.templateName.trim()) {
      alert('Veuillez saisir un nom pour le template');
      return;
    }

    // Mettre à jour les propriétés du template
    this.template.name = this.templateName;
    this.template.description = this.templateDescription;
    this.template.category = this.templateCategory;
    this.template.metadata.updatedAt = new Date();

    // Sauvegarder le PDF de base si disponible
    if (this.pdfFile) {
      const arrayBuffer = await this.pdfFile.arrayBuffer();
      this.template.basePdf = arrayBuffer;
    }

    this.templateService.saveTemplate(this.template);
    alert('Template sauvegardé avec succès !');
    this.router.navigate(['/admin']);
  }

  async updateViewerPdf(): Promise<void> {
    try {
      const pdfBytes = await this.pdfService.getPdfBytes();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
      this.pdfUrl = URL.createObjectURL(blob);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du viewer:', error);
    }
  }

  // Créer un champ texte directement à la position du clic (comme files-editor.com)
  private async createTextFieldAtPosition(x: number, y: number, pageIndex: number): Promise<void> {
    if (!this.template) {
      this.template = {
        id: this.generateId(),
        name: this.templateName,
        description: this.templateDescription,
        category: this.templateCategory,
        fields: [],
        metadata: {
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        settings: {
          allowMultipleSubmissions: true,
          requiresSignature: false,
          autoSave: true,
        },
      };
    }

    // Créer le champ directement - pas de régénération PDF nécessaire
    const newField: TemplateField = {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      x,
      y,
      width: 150, // Largeur initiale petite, s'ajustera avec le texte
      height: 20,
      value: '',
      page: pageIndex,
      fontSize: 12,
      color: '#000000',
      name: `field_${Date.now()}`,
      displayName: 'Texte',
      validation: { required: false },
      options: {},
    };
    
    // Ajouter le champ
    this.template.fields.push(newField);
    
    // Forcer la mise à jour immédiate
    this.cdr.detectChanges();
    
    // Mettre le champ en édition IMMÉDIATEMENT - émettre l'événement pour que le viewer le mette en édition
    // Utiliser plusieurs requestAnimationFrame pour s'assurer que le DOM est complètement prêt
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Essayer de trouver l'input et le mettre en focus
        const input = document.getElementById(`text-edit-${newField.id}`) as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(0, 0);
        } else {
          // Si l'input n'existe pas encore, attendre un peu plus
          setTimeout(() => {
            const inputRetry = document.getElementById(`text-edit-${newField.id}`) as HTMLInputElement;
            if (inputRetry) {
              inputRetry.focus();
              inputRetry.setSelectionRange(0, 0);
            } else {
              // Dernier recours : forcer via le viewer
              const event = new CustomEvent('forceEditField', { 
                detail: { fieldId: newField.id },
                bubbles: true 
              });
              document.dispatchEvent(event);
            }
          }, 50);
        }
      });
    });
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

