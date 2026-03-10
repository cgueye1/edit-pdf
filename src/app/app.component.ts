import {
  Component,
  ViewChildren,
  ViewChild,
  QueryList,
  ElementRef,
  OnInit,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { PDFField, PDFDocumentState } from './models/pdf.model';
import { PdfService } from './services/pdf.service';
import { HistoryService } from './services/history.service';
import { StorageService } from './services/storage.service';
import { CommonModule } from '@angular/common';
import { PdfToolbarComponent } from './components/pdf-toolbar/pdf-toolbar.component';
import { FormsModule } from '@angular/forms';
import { PdfViewerComponent } from './components/pdf-viewer/pdf-viewer.component';
import { SignaturePadComponent } from './components/signature-pad/signature-pad.component';
import { SavedDocumentsComponent } from './components/saved-documents/saved-documents.component';
import { FieldPropertiesComponent } from './components/field-properties/field-properties.component';
import { PdfInfoModalComponent } from './components/pdf-info-modal/pdf-info-modal.component';
import { PdfPreviewModalComponent } from './components/pdf-preview-modal/pdf-preview-modal.component';
import { DrawingCanvasComponent } from './components/drawing-canvas/drawing-canvas.component';
import { NotificationContainerComponent } from './components/notification-container/notification-container.component';
import { NotificationService } from './services/notification.service';
import { OtpModalComponent } from './components/otp-modal/otp-modal.component';
import * as pdfjs from 'pdfjs-dist';
import { PagesSidebarComponent } from './components/pages-sidebar/pages-sidebar.component';
import { ActivatedRoute } from '@angular/router';
import AES from 'crypto-js/aes';
import enc from 'crypto-js/enc-utf8';
import { DocsService } from './services/DocsService';
import { environment } from '../environments/environment.prod';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    PdfToolbarComponent,
    PdfViewerComponent,
    SignaturePadComponent,
    SavedDocumentsComponent,
    FieldPropertiesComponent,
    PdfInfoModalComponent,
    PdfPreviewModalComponent,
    NotificationContainerComponent,
    OtpModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
})
export class AppComponent implements OnInit {
  private secretKey = 'innov-impact-secret-key';
  title = 'PDF Form Editor';
  Math = Math;

  @Input() pages: number[] = [];
  @Input() currentPage: number = 1;
  @Input() isOpen: boolean = true;
  @Input() isMobile: boolean = false;

  @Output() pageSelected = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();

  @ViewChildren('thumbCanvas') thumbCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  closeSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  selectPage(page: number) {
    this.currentDocument.currentPage = page;
    this.pageSelected.emit(page);
  }

  currentDocument: PDFDocumentState = {
    id: this.generateId(),
    name: 'Nouveau document',
    fields: [],
    currentPage: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  pdfFile: File | null = null;
  pdfUrl: string = '';
  pdfData: ArrayBuffer | null = null;

  activeTool: string | null = null;
  showSignaturePad = false;
  pendingSignaturePosition: { x: number; y: number; page: number } | null = null;
  showSavedDocuments = false;
  selectedField: PDFField | null = null;
  textProperties = {
    fontSize: 8,
    color: '#000000',
    fontFamily: 'Helvetica',
    backgroundColor: 'transparent',
    textAlign: 'left',
    verticalAlign: 'top',
    bold: false,
    italic: false,
    underline: false,
  };

  drawingOptions: { color: string; lineWidth: number; opacity: number; blendMode?: 'normal' | 'multiply' } = {
    color: '#FFFF00',
    lineWidth: 14,
    opacity: 0.35,
    blendMode: 'multiply',
  };

  totalPages = 0;
  pageDimensions = { width: 0, height: 0 };
  scale = 1.5;
  canUndo = false;
  canRedo = false;

  showThumbnails: boolean = false;
  sidebarCollapsed: boolean = false;
  showProperties: boolean = false;
  private isGeneratingThumbnails: boolean = false;
  showPdfInfoModal = false;
  showPdfPreviewModal = false;
  showOtpModal = false;
  previewPdfUrl: string = '';
  isDrawingMode = false;
  drawingTool: string | null = null;
  docId: number = 0;
  recivedData: any;

  userPhoneNumber = '+221779947443';
  isPhoneValidated = false;

  constructor(
    private route: ActivatedRoute,
    private pdfService: PdfService,
    public historyService: HistoryService,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private docsService: DocsService,
  ) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/assets/js/pdf.worker.min.js';
  }

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3);
  }

  zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 0.5);
  }

  /** Fit : premier clic = 150 %, reclic = 50 % (bascule). */
  private fitToggled = false;

  fitToScreen() {
    this.scale = this.fitToggled ? 0.5 : 1.5;
    this.fitToggled = !this.fitToggled;
  }

  @ViewChild('pdfViewerWrapper') pdfViewerWrapper!: ElementRef;

  ngAfterViewInit() {
    this.thumbCanvases.changes.subscribe(() => {
      if (this.pdfData && this.totalPages > 0) {
        this.generateThumbnails();
      }
    });
  }

  // ─── Thumbnails ───────────────────────────────────────────────────────────

  async generateThumbnails(): Promise<void> {
    if (!this.pdfData || this.totalPages === 0 || this.isGeneratingThumbnails) return;

    this.isGeneratingThumbnails = true;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    await new Promise((r) => setTimeout(r, 100));

    try {
      const thumbnailData = this.pdfData.slice(0);
      const pdf = await pdfjs.getDocument({ data: thumbnailData }).promise;
      const canvases = this.thumbCanvases.toArray();

      for (let i = 0; i < this.totalPages; i++) {
        const canvasEl = canvases[i]?.nativeElement;
        if (!canvasEl) continue;

        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.36 });

        canvasEl.width = viewport.width;
        canvasEl.height = viewport.height;

        const ctx = canvasEl.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      pdf.destroy().catch(() => {});
    } catch (err) {
      // Erreur silencieuse
    } finally {
      this.isGeneratingThumbnails = false;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async loadPdfFromUrl(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('HTTP error ' + response.status);
      const blob = await response.blob();
      this.pdfFile = new File([blob], 'document.pdf', { type: 'application/pdf' });
      await this.loadPdf();
    } catch (error) {
      console.error(error);
      this.notificationService.error("Impossible de charger le PDF depuis l'URL");
    }
  }

  decryptData(encrypted: string): any {
    const decoded = decodeURIComponent(encrypted);
    const bytes = AES.decrypt(decoded, this.secretKey);
    const decryptedString = bytes.toString(enc);
    return JSON.parse(decryptedString);
  }

  sendSignedDocument(file: File) {
    this.docsService
      .markSignature(this.recivedData.id, this.recivedData.signerId, file, '')
      .subscribe({
        next: (res) => {
          console.log('Document signé :', res);
          const url = `https://solimus.sn/#/gestion-vente-vefa/${this.recivedData.parentId}/detail-bien/${this.recivedData.propertyId}/detail-lot?action=DOCS`;
          window.open(url, '_self');
        },
        error: (err) => {
          console.error('Erreur signature', err);
        },
      });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const encryptedParam = params['pdfurl'];

      if (encryptedParam) {
        // ── Mode Solimus : lien chiffré ──────────────────────────────────────
        try {
          const data = this.decryptData(encryptedParam);
          this.recivedData = data;
          console.log('JSON récupéré :', data);
          this.docId = data.id;

          if (!data.initPdf) {
            this.notificationService.error('Paramètre PDF invalide (initPdf manquant).');
            return;
          }
          this.loadPdfFromUrl(environment.fileUrl + data.initPdf);
        } catch (error) {
          console.error('Erreur de déchiffrement', error);
          this.notificationService.error(
            "Impossible de lire le lien PDF. Vérifiez l'URL ou la clé de déchiffrement.",
          );
        }
      } else {
        // ── Mode standalone : pas de pdfurl ─────────────────────────────────
        this.historyService.loadFromLocalStorage();
      }
    });
  }

  // ─── Chargement fichier ───────────────────────────────────────────────────

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.pdfFile = input.files[0];
    await this.loadPdf();
  }

  async createBlankPdf(): Promise<void> {
    try {
      await this.pdfService.createBlankPdf(595, 842);
      const pdfBytes = await this.pdfService.getPdfBytes();

      this.currentDocument = {
        id: this.generateId(),
        name: 'Nouveau document PDF',
        fields: [],
        currentPage: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
      this.pdfUrl = URL.createObjectURL(blob);
      this.pdfFile = null;
      this.totalPages = 1;
      this.pageDimensions = { width: 595, height: 842 };
      await this.generateThumbnails();
      this.saveState();
    } catch (error) {
      this.notificationService.error('Erreur lors de la création du PDF vierge.');
    }
  }

  async loadPdf(): Promise<void> {
    if (!this.pdfFile) return;
    try {
      if (this.pdfUrl) {
        URL.revokeObjectURL(this.pdfUrl);
        this.pdfUrl = '';
      }

      const originalBuffer = await this.pdfFile.arrayBuffer();
      const fileName = this.pdfFile.name;

      this.currentDocument = {
        id: this.generateId(),
        name: fileName,
        fields: [],
        currentPage: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.pdfService.loadPdf(originalBuffer.slice(0));
      } catch (error) {
        // PDF non compatible avec pdf-lib — on continue quand même
      }

      this.pdfData = originalBuffer.slice(0);
      const fileCopy = new File([originalBuffer], fileName, { type: this.pdfFile.type });
      this.pdfUrl = URL.createObjectURL(fileCopy);

      // Récupérer nb pages + dimensions avec fallback pdfjs
      try {
        this.totalPages = await this.pdfService.getPageCount();
        this.pageDimensions = await this.pdfService.getPageDimensions(0);
      } catch {
        try {
          const pdf = await pdfjs.getDocument({ data: this.pdfData!.slice(0) }).promise;
          this.totalPages = pdf.numPages;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1 });
          this.pageDimensions = { width: viewport.width, height: viewport.height };
          pdf.destroy().catch(() => {});
        } catch {
          this.totalPages = 1;
          this.pageDimensions = { width: 595, height: 842 };
        }
      }

      await this.generateThumbnails();
      this.showThumbnails = true;
      this.scale = 1.5;
      this.saveState();
    } catch (error) {
      this.notificationService.error(
        'Impossible de charger le PDF. Vérifiez que le fichier est un PDF valide.',
      );
    }
  }

  // ─── Outils ───────────────────────────────────────────────────────────────

  onToolSelected(tool: string): void {
    const previousTool = this.activeTool;
    this.activeTool = tool;

    if (tool === 'eraser') {
      this.restoreRedactFields();
    } else if (previousTool === 'eraser') {
      this.hideRedactFields();
    }

    if (['highlight', 'line', 'arrow', 'rectangle', 'circle', 'eraser'].includes(tool)) {
      this.isDrawingMode = true;
      this.drawingTool = tool === 'eraser' ? 'mask' : tool;
    } else {
      this.isDrawingMode = false;
      this.drawingTool = null;
    }
  }

  onDrawingOptionsChange(options: { color?: string; lineWidth?: number; opacity?: number }): void {
    this.drawingOptions = { ...this.drawingOptions, ...options };
  }

  private hideRedactFields(): void {}

  private restoreRedactFields(): void {
    if (!this.pdfFile) return;
    const fileName = this.pdfFile.name;
    const savedDoc = this.storageService.getAllDocuments().find((doc) => doc.name === fileName);
    if (savedDoc) {
      const redactFields = savedDoc.fields.filter((f) => f.type === 'redact');
      const existingRedactIds = this.currentDocument.fields
        .filter((f) => f.type === 'redact')
        .map((f) => f.id);
      const newRedactFields = redactFields.filter((f) => !existingRedactIds.includes(f.id));
      if (newRedactFields.length > 0) {
        this.currentDocument.fields = [...this.currentDocument.fields, ...newRedactFields];
        this.saveState();
      }
    }
  }

  async onPageClick(event: { x: number; y: number; page: number }): Promise<void> {
    if (!this.activeTool) return;
    if (this.activeTool === 'eraser') return;
    if (this.isDrawingMode) return;

    try {
      let newField: PDFField;

      switch (this.activeTool) {
        case 'text':
          const fieldHeight = (this.textProperties.fontSize || 12) * 1.5;
          newField = {
            id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'text',
            x: event.x,
            y: event.y - fieldHeight / 2,
            width: 150,
            height: fieldHeight,
            value: '',
            page: event.page - 1,
            fontSize: this.textProperties.fontSize || 8,
            color: this.textProperties.color || '#333333',
            fontFamily: this.textProperties.fontFamily || 'Calibri',
            bold: this.textProperties.bold || false,
            italic: this.textProperties.italic || false,
            underline: this.textProperties.underline || false,
          };
          this.currentDocument.fields = [...this.currentDocument.fields, newField];
          this.currentDocument.updatedAt = new Date();
          this.saveState();
          return;

        case 'checkbox':
          const checkboxSize = Math.max(10, Math.round((this.textProperties.fontSize || 12) * 0.6));
          newField = await this.pdfService.addCheckbox(
            true, event.x, event.y - checkboxSize / 2, event.page - 1, checkboxSize,
            { fontSize: checkboxSize },
          );
          break;

        case 'input': {
          const label = prompt('Label du champ (optionnel):', '') || undefined;
          const placeholder = prompt('Placeholder (optionnel):', '') || undefined;
          newField = await this.pdfService.addInputField(
            event.x, event.y, event.page - 1, 200, 20,
            label, placeholder, this.textProperties,
          );
          break;
        }

        case 'textarea': {
          const label = prompt('Label du champ (optionnel):', '') || undefined;
          const placeholder = prompt('Placeholder (optionnel):', '') || undefined;
          newField = await this.pdfService.addTextareaField(
            event.x, event.y, event.page - 1, 300, 80,
            label, placeholder, this.textProperties,
          );
          break;
        }

        case 'image':
          await this.addImageField(event.x, event.y, event.page - 1);
          return;

        case 'signature':
          this.pendingSignaturePosition = { x: event.x, y: event.y, page: event.page - 1 };
          this.showSignaturePad = true;
          return;

        case 'date': {
          const today = new Date();
          const dateStr = today.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          });
          const fieldHeight = (this.textProperties.fontSize || 12) * 1.5;
          newField = {
            id: `date_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'date',
            x: event.x,
            y: event.y - fieldHeight / 2,
            width: 150,
            height: fieldHeight,
            value: dateStr,
            page: event.page - 1,
            fontSize: this.textProperties.fontSize || 8,
            color: this.textProperties.color || '#333333',
            fontFamily: this.textProperties.fontFamily || 'Calibri',
            bold: this.textProperties.bold || false,
            italic: this.textProperties.italic || false,
            underline: this.textProperties.underline || false,
          };
          break;
        }

        default:
          return;
      }

      this.currentDocument.fields = [...this.currentDocument.fields, newField];
      this.currentDocument.updatedAt = new Date();
      this.saveState();
    } catch (error) {
      this.notificationService.error("Erreur lors de l'ajout du champ. Veuillez réessayer.");
    }
  }

  async addImageField(x: number, y: number, pageIndex: number): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/jpg';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const reader = new FileReader();
        reader.onload = async (ev: ProgressEvent<FileReader>) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) return;
          const img = new Image();
          img.onload = async () => {
            const ratio = Math.min(300 / img.width, 300 / img.height, 1);
            const width = img.width * ratio;
            const height = img.height * ratio;
            const imageY = y - height / 2;
            const newField = await this.pdfService.addImage(dataUrl, x, imageY, pageIndex, width, height);
            this.currentDocument.fields = [...this.currentDocument.fields, newField];
            this.currentDocument.updatedAt = new Date();
            this.saveState();
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      } catch (error) {
        this.notificationService.error("Erreur lors de l'ajout de l'image.");
      }
    };
    input.click();
  }

  // ─── Mise à jour des champs ───────────────────────────────────────────────

  onFieldTextEdit(event: { field: PDFField; newText: string }): void {
    const index = this.currentDocument.fields.findIndex((f) => f.id === event.field.id);
    if (index !== -1) {
      this.currentDocument.fields[index] = {
        ...this.currentDocument.fields[index],
        value: event.newText,
      };
      this.currentDocument.updatedAt = new Date();
    }
  }

  onFieldUpdated(updated: PDFField): void {
    const index = this.currentDocument.fields.findIndex((f) => f.id === updated.id);
    if (index !== -1) {
      this.currentDocument.fields[index] = updated;
      this.currentDocument.updatedAt = new Date();
      this.saveState();
    }
  }

  onFieldSelected(field: PDFField): void {
    this.selectedField = field;
  }

  onFieldPropertiesUpdated(field: PDFField): void {
    const index = this.currentDocument.fields.findIndex((f) => f.id === field.id);
    if (index !== -1) {
      this.currentDocument.fields[index] = field;
      this.currentDocument.updatedAt = new Date();
      this.saveState();
    }
  }

  onFieldDeleted(field: PDFField | string): void {
    const fieldId = typeof field === 'string' ? field : field.id;
    const fieldToDelete =
      typeof field === 'string'
        ? this.currentDocument.fields.find((f) => f.id === fieldId)
        : field;

    if (!fieldToDelete) return;

    this.currentDocument.fields = this.currentDocument.fields.filter((f) => f.id !== fieldId);
    this.currentDocument.updatedAt = new Date();
    this.selectedField = null;
    this.saveState();
    this.notificationService.success('Élément supprimé.');
  }

  onSignatureSaved(signatureDataUrl: string): void {
    const position = this.pendingSignaturePosition || {
      x: 100,
      y: 100,
      page: this.currentDocument.currentPage - 1,
    };

    const newField: PDFField = {
      id: `signature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'signature',
      x: position.x,
      y: position.y - 40,
      width: 200,
      height: 80,
      value: signatureDataUrl,
      page: position.page,
    };
    this.currentDocument.fields = [...this.currentDocument.fields, newField];
    this.currentDocument.updatedAt = new Date();
    this.saveState();
    this.showSignaturePad = false;
    this.pendingSignaturePosition = null;
    this.notificationService.success('Signature ajoutée avec succès.');
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async onExport(signed: boolean = false): Promise<void> {
    if (this.currentDocument.fields.length === 0) {
      this.notificationService.warning("Aucun champ à exporter. Ajoutez des éléments avant d'exporter.");
      return;
    }

    try {
      const blob: Blob = await this.pdfService.exportPdf(
        this.currentDocument.fields,
        `${this.currentDocument.name}.pdf`,
        false,
        signed,
      );

      this.notificationService.success('PDF exporté avec succès !');

      if (signed) {
        const file = new File([blob], `${this.currentDocument.name}.pdf`, {
          type: 'application/pdf',
        });
        this.sendSignedDocument(file);
      }
    } catch (error) {
      this.notificationService.error("Erreur lors de l'export du PDF. Veuillez réessayer.");
      console.error(error);
    }
  }

  // ─── Preview : s'ouvre immédiatement au 1er clic sur l'œil ───────────────

  // ─── Preview : s'ouvre immédiatement au 1er clic sur l'œil ───────────────

  async onPreview(): Promise<void> {
    if (!this.pdfUrl) {
      this.notificationService.info('Aucun PDF chargé.');
      return;
    }

    try {
      // 1. Fermer d'abord si déjà ouvert (reset propre)
      this.showPdfPreviewModal = false;

      // 2. Libérer l'ancien blob preview
      if (this.previewPdfUrl && this.previewPdfUrl !== this.pdfUrl) {
        URL.revokeObjectURL(this.previewPdfUrl);
        this.previewPdfUrl = '';
      }

      // 3. Générer le PDF (ou réutiliser l'original)
      if (this.currentDocument.fields.length > 0) {
        const blob = await this.pdfService.exportPdf(
          this.currentDocument.fields,
          `${this.currentDocument.name}.pdf`,
          true,
        );
        this.previewPdfUrl = URL.createObjectURL(blob);
      } else {
        this.previewPdfUrl = this.pdfUrl;
      }

      // 4. Ouvrir la modale — previewPdfUrl est déjà set, ngOnChanges se déclenche une seule fois
      this.showPdfPreviewModal = true;

    } catch (error) {
      this.notificationService.error('Erreur lors de la prévisualisation du PDF.');
    }
  }

  // ─── Historique ───────────────────────────────────────────────────────────

  saveState(): void {
    this.currentDocument.updatedAt = new Date();
    this.historyService.saveState(this.currentDocument);
    this.updateHistoryButtons();
  }

  saveToStorage(): void {
    this.currentDocument.updatedAt = new Date();
    this.storageService.saveDocument(this.currentDocument);
  }

  onUndo(): void {
    const state = this.historyService.undo();
    if (state) {
      this.currentDocument = state;
      this.updateHistoryButtons();
      this.notificationService.info('Action annulée.');
    } else {
      this.notificationService.info('Aucune action à annuler.');
    }
  }

  onRedo(): void {
    const state = this.historyService.redo();
    if (state) {
      this.currentDocument = state;
      this.updateHistoryButtons();
      this.notificationService.info('Action rétablie.');
    } else {
      this.notificationService.info('Aucune action à rétablir.');
    }
  }

  updateHistoryButtons(): void {
    this.canUndo = this.historyService.canUndo();
    this.canRedo = this.historyService.canRedo();
  }

  // ─── Pages ────────────────────────────────────────────────────────────────

  onPageChange(page: number): void {
    this.currentDocument.currentPage = page;
    this.currentDocument.updatedAt = new Date();
    this.saveState();
  }

  onPageRendered(event: { page: number; width: number; height: number }): void {
    this.pageDimensions.width = event.width / this.scale;
    this.pageDimensions.height = event.height / this.scale;
  }

  // ─── Sauvegarde / Chargement ──────────────────────────────────────────────

  onSave(): void {
    const name = prompt('Nom du document:', this.currentDocument.name);
    if (name) {
      this.currentDocument.name = name;
      this.saveState();
      this.saveToStorage();
      this.notificationService.success('Document sauvegardé avec succès !');
    }
  }

  async onOtpSubmitted(otpCode: string): Promise<void> {
    console.log('Code OTP reçu:', otpCode);
    const name = this.currentDocument.name || `Document_${Date.now()}`;
    this.currentDocument.name = name;
    this.saveToStorage();
    this.showOtpModal = false;
    this.notificationService.success('Code OTP vérifié avec succès ! Redirection en cours...');
    this.onExport(true);
  }

  onOtpValidated(isValid: boolean): void {
    if (isValid) {
      this.isPhoneValidated = true;
      this.onExport(true);
    } else {
      console.error('Échec de la validation du code OTP');
      this.showOtpModal = true;
    }
  }

  onOtpModalClosed(): void {
    this.showOtpModal = false;
  }

  onResendOtp(): void {
    console.log('Renvoyer le code OTP');
    this.notificationService.success('Code OTP renvoyé avec succès !');
  }

  onTermine(): void {
    this.showOtpModal = true;
  }

  onLoad(): void {
    if (this.currentDocument.fields.length > 0 && this.pdfUrl) {
      this.saveToStorage();
    }
    this.showSavedDocuments = true;
  }

  async loadSavedDocument(doc: PDFDocumentState): Promise<void> {
    this.currentDocument = {
      ...doc,
      updatedAt: new Date(doc.updatedAt),
      createdAt: new Date(doc.createdAt),
    };

    if (this.pdfUrl && this.pdfData && this.pdfFile?.name === doc.name) {
      this.updateHistoryButtons();
      this.notificationService.success(
        `Document "${doc.name}" chargé avec ${doc.fields.length} champ(s).`,
      );
    } else {
      this.showSavedDocuments = false;
      setTimeout(() => {
        const fileInput = window.document.getElementById('pdfInput') as HTMLInputElement;
        if (fileInput) fileInput.click();
      }, 300);
    }
  }

  onClear(): void {
    if (this.currentDocument.fields.length === 0) {
      this.notificationService.info('Aucun élément à supprimer.');
      return;
    }
    this.currentDocument.fields = [];
    this.currentDocument.updatedAt = new Date();
    this.saveState();
    this.notificationService.success('Tous les éléments ont été supprimés.');
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  onTextPropertiesChange(properties: any): void {
    this.textProperties = { ...this.textProperties, ...properties };

    if (
      this.selectedField &&
      (this.selectedField.type === 'text' || this.selectedField.type === 'date')
    ) {
      const index = this.currentDocument.fields.findIndex((f) => f.id === this.selectedField!.id);
      if (index !== -1) {
        this.currentDocument.fields[index] = {
          ...this.currentDocument.fields[index],
          fontSize: this.textProperties.fontSize,
          color: this.textProperties.color,
          fontFamily: this.textProperties.fontFamily,
          bold: this.textProperties.bold,
          italic: this.textProperties.italic,
          underline: this.textProperties.underline,
        };
      }
    }
  }

  onCloseSignaturePad(): void {
    this.showSignaturePad = false;
    this.pendingSignaturePosition = null;
  }

  onCloseSavedDocuments(): void {
    this.showSavedDocuments = false;
  }

  openPdfInfoModal(): void {
    this.showPdfInfoModal = true;
  }

  closePdfInfoModal(): void {
    this.showPdfInfoModal = false;
  }

  closePdfPreviewModal(): void {
    // Ne pas révoquer si c'est l'URL originale (pas un blob temporaire d'export)
    if (this.previewPdfUrl && this.previewPdfUrl !== this.pdfUrl) {
      URL.revokeObjectURL(this.previewPdfUrl);
    }
    this.previewPdfUrl = '';
    this.showPdfPreviewModal = false;
  }

  onDrawingComplete(
    data:
      | string
      | { x: number; y: number; width: number; height: number }
      | { dataUrl: string; x: number; y: number; width: number; height: number },
  ): void {
    if (typeof data === 'object' && 'x' in data && !('dataUrl' in data)) {
      const redactField: PDFField = {
        id: `redact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'redact',
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        value: '',
        page: this.currentDocument.currentPage - 1,
      };
      this.currentDocument.fields = [...this.currentDocument.fields, redactField];
      this.currentDocument.updatedAt = new Date();
      this.saveState();
      this.isDrawingMode = false;
      this.drawingTool = null;
      this.activeTool = null;
      return;
    }

    if (typeof data === 'object' && 'dataUrl' in data) {
      const isHighlight = this.drawingTool === 'highlight';
      const newField: PDFField = {
        id: `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        value: data.dataUrl,
        page: this.currentDocument.currentPage - 1,
        isAnnotation: true,
        isHighlight,
        ...(isHighlight && { blendMode: this.drawingOptions.blendMode || 'multiply' }),
      };
      this.currentDocument.fields = [...this.currentDocument.fields, newField];
      this.currentDocument.updatedAt = new Date();
      this.saveState();
      return;
    }

    // Legacy : dataUrl plein page
    const dataUrl = data as string;
    const newField: PDFField = {
      id: `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'image',
      x: 0,
      y: 0,
      width: this.pageDimensions.width,
      height: this.pageDimensions.height,
      value: dataUrl,
      page: this.currentDocument.currentPage - 1,
    };
    this.currentDocument.fields = [...this.currentDocument.fields, newField];
    this.currentDocument.updatedAt = new Date();
    this.saveState();
  }

  onDrawingCancelled(): void {
    this.isDrawingMode = false;
    this.drawingTool = null;
    this.activeTool = null;
  }
}
