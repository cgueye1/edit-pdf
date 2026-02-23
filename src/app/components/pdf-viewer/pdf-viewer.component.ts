import {
    Component,
    Input,
    Output,
    EventEmitter,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PDFField } from '../../models/pdf.model';
import * as pdfjsLib from 'pdfjs-dist';
import { DraggableDirective } from '../../directives/draggable.directive';
import { ResizableDirective } from '../../directives/resizable.directive';

@Component({
    selector: 'app-pdf-viewer',
    standalone: true,
    imports: [CommonModule, DraggableDirective, ResizableDirective],
    templateUrl: './pdf-viewer.component.html',
    styleUrls: ['./pdf-viewer.component.scss'],
})
export class PdfViewerComponent implements AfterViewInit, OnChanges {
    @ViewChild('pdfContainer', { static: true }) pdfContainerRef!: ElementRef<HTMLDivElement>;
    @ViewChild('pdfCanvas', { static: false }) pdfCanvasRef!: ElementRef<HTMLCanvasElement>;

    @Input() pdfUrl: string = '';
    @Input() pdfData: ArrayBuffer | null = null;
    @Input() currentPage = 1;
    @Input() fields: PDFField[] = [];
    @Input() scale = 1.5;
    @Input() activeTool: string | null = null;

    @Output() pageClick = new EventEmitter<{ x: number; y: number; page: number }>();
    @Output() fieldAdded = new EventEmitter<PDFField>();
    @Output() fieldUpdated = new EventEmitter<PDFField>();
    @Output() fieldSelected = new EventEmitter<PDFField>();
    @Output() fieldDeleted = new EventEmitter<PDFField>();
    @Output() pageRendered = new EventEmitter<{ page: number; width: number; height: number }>();
    @Output() fieldTextEdit = new EventEmitter<{ field: PDFField; newText: string }>();

    pdfDocument: any = null;
    pageWidth = 0;
    pageHeight = 0;
    selectedField: PDFField | null = null;
    isRendering = false;
    editingField: PDFField | null = null;
    isResizing = false;

    ngAfterViewInit(): void {
        if (this.pdfUrl) this.loadPdf();

        document.addEventListener('keydown', (event: KeyboardEvent) => {
            if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedField && !this.editingField) {
                event.preventDefault();
                this.deleteSelectedField();
            }
            if (event.key === 'Escape' && this.selectedField && !this.editingField) {
                this.selectedField = null;
                this.fieldSelected.emit(null as any);
            }
        });
    }


  // Dans la classe PdfViewerComponent

  zoomLevel: number = 1; // Pour afficher % dans la barre si besoin

// Méthode pour zoom (appelée depuis la barre en bas)
  zoomIn() {
    this.scale = Math.min(this.scale + 0.2, 3);
    this.zoomLevel = Math.round(this.scale * 100);
    this.renderPage(); // Re-rendu pour appliquer le nouveau scale
  }

  zoomOut() {
    this.scale = Math.max(this.scale - 0.2, 0.4);
    this.zoomLevel = Math.round(this.scale * 100);
    this.renderPage();
  }

  fitToScreen() {
    if (!this.pageWidth || !this.pdfContainerRef) return;

    const containerWidth = this.pdfContainerRef.nativeElement.clientWidth - 64; // marges
    const newScale = containerWidth / this.pageWidth;

    this.scale = Math.max(0.5, Math.min(newScale, 1.2)); // limite raisonnable
    this.zoomLevel = Math.round(this.scale * 100);
    this.renderPage();
  }
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['pdfUrl'] && this.pdfUrl) this.loadPdf();
        if ((changes['currentPage'] || changes['scale']) && this.pdfDocument) this.renderPage();

        if (changes['fields'] && this.fields.length > 0) {
            const previousFields = changes['fields'].previousValue || [];
            const newFields = this.fields.filter(
                (f) => !previousFields.some((pf: PDFField) => pf.id === f.id),
            );
            if (newFields.length > 0 && !this.editingField) {
                const newTextField = newFields.find((f) => f.type === 'text' && (!f.value || f.value === ''));
                if (newTextField) this.startEditingField(newTextField);
            }
        }
    }

    async loadPdf(): Promise<void> {
        try {
            console.log('📄 Chargement PDF dans viewer:', this.pdfUrl);
            this.isRendering = true;
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/js/pdf.worker.min.js';
            const loadingTask = pdfjsLib.getDocument(this.pdfUrl);
            this.pdfDocument = await loadingTask.promise;
            console.log('✅ PDF document chargé, pages:', this.pdfDocument.numPages);
            await this.renderPage();
            console.log('✅ Page rendue');
        } catch (error) {
            console.error('❌ Erreur chargement PDF:', error);
        } finally {
            this.isRendering = false;
        }
    }

    async renderPage(): Promise<void> {
        if (!this.pdfDocument || this.isRendering) return;
        try {
            this.isRendering = true;
            const page = await this.pdfDocument.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: this.scale });
            const canvas = this.pdfCanvasRef?.nativeElement;
            if (!canvas) return;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            context.clearRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;

            this.pageWidth = viewport.width;
            this.pageHeight = viewport.height;

            // Détecter les champs de formulaire existants dans le PDF
            await this.detectFormFields(page);

            this.pageRendered.emit({
                page: this.currentPage,
                width: this.pageWidth,
                height: this.pageHeight,
            });
        } catch (error) {
            console.error('Erreur rendu page:', error);
        } finally {
            this.isRendering = false;
        }
    }

    async detectFormFields(page: any): Promise<void> {
        try {
            const annotations = await page.getAnnotations();
            console.log('Champs détectés:', annotations);

            // Émettre les champs détectés pour que le template-editor puisse les utiliser
            // Vous pouvez traiter les annotations ici si nécessaire
        } catch (error) {
            console.error('Erreur détection champs:', error);
        }
    }

    onCanvasClick(event: MouseEvent): void {
        if ((event.target as HTMLElement).closest('.field-container')) return;
        if (this.editingField) return;
        if (!this.activeTool || !this.pdfCanvasRef) return;

        const canvas = this.pdfCanvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();

        const clickX_px = event.clientX - rect.left;
        const clickY_px = event.clientY - rect.top;

        const x_pt = clickX_px / this.scale;
        const y_pt = (this.pageHeight - clickY_px) / this.scale;

        this.pageClick.emit({ x: x_pt, y: y_pt, page: this.currentPage });
    }

    getFieldStyle(field: PDFField): any {
        if (this.isResizing && field === this.selectedField) {
            return {
                zIndex: 300,
                fontSize: field.fontSize ? `${field.fontSize}px` : '14px',
                color: field.color || '#1a202c',
                fontFamily: field.fontFamily || 'Helvetica',
                fontWeight: field.bold ? 'bold' : 'normal',
                fontStyle: field.italic ? 'italic' : 'normal',
                textDecoration: field.underline ? 'underline' : 'none',
                display: 'flex',
                alignItems: 'center',
            };
        }

        const left_px = field.x * this.scale;
        const height_px = field.height * this.scale;
        const width_px = field.width * this.scale;
        const top_px = this.pageHeight - (field.y * this.scale) - height_px;

        // Pour les checkboxes, utiliser les dimensions exactes sans minimum
        const minWidth = field.type === 'checkbox' ? width_px : Math.max(width_px, 50);
        const minHeight = field.type === 'checkbox' ? height_px : Math.max(height_px, 30);

        return {
            position: 'absolute' as const,
            left: `${left_px}px`,
            top: `${top_px}px`,
            width: `${minWidth}px`,
            height: `${minHeight}px`,
            zIndex: field === this.selectedField ? 200 : (field === this.editingField ? 300 : 100),
            fontSize: field.fontSize ? `${field.fontSize}px` : '14px',
            color: field.color || '#1a202c',
            fontFamily: field.fontFamily || 'Helvetica',
            fontWeight: field.bold ? 'bold' : 'normal',
            fontStyle: field.italic ? 'italic' : 'normal',
            textDecoration: field.underline ? 'underline' : 'none',
            display: 'flex',
            alignItems: 'center',
        };
    }

    onFieldDragStart(field: PDFField, dragData: any): void {
        if (this.editingField?.id === field.id) this.finishEditing(field);
        this.selectedField = field;
        this.fieldSelected.emit(field);
    }

    onFieldDragging(event: { x: number; y: number }): void {
        // La directive gère le visuel en temps réel
    }

    onFieldDragEnd(event: { x: number; y: number; data: any }): void {
        if (!event.data) return;
        const field = event.data as PDFField;

        const existingField = this.fields.find(f => f.id === field.id);
        if (!existingField) {
            console.warn('Champ non trouvé lors du drag:', field.id);
            return;
        }

        const defaultSize = existingField.type === 'checkbox' ? 10 : 30;
        const fieldHeight = existingField.height || defaultSize;
        const fieldWidth = existingField.width || defaultSize;

        const pdfX = parseFloat((event.x / this.scale).toFixed(2));
        const pdfY = parseFloat(((this.pageHeight - event.y - fieldHeight * this.scale) / this.scale).toFixed(2));

        const updatedField: PDFField = {
            ...existingField,
            x: pdfX,
            y: pdfY,
            width: fieldWidth,
            height: fieldHeight,
        };

        this.fieldUpdated.emit(updatedField);
    }

    onFieldResizeStart(field: PDFField): void {
        this.selectedField = field;
        this.isResizing = true;
    }

    onFieldResizing(event: { width: number; height: number; x: number; y: number }): void {
        // La directive gère le visuel en temps réel
    }

    onFieldResizeEnd(event: { width: number; height: number; x: number; y: number; data: any }): void {
        this.isResizing = false;
        if (!event.data) return;
        const field = event.data as PDFField;

        const existingField = this.fields.find(f => f.id === field.id);
        if (!existingField) {
            console.warn('Champ non trouvé lors du resize:', field.id);
            return;
        }

        const pdfX = parseFloat((event.x / this.scale).toFixed(2));
        const pdfWidth = parseFloat((event.width / this.scale).toFixed(2));
        const pdfHeight = parseFloat((event.height / this.scale).toFixed(2));
        const pdfY = parseFloat(((this.pageHeight - event.y - event.height) / this.scale).toFixed(2));

        const updatedField: PDFField = {
            ...existingField,
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
        };

        this.fieldUpdated.emit(updatedField);
    }

    getFieldsForCurrentPage(): PDFField[] {
        return this.fields.filter((f) => f.page === this.currentPage - 1);
    }

    onFieldContainerClick(field: PDFField, event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (target.closest('.checkbox-field')) {
            return;
        }
        this.onFieldSelected(field, event);
    }

    onFieldSelected(field: PDFField, event?: MouseEvent): void {
        if (event) event.stopPropagation();

        const existingField = this.fields.find(f => f.id === field.id);
        if (!existingField) {
            console.warn('Champ non trouvé lors de la sélection:', field.id);
            return;
        }

        this.selectedField = existingField;
        this.fieldSelected.emit(existingField);

        if (existingField.type === 'text' || existingField.type === 'input' || existingField.type === 'textarea' || existingField.type === 'date') {
            this.startEditingField(existingField);
        } else if (existingField.type === 'checkbox') {
            let newValue: boolean | string;
            if (existingField.value === true) newValue = 'cross';
            else if (existingField.value === 'cross') newValue = false;
            else newValue = true;

            const updatedField: PDFField = {
                ...existingField,
                value: newValue,
            };

            this.fieldUpdated.emit(updatedField);
        }
    }

    startEditingField(field: PDFField): void {
        if (field.type !== 'text' && field.type !== 'input' && field.type !== 'textarea' && field.type !== 'date') return;

        this.editingField = field;
        this.selectedField = field;
        this.fieldSelected.emit(field);

        const tryFocus = (attempts = 0) => {
            if (attempts > 10) return;
            const id =
                field.type === 'textarea' ? `textarea-edit-${field.id}` :
                    field.type === 'input' ? `input-edit-${field.id}` :
                        field.type === 'date' ? `date-edit-${field.id}` :
                            `text-edit-${field.id}`;
            const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
            if (input) {
                input.focus();
                if (field.type !== 'date') {
                    const len = input.value.length;
                    input.setSelectionRange(len, len);
                }
                return;
            }
            setTimeout(() => tryFocus(attempts + 1), 10 * (attempts + 1));
        };

        requestAnimationFrame(() => requestAnimationFrame(() => tryFocus()));
    }

    onTextInput(field: PDFField, newText: string): void {
        const input = document.getElementById(`text-edit-${field.id}`) as HTMLInputElement;
        if (input) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                context.font = `${field.fontSize || 14}px Helvetica`;
                const w = Math.max(150, context.measureText(newText || 'W').width + 40);
                input.style.width = `${Math.min(w, 600)}px`;
            }
        }
    }

    onTextEditBlur(field: PDFField, newText: string): void {
        if (newText !== field.value) this.fieldTextEdit.emit({ field, newText });
        this.editingField = null;
    }

    onTextEditKeydown(field: PDFField, event: KeyboardEvent, newText: string): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            (document.getElementById(`text-edit-${field.id}`) as HTMLInputElement)?.blur();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.editingField = null;
            const input = document.getElementById(`text-edit-${field.id}`) as HTMLInputElement;
            if (input) { input.value = (field.value as string) || ''; input.blur(); }
        }
    }

    onInputEditBlur(field: PDFField, newValue: string): void {
        if (newValue !== field.value) this.fieldUpdated.emit({ ...field, value: newValue });
        this.editingField = null;
    }

    onInputValueChange(field: PDFField, newValue: string): void {
        field.value = newValue;
    }

    onInputEditKeydown(field: PDFField, event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            (document.getElementById(`input-edit-${field.id}`) as HTMLInputElement)?.blur();
        }
    }

    onTextareaEditBlur(field: PDFField, newValue: string): void {
        if (newValue !== field.value) this.fieldUpdated.emit({ ...field, value: newValue });
        this.editingField = null;
    }

    onTextareaValueChange(field: PDFField, newValue: string): void {
        field.value = newValue;
    }

    onTextareaEditKeydown(field: PDFField, event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            (document.getElementById(`textarea-edit-${field.id}`) as HTMLTextAreaElement)?.blur();
        }
    }

    // Gestion des champs date
    onDateEditBlur(field: PDFField, newValue: string): void {
        if (newValue !== field.value) {
            // Convertir la date au format YYYY-MM-DD en format français DD/MM/YYYY
            let dateStr = newValue;
            if (newValue) {
                const date = new Date(newValue);
                if (!isNaN(date.getTime())) {
                    dateStr = date.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                }
            }
            this.fieldTextEdit.emit({ field, newText: dateStr });
        }
        this.editingField = null;
    }

    onDateEditKeydown(field: PDFField, event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            const input = document.getElementById(`date-edit-${field.id}`) as HTMLInputElement;
            if (input) {
                input.blur();
            }
        }
    }

    onFieldDoubleClick(field: PDFField, event: MouseEvent): void {
        event.stopPropagation();
        this.startEditingField(field);
    }

    onInputDoubleClick(field: PDFField, event: MouseEvent): void {
        event.stopPropagation();
        this.startEditingField(field);
    }

    deleteSelectedField(): void {
        if (this.selectedField) {
            this.fieldDeleted.emit(this.selectedField);
            this.selectedField = null;
        }
    }

    finishEditing(field: PDFField): void {
        if (!this.editingField || this.editingField.id !== field.id) return;

        const id =
            field.type === 'textarea' ? `textarea-edit-${field.id}` :
                field.type === 'input' ? `input-edit-${field.id}` :
                    `text-edit-${field.id}`;

        const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
        if (input) {
            const currentValue = input.value;
            input.blur();
            if (currentValue !== field.value) {
                if (field.type === 'text') {
                    this.fieldTextEdit.emit({ field, newText: currentValue });
                } else {
                    this.fieldUpdated.emit({ ...field, value: currentValue });
                }
            }
        }
        this.editingField = null;
    }
}
