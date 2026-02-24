import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFMetadata {
  name: string;
  size: number;
  type: string;
  pages: number;
  creator?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

@Component({
  selector: 'app-pdf-info-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close()" [@fadeIn]>
      <div class="modal-container" (click)="$event.stopPropagation()" [@slideUp]>
        
        <div class="modal-header">
          <h2><i class="fas fa-file-pdf"></i> Informations du document</h2>
          <button class="btn-close" (click)="close()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="content-grid">
            
            <!-- Miniature -->
            <div class="thumbnail-section">
              <div class="thumbnail-container">
                <canvas #thumbnailCanvas></canvas>
                <div class="thumbnail-loading" *ngIf="isLoadingThumbnail">
                  <i class="fas fa-spinner fa-spin"></i>
                </div>
              </div>
            </div>

            <!-- Métadonnées -->
            <div class="metadata-section">
              <div class="meta-item">
                <label>Name</label>
                <span>{{ metadata.name }}</span>
              </div>

              <div class="meta-item">
                <label>File type</label>
                <span>{{ metadata.type }}</span>
              </div>

              <div class="meta-item">
                <label>Size</label>
                <span>{{ formatSize(metadata.size) }}</span>
              </div>

              <div class="meta-item" *ngIf="metadata.creator">
                <label>Creator</label>
                <span>{{ metadata.creator }}</span>
              </div>

              <div class="meta-item" *ngIf="metadata.creationDate">
                <label>Creation date</label>
                <span>{{ formatDate(metadata.creationDate) }}</span>
              </div>

              <div class="meta-item" *ngIf="metadata.modificationDate">
                <label>Modification date</label>
                <span>{{ formatDate(metadata.modificationDate) }}</span>
              </div>

              <div class="meta-item">
                <label>Pages</label>
                <span>{{ metadata.pages }}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-container {
      width: 700px;
      max-width: 90vw;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: linear-gradient(135deg, rgba(230,57,70,0.08) 0%, transparent 60%);
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a1a1f;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-header i {
      color: #e63946;
    }

    .btn-close {
      background: rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.08);
      color: rgba(0,0,0,0.5);
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-close:hover {
      background: rgba(230,57,70,0.15);
      border-color: rgba(230,57,70,0.3);
      color: #e63946;
    }

    .modal-body {
      padding: 24px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 24px;
    }

    .thumbnail-section {
      display: flex;
      flex-direction: column;
    }

    .thumbnail-container {
      position: relative;
      width: 200px;
      height: 260px;
      background: rgba(0,0,0,0.03);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .thumbnail-container canvas {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .thumbnail-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.3);
      color: #e63946;
      font-size: 1.5rem;
    }

    .metadata-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .meta-item label {
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(0,0,0,0.4);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .meta-item span {
      font-size: 0.95rem;
      color: rgba(0,0,0,0.9);
      font-family: 'DM Mono', monospace;
    }

    @media (max-width: 768px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
      
      .thumbnail-container {
        width: 100%;
        max-width: 200px;
        margin: 0 auto;
      }
    }
  `],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('180ms ease', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(20px) scale(0.97)', opacity: 0 }),
        animate('250ms cubic-bezier(0.34,1.56,0.64,1)', style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('180ms ease', style({ transform: 'translateY(10px) scale(0.98)', opacity: 0 }))
      ])
    ])
  ]
})
export class PdfInfoModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() pdfFile: File | null = null;
  @Input() pdfUrl: string = '';
  @Output() closed = new EventEmitter<void>();

  metadata: PDFMetadata = {
    name: '',
    size: 0,
    type: 'PDF',
    pages: 0,
    creator: 'Guest'
  };

  isLoadingThumbnail = false;

  async ngOnChanges() {
    if (this.isOpen && (this.pdfFile || this.pdfUrl)) {
      await this.loadMetadata();
      await this.generateThumbnail();
    }
  }

  async loadMetadata() {
    if (this.pdfFile) {
      this.metadata = {
        name: this.pdfFile.name.replace('.pdf', ''),
        size: this.pdfFile.size,
        type: 'PDF',
        pages: 0,
        creator: 'Guest',
        creationDate: new Date(this.pdfFile.lastModified),
        modificationDate: new Date(this.pdfFile.lastModified)
      };
    }

    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/js/pdf.worker.min.js';
      const loadingTask = pdfjsLib.getDocument(this.pdfUrl || URL.createObjectURL(this.pdfFile!));
      const pdf = await loadingTask.promise;
      this.metadata.pages = pdf.numPages;

      const pdfMetadata = await pdf.getMetadata();
      if (pdfMetadata.info) {
        const info = pdfMetadata.info as any;
        if (info.Creator) this.metadata.creator = info.Creator;
        if (info.CreationDate) this.metadata.creationDate = this.parsePDFDate(info.CreationDate);
        if (info.ModDate) this.metadata.modificationDate = this.parsePDFDate(info.ModDate);
      }
    } catch (error) {
      console.error('Erreur chargement métadonnées:', error);
    }
  }

  async generateThumbnail() {
    this.isLoadingThumbnail = true;
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/js/pdf.worker.min.js';
      const loadingTask = pdfjsLib.getDocument(this.pdfUrl || URL.createObjectURL(this.pdfFile!));
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.querySelector('.thumbnail-container canvas') as HTMLCanvasElement;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      console.error('Erreur génération miniature:', error);
    } finally {
      this.isLoadingThumbnail = false;
    }
  }

  parsePDFDate(dateStr: string): Date {
    const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return new Date(
        parseInt(match[1]), 
        parseInt(match[2]) - 1, 
        parseInt(match[3]),
        parseInt(match[4]),
        parseInt(match[5]),
        parseInt(match[6])
      );
    }
    return new Date();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  close() {
    this.closed.emit();
  }
}
