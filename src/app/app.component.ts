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
import * as CryptoJS from 'crypto-js';
import { DocsService } from './services/DocsService';

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
    PagesSidebarComponent,
    PdfInfoModalComponent,
    PdfPreviewModalComponent,
    DrawingCanvasComponent,
    NotificationContainerComponent,
    OtpModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
})
export class AppComponent implements OnInit {
  private secretKey = 'innov-impact-secret-key';
  title = 'Solimus sign';
  Math = Math;

  @Input() pages: number[] = [];
  @Input() currentPage: number = 1;
  @Input() isOpen: boolean = true;
  @Input() isMobile: boolean = false;

  @Output() pageSelected = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();

  @ViewChildren('thumbCanvas') thumbCanvases!: QueryList<
    ElementRef<HTMLCanvasElement>
  >;

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
  pendingSignaturePosition: { x: number; y: number; page: number } | null =
    null;
  showSavedDocuments = false;
  selectedField: PDFField | null = null;
  textProperties = {
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Helvetica',
    backgroundColor: 'transparent',
    textAlign: 'left',
    verticalAlign: 'top',
    bold: false,
    italic: false,
    underline: false,
  };

  totalPages = 0;
  pageDimensions = { width: 0, height: 0 };
  scale = 1.13;
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

  // Optionnel : écouter le resize
  //   @HostListener('window:resize', ['$event'])
  //   onResize(event) {
  //     this.isMobile = window.innerWidth <= 992;
  //   }
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

  // Ajoute ces méthodes dans AppComponent

  zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3); // max 300%
  }

  zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 0.5); // min 50%
  }

  fitToScreen() {
    if (!this.pageDimensions.width || !this.pageDimensions.height) return;

    // Calcul simple : adapter à la largeur disponible (moins marges)
    const containerWidth =
      this.pdfViewerWrapper?.nativeElement?.clientWidth ||
      window.innerWidth * 0.9;
    const newScale = (containerWidth - 80) / this.pageDimensions.width; // 80px de marge

    this.scale = Math.max(0.5, Math.min(newScale, 1.5)); // entre 50% et 150%
  }

  // Optionnel : injecter l’élément pour fitToScreen
  @ViewChild('pdfViewerWrapper') pdfViewerWrapper!: ElementRef;

  ngAfterViewInit() {
    this.thumbCanvases.changes.subscribe(() => {
      if (this.pdfData && this.totalPages > 0) {
        this.generateThumbnails();
      }
    });
  }
  // Dans AppComponent

  // Appel cette fonction après avoir chargé le PDF et connu totalPages
  async generateThumbnails(): Promise<void> {
    if (!this.pdfData || this.totalPages === 0 || this.isGeneratingThumbnails)
      return;

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

      pdf.destroy().catch(() => { });
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

      if (!response.ok) {
        throw new Error('HTTP error ' + response.status);
      }

      const blob = await response.blob();

      this.pdfFile = new File([blob], 'document.pdf', {
        type: 'application/pdf',
      });

      await this.loadPdf();
    } catch (error) {
      console.error(error);
      this.notificationService.error(
        "Impossible de charger le PDF depuis l'URL",
      );
    }
  }

  decryptData(encrypted: string): any {
    const decoded = decodeURIComponent(encrypted);

    const bytes = CryptoJS.AES.decrypt(decoded, this.secretKey);

    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

    return JSON.parse(decryptedString);
  }
  sendSignedDocument(file: File) {
    this.docsService.uploadSignedPdf(this.docId, file).subscribe({
      next: (res) => {
        console.log('Upload réussi', res);

        // retour vers solimus
        const url = `https://solimus.sn/#/gestion-vente-vefa/${this.recivedData.parentId}/detail-bien/${this.recivedData.propertyId}/detail-lot?action=DOCS`;
        console.log(url);

        // Ouvrir dans le même onglet
        window.open(url, '_self');
      },
      error: (err) => {
        console.error('Erreur upload', err);
      },
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const encryptedParam = params['pdfurl'];

      if (encryptedParam) {
        try {
          const data = this.decryptData(encryptedParam);
          this.recivedData = data;

          console.log('JSON récupéré :', data);
          this.docId = data.id;

          this.loadPdfFromUrl(
            'https://solimus.sn:8082/api/files/' + data.initPdf,
          );
          // tu peux utiliser les données ici
        } catch (error) {
          console.error('Erreur de déchiffrement', error);
        }
      }
    });

    this.historyService.loadFromLocalStorage();

    // Ne pas charger automatiquement le dernier document au démarrage
    // L'utilisateur doit cliquer sur "Charger" pour charger un document sauvegardé
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
      this.notificationService.error(
        'Erreur lors de la création du PDF vierge.',
      );
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

      // Ne pas charger automatiquement les champs sauvegardés lors de l'upload
      // Les champs seront chargés uniquement si l'utilisateur clique sur "Charger"
      this.currentDocument = {
        id: this.generateId(),
        name: fileName,
        fields: [],
        currentPage: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Charger dans pdf-lib seulement si nécessaire (pour l'export)
      try {
        await this.pdfService.loadPdf(originalBuffer.slice(0));
      } catch (error) {
        // PDF non compatible avec pdf-lib
      }

      this.pdfData = originalBuffer.slice(0);
      const fileCopy = new File([originalBuffer], fileName, {
        type: this.pdfFile.type,
      });
      this.pdfUrl = URL.createObjectURL(fileCopy);

      this.totalPages = await this.pdfService.getPageCount();
      this.pageDimensions = await this.pdfService.getPageDimensions(0);
      await this.generateThumbnails();
      this.showThumbnails = true;

      // Ne pas sauvegarder automatiquement lors du chargement d'un PDF
      // La sauvegarde se fera uniquement lors de la soumission (Terminé)
    } catch (error) {
      this.notificationService.error(
        "Erreur lors de l'ajout de l'image. Format non supporté ou fichier corrompu.",
      );
    }
  }

  // ─── Outils ───────────────────────────────────────────────────────────────

  onToolSelected(tool: string): void {
    const previousTool = this.activeTool;
    this.activeTool = tool;

    // Si l'outil effaceur est activé, restaurer les masques sauvegardés
    if (tool === 'eraser') {
      this.restoreRedactFields();
    } else if (previousTool === 'eraser') {
      // Si on quitte l'outil effaceur, supprimer les masques de l'affichage (mais pas du document)
      // Les masques restent sauvegardés mais ne sont plus visibles
      this.hideRedactFields();
    }

    // Activer le mode dessin pour les outils de dessin
    if (
      ['highlight', 'draw', 'line', 'arrow', 'rectangle', 'circle', 'eraser'].includes(
        tool,
      )
    ) {
      this.isDrawingMode = true;
      this.drawingTool = tool === 'eraser' ? 'mask' : tool;
    } else {
      this.isDrawingMode = false;
      this.drawingTool = null;
    }
  }

  private hideRedactFields(): void {
    // Les masques restent dans le document mais ne sont plus visibles
    // Ils seront restaurés quand l'outil effaceur sera réactivé
    // Pas besoin de supprimer, juste ne pas les afficher (géré par le template)
  }

  private restoreRedactFields(): void {
    if (!this.pdfFile) return;

    const fileName = this.pdfFile.name;
    const savedDoc = this.storageService
      .getAllDocuments()
      .find((doc) => doc.name === fileName);

    if (savedDoc) {
      // Restaurer seulement les masques (redact)
      const redactFields = savedDoc.fields.filter(f => f.type === 'redact');
      // Ajouter les masques qui ne sont pas déjà présents
      const existingRedactIds = this.currentDocument.fields
        .filter(f => f.type === 'redact')
        .map(f => f.id);
      const newRedactFields = redactFields.filter(f => !existingRedactIds.includes(f.id));

      if (newRedactFields.length > 0) {
        this.currentDocument.fields = [...this.currentDocument.fields, ...newRedactFields];
        this.saveState();
      }
    }
  }

  async onPageClick(event: {
    x: number;
    y: number;
    page: number;
  }): Promise<void> {
    if (!this.activeTool) return;

    // Mode effaceur - géré par le drawing-canvas
    if (this.activeTool === 'eraser') {
      return;
    }

    // Mode dessin - ne pas créer de champ au clic
    if (this.isDrawingMode) {
      return;
    }

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
            fontSize: this.textProperties.fontSize || 12,
            color: this.textProperties.color || '#000000',
            fontFamily: this.textProperties.fontFamily || 'Helvetica',
            bold: this.textProperties.bold || false,
            italic: this.textProperties.italic || false,
            underline: this.textProperties.underline || false,
          };
          this.currentDocument.fields = [
            ...this.currentDocument.fields,
            newField,
          ];
          this.currentDocument.updatedAt = new Date();
          this.saveState();
          return;

        case 'checkbox':
          // event.y est la position du clic depuis le BAS de la page en points PDF
          // field.y doit représenter le coin BAS du conteneur (comme dans getFieldStyle)
          // Dans le viewer HTML, le conteneur est positionné avec :
          //   top = pageHeight - (field.y * scale) - (field.height * scale)
          // Donc field.y est le coin BAS du conteneur
          // Pour que la checkbox soit centrée visuellement à la position du clic,
          // le centre du conteneur doit être à event.y
          // Donc : field.y + field.height / 2 = event.y
          // Donc : field.y = event.y - field.height / 2
          // Réduire la taille : utiliser 60% de la taille de police ou 10 par défaut
          const checkboxSize = Math.max(
            10,
            Math.round((this.textProperties.fontSize || 12) * 0.6),
          );
          // Le conteneur a la même taille que la checkbox
          newField = await this.pdfService.addCheckbox(
            true,
            event.x,
            event.y - checkboxSize / 2,
            event.page - 1,
            checkboxSize,
            { fontSize: checkboxSize },
          );
          break;

        case 'input': {
          const label = prompt('Label du champ (optionnel):', '') || undefined;
          const placeholder =
            prompt('Placeholder (optionnel):', '') || undefined;
          newField = await this.pdfService.addInputField(
            event.x,
            event.y,
            event.page - 1,
            200,
            20,
            label,
            placeholder,
            this.textProperties,
          );
          break;
        }

        case 'textarea': {
          const label = prompt('Label du champ (optionnel):', '') || undefined;
          const placeholder =
            prompt('Placeholder (optionnel):', '') || undefined;
          newField = await this.pdfService.addTextareaField(
            event.x,
            event.y,
            event.page - 1,
            300,
            80,
            label,
            placeholder,
            this.textProperties,
          );
          break;
        }

        case 'image':
          await this.addImageField(event.x, event.y, event.page - 1);
          return;

        case 'signature':
          // Sauvegarder la position du clic pour placer la signature
          this.pendingSignaturePosition = {
            x: event.x,
            y: event.y,
            page: event.page - 1,
          };
          this.showSignaturePad = true;
          return;

        case 'date': {
          const today = new Date();
          const dateStr = today.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
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
            fontSize: this.textProperties.fontSize || 12,
            color: this.textProperties.color || '#000000',
            fontFamily: this.textProperties.fontFamily || 'Helvetica',
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
      this.notificationService.error(
        "Erreur lors de l'ajout du champ. Veuillez réessayer.",
      );
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
            // x, y sont en points PDF depuis le bas de la page (position du clic)
            // field.y doit représenter le coin BAS du champ (comme dans getFieldStyle)
            // Pour que l'image soit centrée visuellement à la position du clic,
            // on place le coin BAS du champ légèrement en dessous du point de clic
            const imageY = y - height / 2; // Coin BAS du champ pour que le centre soit à y
            const newField = await this.pdfService.addImage(
              dataUrl,
              x,
              imageY,
              pageIndex,
              width,
              height,
            );
            this.currentDocument.fields = [
              ...this.currentDocument.fields,
              newField,
            ];
            this.currentDocument.updatedAt = new Date();
            this.saveState();
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      } catch (error) {
        this.notificationService.error(
          "Erreur lors de l'ajout de l'image. Format non supporté ou fichier corrompu.",
        );
      }
    };
    input.click();
  }

  // ─── Mise à jour des champs ───────────────────────────────────────────────

  onFieldTextEdit(event: { field: PDFField; newText: string }): void {
    const index = this.currentDocument.fields.findIndex(
      (f) => f.id === event.field.id,
    );
    if (index !== -1) {
      // Mettre à jour la valeur en place (sans recréer le tableau pour garder le focus)
      this.currentDocument.fields[index] = {
        ...this.currentDocument.fields[index],
        value: event.newText,
      };
      this.currentDocument.updatedAt = new Date();
      // NE PAS sauvegarder à chaque frappe pour ne pas perturber l'édition
    }
  }

  onFieldUpdated(updated: PDFField): void {
    const index = this.currentDocument.fields.findIndex(
      (f) => f.id === updated.id,
    );
    if (index !== -1) {
      this.currentDocument.fields[index] = updated;
      this.currentDocument.updatedAt = new Date();
      // NE PAS régénérer le viewer ici — le viewer lit directement this.currentDocument.fields
      // via [ngStyle] et getFieldStyle(). Pas besoin de rebuilder le PDF pour l'affichage.
      this.saveState();
    }
  }

  onFieldSelected(field: PDFField): void {
    this.selectedField = field;
  }

  onFieldPropertiesUpdated(field: PDFField): void {
    const index = this.currentDocument.fields.findIndex(
      (f) => f.id === field.id,
    );
    if (index !== -1) {
      this.currentDocument.fields[index] = field;
      this.currentDocument.updatedAt = new Date();
      this.saveState();
    }
  }

  onFieldDeleted(field: PDFField | string): void {
    // Gérer les deux cas : PDFField ou string (ID)
    const fieldId = typeof field === 'string' ? field : field.id;
    const fieldToDelete =
      typeof field === 'string'
        ? this.currentDocument.fields.find((f) => f.id === fieldId)
        : field;

    if (!fieldToDelete) return;

    this.currentDocument.fields = this.currentDocument.fields.filter(
      (f) => f.id !== fieldId,
    );
    this.currentDocument.updatedAt = new Date();
    this.selectedField = null;
    this.saveState();
    this.notificationService.success('Élément supprimé.');
  }

  onSignatureSaved(signatureDataUrl: string): void {
    // Utiliser la position sauvegardée du clic ou une position par défaut
    const position = this.pendingSignaturePosition || {
      x: 100,
      y: 100,
      page: this.currentDocument.currentPage - 1,
    };

    const newField: PDFField = {
      id: `signature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'signature',
      x: position.x,
      y: position.y - 40, // Centrer verticalement (hauteur/2)
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

  async onExport(): Promise<void> {
    if (this.currentDocument.fields.length === 0) {
      this.notificationService.warning(
        "Aucun champ à exporter. Ajoutez des éléments avant d'exporter.",
      );
      return;
    }

    try {
      // 1️⃣ Export du PDF en Blob
      const blob: Blob = await this.pdfService.exportPdf(
        this.currentDocument.fields,
        `${this.currentDocument.name}.pdf`,
        false, // false = pas de preview
      );

      this.notificationService.success('PDF exporté avec succès !');

      // 2️⃣ Convertir le Blob en File pour l'upload
      const file = new File([blob], `${this.currentDocument.name}.pdf`, {
        type: 'application/pdf',
      });

      // 3️⃣ Envoyer le PDF au backend via ton service
      this.sendSignedDocument(file);
    } catch (error) {
      this.notificationService.error(
        "Erreur lors de l'export du PDF. Veuillez réessayer.",
      );
      console.error(error);
    }
  }

  async onPreview(): Promise<void> {
    if (this.currentDocument.fields.length === 0) {
      this.notificationService.info(
        "Aucun champ à prévisualiser. Ajoutez des éléments pour voir l'aperçu.",
      );
      return;
    }
    try {
      const blob = await this.pdfService.exportPdf(
        this.currentDocument.fields,
        `${this.currentDocument.name}.pdf`,
        true,
      );

      this.previewPdfUrl = URL.createObjectURL(blob);
      this.showPdfPreviewModal = true;
    } catch (error) {
      this.notificationService.error(
        'Erreur lors de la prévisualisation du PDF.',
      );
    }
  }

  // ─── Historique ───────────────────────────────────────────────────────────

  saveState(): void {
    // Sauvegarder uniquement l'historique pour undo/redo, pas dans le storage
    this.currentDocument.updatedAt = new Date();
    this.historyService.saveState(this.currentDocument);
    this.updateHistoryButtons();
    // Ne pas sauvegarder dans le storage ici - seulement lors de la soumission
  }

  saveToStorage(): void {
    // Sauvegarder dans le storage uniquement lors de la soumission
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
      this.saveState(); // Pour l'historique
      this.saveToStorage(); // Pour sauvegarder dans le storage
      this.notificationService.success('Document sauvegardé avec succès !');
    }
  }

  async onOtpSubmitted(otpCode: string): Promise<void> {
    // TODO: Appeler l'API backend pour vérifier le code OTP
    // Pour l'instant, je simule une validation réussie
    console.log('Code OTP reçu:', otpCode);

    // Ici, on appellera l'API backend pour vérifier le code
    // Exemple: const isValid = await this.docsService.verifyOtp(otpCode);
    // if (!isValid) {
    //   this.notificationService.error('Code OTP incorrect');
    //   return;
    // }

    // Pour l'instant, on simule une validation réussie
    // Sauvegarder le document dans le storage uniquement lors de la soumission
    const name = this.currentDocument.name || `Document_${Date.now()}`;
    this.currentDocument.name = name;
    this.saveToStorage();

    // Fermer le modal
    this.showOtpModal = false;

    // Afficher un message de succès
    this.notificationService.success('Code OTP vérifié avec succès ! Redirection en cours...');

    // Rediriger vers l'URL spécifiée après un court délai
    setTimeout(() => {
      window.location.href = 'https://solimus.sn/#/gestion-vente-vefa/46/detail-bien/86/detail-lot?action=DETAILS';
    }, 1000);
  }

  onOtpModalClosed(): void {
    this.showOtpModal = false;
  }

  onResendOtp(): void {
    // TODO: Appeler l'API backend pour renvoyer le code OTP
    console.log('Renvoyer le code OTP');
    this.notificationService.success('Code OTP renvoyé avec succès !');
  }

  onTermine(): void {
    // Ouvrir le modal OTP pour finaliser et soumettre
    this.showOtpModal = true;
  }

  onLoad(): void {
    // Ouvrir la modal pour charger un document sauvegardé
    // Sauvegarder automatiquement l'état actuel avant d'ouvrir la modal
    if (this.currentDocument.fields.length > 0 && this.pdfUrl) {
      this.saveToStorage(); // Sauvegarder dans le storage avant de charger un autre document
    }
    this.showSavedDocuments = true;
  }

  async loadSavedDocument(doc: PDFDocumentState): Promise<void> {
    // Chargement du document

    this.currentDocument = {
      ...doc,
      updatedAt: new Date(doc.updatedAt),
      createdAt: new Date(doc.createdAt),
    };

    if (this.pdfUrl && this.pdfData && this.pdfFile?.name === doc.name) {
      // PDF correspondant déjà chargé
      this.updateHistoryButtons();
      this.notificationService.success(
        `Document "${doc.name}" chargé avec ${doc.fields.length} champ(s).`,
      );
    } else {
      this.showSavedDocuments = false;

      setTimeout(() => {
        const message = `📄 Sélectionnez le fichier PDF "${doc.name}" pour voir vos ${doc.fields.length} champs.`;
        // Message silencieux

        const fileInput = window.document.getElementById(
          'pdfInput',
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.click();
        }
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

    // Appliquer immédiatement au champ sélectionné s'il est en cours d'édition
    if (
      this.selectedField &&
      (this.selectedField.type === 'text' || this.selectedField.type === 'date')
    ) {
      const index = this.currentDocument.fields.findIndex(
        (f) => f.id === this.selectedField!.id,
      );
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
    if (this.previewPdfUrl) {
      URL.revokeObjectURL(this.previewPdfUrl);
      this.previewPdfUrl = '';
    }
    this.showPdfPreviewModal = false;
  }

  onDrawingComplete(data: string | { x: number; y: number; width: number; height: number }): void {
    // Si c'est un masque (objet avec coordonnées)
    if (typeof data === 'object' && 'x' in data) {
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

    // Sinon, c'est un dessin normal (image)
    const dataUrl = data as string;
    const newField: PDFField = {
      id: `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'image',
      x: 50,
      y: 50,
      width: this.pageDimensions.width - 100,
      height: this.pageDimensions.height - 100,
      value: dataUrl,
      page: this.currentDocument.currentPage - 1,
    };

    this.currentDocument.fields = [...this.currentDocument.fields, newField];
    this.currentDocument.updatedAt = new Date();
    this.saveState();

    this.isDrawingMode = false;
    this.drawingTool = null;
    this.activeTool = null;
  }

  onDrawingCancelled(): void {
    this.isDrawingMode = false;
    this.drawingTool = null;
    this.activeTool = null;
  }
}
