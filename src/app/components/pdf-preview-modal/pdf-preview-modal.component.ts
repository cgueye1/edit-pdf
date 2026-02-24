import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-pdf-preview-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close()" [@fadeIn]>
      <div class="modal-container" (click)="$event.stopPropagation()" [@slideUp]>
        
        <div class="modal-header">
          <h2><i class="fas fa-eye"></i> Aperçu du PDF</h2>
          <button class="btn-close" (click)="close()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <iframe *ngIf="pdfUrl" [src]="safePdfUrl" class="pdf-iframe"></iframe>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-container {
      width: 90vw;
      height: 90vh;
      max-width: 1200px;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: #f7fafc;
      flex-shrink: 0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a202c;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .modal-header i {
      color: #3182ce;
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
      flex: 1;
      overflow: hidden;
      background: #525252;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .pdf-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    @media (max-width: 768px) {
      .modal-container {
        width: 95vw;
        height: 95vh;
      }
      
      .modal-body {
        padding: 10px;
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
        style({ transform: 'scale(0.95)', opacity: 0 }),
        animate('250ms cubic-bezier(0.34,1.56,0.64,1)', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('180ms ease', style({ transform: 'scale(0.95)', opacity: 0 }))
      ])
    ])
  ]
})
export class PdfPreviewModalComponent {
  @Input() isOpen = false;
  @Input() pdfUrl: string = '';
  @Output() closed = new EventEmitter<void>();

  safePdfUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges() {
    if (this.pdfUrl) {
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl);
    }
  }

  close() {
    this.closed.emit();
  }
}
