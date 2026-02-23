import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../../services/template.service';
import { PdfService } from '../../../services/pdf.service';
import { FormTemplate, TemplateField, FormSubmission } from '../../../models/template.model';
import { PDFField } from '../../../models/pdf.model';
import saveAs from 'file-saver';

@Component({
  selector: 'app-form-filler',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './form-filler.component.html',
  styleUrls: ['./form-filler.component.css'],
})
export class FormFillerComponent implements OnInit, AfterViewInit {
  template: FormTemplate | null = null;
  fieldValues: Record<string, any> = {};
  validationErrors: Record<string, string> = {};
  pdfUrl: string = '';
  totalPages = 0;
  currentPage = 1;
  isSubmitting = false;
  showPreview = true;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private templateService: TemplateService,
    private pdfService: PdfService
  ) {}

  async ngOnInit(): Promise<void> {
    const templateId = this.route.snapshot.paramMap.get('id');
    if (templateId) {
      this.template = this.templateService.getTemplateById(templateId);
      if (this.template) {
        await this.loadTemplate();
        this.initializeFieldValues();
      } else {
        alert('Formulaire non trouvé');
        this.router.navigate(['/forms']);
      }
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
        await this.pdfService.createBlankPdf(595, 842);
        const pdfBytes = await this.pdfService.getPdfBytes();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        this.pdfUrl = URL.createObjectURL(blob);
      }

      this.totalPages = await this.pdfService.getPageCount();
      await this.renderFormFields();
    } catch (error) {
      console.error('Erreur lors du chargement du template:', error);
    }
  }

  initializeFieldValues(): void {
    if (!this.template) return;

    for (const field of this.template.fields) {
      if (field.defaultValue !== undefined) {
        this.fieldValues[field.id] = field.defaultValue;
      } else {
        // Valeurs par défaut selon le type
        switch (field.type) {
          case 'checkbox':
            this.fieldValues[field.id] = false;
            break;
          case 'number':
            this.fieldValues[field.id] = null;
            break;
          default:
            this.fieldValues[field.id] = '';
        }
      }
    }
  }

  async renderFormFields(): Promise<void> {
    if (!this.template) return;

    // Recharger le PDF de base
    if (this.template.basePdf) {
      await this.pdfService.loadPdf(this.template.basePdf);
    } else {
      await this.pdfService.createBlankPdf(595, 842);
    }

    // Rendre tous les champs avec leurs valeurs
    for (const field of this.template.fields) {
      await this.renderField(field);
    }

    // Mettre à jour l'affichage
    await this.updatePdfViewer();
  }

  async renderField(field: TemplateField): Promise<void> {
    const value = this.fieldValues[field.id];

    try {
      switch (field.type) {
        case 'text':
          if (value) {
            await this.pdfService.addTextField(
              value,
              field.x,
              field.y,
              field.page,
              { fontSize: field.fontSize || 12, color: field.color || '#000000' }
            );
          }
          break;

        case 'checkbox':
          await this.pdfService.addCheckbox(
            value || false,
            field.x,
            field.y,
            field.page
          );
          break;

        case 'input':
        case 'textarea':
          if (value) {
            // Pour les champs input/textarea, on dessine juste le texte
            await this.pdfService.addTextField(
              value,
              field.x,
              field.y,
              field.page,
              { fontSize: field.fontSize || 12, color: field.color || '#000000' }
            );
          }
          break;

        case 'image':
          if (value) {
            await this.pdfService.addImage(
              value,
              field.x,
              field.y,
              field.page,
              field.width,
              field.height
            );
          }
          break;

        case 'signature':
          if (value) {
            await this.pdfService.addSignature(
              value,
              field.x,
              field.y,
              field.page,
              field.width,
              field.height
            );
          }
          break;
      }
    } catch (error) {
      console.error(`Erreur lors du rendu du champ ${field.name}:`, error);
    }
  }

  onFieldChange(fieldId: string, value: any): void {
    this.fieldValues[fieldId] = value;
    
    // Valider le champ
    if (this.template) {
      const field = this.template.fields.find(f => f.id === fieldId);
      if (field) {
        const validation = this.templateService.validateField(field, value);
        if (!validation.valid && validation.error) {
          this.validationErrors[fieldId] = validation.error;
        } else {
          delete this.validationErrors[fieldId];
        }
      }
    }

    // Mettre à jour le PDF en temps réel si auto-save est activé
    if (this.template?.settings.autoSave) {
      this.renderFormFields();
    }
  }

  validateForm(): boolean {
    if (!this.template) return false;

    const validation = this.templateService.validateForm(this.template, this.fieldValues);
    this.validationErrors = validation.errors;
    return validation.valid;
  }

  async submitForm(): Promise<void> {
    if (!this.template) return;

    if (!this.validateForm()) {
      alert('Veuillez corriger les erreurs avant de soumettre');
      return;
    }

    this.isSubmitting = true;

    try {
      // Générer le PDF final
      await this.renderFormFields();
      const pdfBytes = await this.pdfService.getPdfBytes();

      // Créer la soumission
      const submission: FormSubmission = {
        id: this.generateId(),
        templateId: this.template.id,
        templateName: this.template.name,
        submittedAt: new Date(),
        fields: this.template.fields.map(field => ({
          fieldId: field.id,
          fieldName: field.name,
          value: this.fieldValues[field.id],
        })),
        pdfFile: pdfBytes.buffer,
        status: 'submitted',
      };

      // Sauvegarder la soumission
      this.templateService.saveSubmission(submission);

      // Télécharger le PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, `${this.template.name}_${Date.now()}.pdf`);

      alert('Formulaire soumis avec succès !');
      this.router.navigate(['/forms']);
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      alert('Erreur lors de la soumission du formulaire');
    } finally {
      this.isSubmitting = false;
    }
  }

  async saveDraft(): Promise<void> {
    if (!this.template) return;

    try {
      await this.renderFormFields();
      const pdfBytes = await this.pdfService.getPdfBytes();

      const submission: FormSubmission = {
        id: this.generateId(),
        templateId: this.template.id,
        templateName: this.template.name,
        submittedAt: new Date(),
        fields: this.template.fields.map(field => ({
          fieldId: field.id,
          fieldName: field.name,
          value: this.fieldValues[field.id],
        })),
        pdfFile: pdfBytes.buffer,
        status: 'draft',
      };

      this.templateService.saveSubmission(submission);
      alert('Brouillon sauvegardé !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du brouillon');
    }
  }

  async updatePdfViewer(): Promise<void> {
    try {
      const pdfBytes = await this.pdfService.getPdfBytes();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
      this.pdfUrl = URL.createObjectURL(blob);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du viewer:', error);
    }
  }

  async downloadPdf(): Promise<void> {
    if (!this.template) return;

    try {
      await this.renderFormFields();
      const pdfBytes = await this.pdfService.getPdfBytes();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, `${this.template.name}_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement du PDF');
    }
  }

  getFieldError(fieldId: string): string | undefined {
    return this.validationErrors[fieldId];
  }

  hasError(fieldId: string): boolean {
    return !!this.validationErrors[fieldId];
  }

  getFieldsForPage(page: number): TemplateField[] {
    if (!this.template) return [];
    return this.template.fields.filter(f => f.page === page - 1);
  }

  onImageUpload(event: Event, fieldId: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const imageDataUrl = e.target?.result as string;
      if (imageDataUrl) {
        this.onFieldChange(fieldId, imageDataUrl);
        this.renderFormFields();
      }
    };

    reader.readAsDataURL(file);
  }

  clearSignature(fieldId: string): void {
    const canvas = document.getElementById(`signature-${fieldId}`) as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    this.fieldValues[fieldId] = '';
    this.onFieldChange(fieldId, '');
  }

  saveSignature(fieldId: string): void {
    const canvas = document.getElementById(`signature-${fieldId}`) as HTMLCanvasElement;
    if (canvas) {
      const signatureDataUrl = canvas.toDataURL('image/png');
      this.onFieldChange(fieldId, signatureDataUrl);
      this.renderFormFields();
    }
  }

  ngAfterViewInit(): void {
    // Initialiser les canvas de signature après le rendu
    if (this.template) {
      setTimeout(() => {
        this.initializeSignatureCanvases();
      }, 100);
    }
  }

  private initializeSignatureCanvases(): void {
    if (!this.template) return;

    for (const field of this.template.fields) {
      if (field.type === 'signature') {
        const canvas = document.getElementById(`signature-${field.id}`) as HTMLCanvasElement;
        if (canvas) {
          canvas.width = field.width || 300;
          canvas.height = field.height || 100;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            
            let isDrawing = false;
            let lastX = 0;
            let lastY = 0;

            canvas.addEventListener('mousedown', (e) => {
              isDrawing = true;
              const rect = canvas.getBoundingClientRect();
              lastX = e.clientX - rect.left;
              lastY = e.clientY - rect.top;
            });

            canvas.addEventListener('mousemove', (e) => {
              if (!isDrawing) return;
              const rect = canvas.getBoundingClientRect();
              const currentX = e.clientX - rect.left;
              const currentY = e.clientY - rect.top;

              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(currentX, currentY);
              ctx.stroke();

              lastX = currentX;
              lastY = currentY;
            });

            canvas.addEventListener('mouseup', () => {
              isDrawing = false;
            });

            canvas.addEventListener('mouseleave', () => {
              isDrawing = false;
            });
          }
        }
      }
    }
  }

  private generateId(): string {
    return `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

