import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas 
      #drawingCanvas
      [width]="width"
      [height]="height"
      [style.cursor]="getCursor()"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp($event)"
      (mouseleave)="onMouseUp($event)"
      class="drawing-canvas">
    </canvas>
    
    <div class="drawing-toolbar" *ngIf="drawingTool && drawingTool !== 'mask'">
      <div class="toolbar-group">
        <label>Couleur:</label>
        <input type="color" [(ngModel)]="drawingColor" (change)="updateDrawingStyle()">
      </div>
      <div class="toolbar-group">
        <label>Épaisseur:</label>
        <input type="range" min="1" max="20" [(ngModel)]="lineWidth" (input)="updateDrawingStyle()">
        <span>{{lineWidth}}px</span>
      </div>
      <div class="toolbar-group" *ngIf="drawingTool === 'highlight'">
        <label>Opacité:</label>
        <input type="range" min="0.1" max="1" step="0.1" [(ngModel)]="opacity" (input)="updateDrawingStyle()">
        <span>{{Math.round(opacity * 100)}}%</span>
      </div>
      <button class="btn-finish" (click)="finishDrawing()">
        <i class="fas fa-check"></i> Terminer
      </button>
      <button class="btn-cancel" (click)="cancelDrawing()">
        <i class="fas fa-times"></i> Annuler
      </button>
    </div>
  `,
  styles: [`
    .drawing-canvas {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000;
      pointer-events: auto;
    }

    .drawing-toolbar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 2000;
    }

    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .toolbar-group label {
      font-weight: 500;
      color: #4a5568;
    }

    .toolbar-group input[type="color"] {
      width: 40px;
      height: 32px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
    }

    .toolbar-group input[type="range"] {
      width: 100px;
    }

    .btn-finish, .btn-cancel {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-finish {
      background: #48bb78;
      color: white;
    }

    .btn-finish:hover {
      background: #38a169;
    }

    .btn-cancel {
      background: #f56565;
      color: white;
    }

    .btn-cancel:hover {
      background: #e53e3e;
    }
  `]
})
export class DrawingCanvasComponent implements AfterViewInit {
  @ViewChild('drawingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() width = 800;
  @Input() height = 1000;
  @Input() drawingTool: string | null = null;
  @Input() scale = 1;
  @Input() pageHeightPx = 0; // Hauteur du canvas PDF en pixels (viewport.height)
  @Output() drawingComplete = new EventEmitter<string | { x: number, y: number, width: number, height: number }>();
  @Output() drawingCancelled = new EventEmitter<void>();

  Math = Math;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private endX = 0;
  private endY = 0;
  private currentPath: { x: number, y: number }[] = [];

  drawingColor = '#FFFF00';
  lineWidth = 3;
  opacity = 0.5;

  // Pour l'outil masquage, utiliser blanc par défaut (comme files-editor.com)
  get effectiveColor(): string {
    return this.drawingTool === 'mask' ? '#FFFFFF' : this.drawingColor;
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.updateDrawingStyle();
  }

  getCursor(): string {
    if (!this.drawingTool) return 'default';
    if (this.drawingTool === 'draw') return 'crosshair';
    if (this.drawingTool === 'highlight') return 'text';
    if (this.drawingTool === 'mask') return 'crosshair';
    return 'crosshair';
  }

  updateDrawingStyle() {
    if (!this.ctx) return;
    this.ctx.strokeStyle = this.effectiveColor;
    this.ctx.fillStyle = this.effectiveColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = this.drawingTool === 'highlight' ? this.opacity : 1;
  }

  onMouseDown(event: MouseEvent) {
    if (!this.drawingTool) return;

    this.isDrawing = true;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;

    if (this.drawingTool === 'draw' || this.drawingTool === 'highlight') {
      this.currentPath = [{ x: this.startX, y: this.startY }];
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing || !this.drawingTool) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    if (this.drawingTool === 'draw' || this.drawingTool === 'highlight') {
      this.currentPath.push({ x: currentX, y: currentY });
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
    } else if (this.drawingTool === 'mask') {
      // Pour le masquage, redessiner le rectangle à chaque mouvement
      this.redrawCanvas();
      this.drawShape(this.startX, this.startY, currentX, currentY);
    } else {
      // Pour les autres formes, redessiner à chaque mouvement
      this.redrawCanvas();
      this.drawShape(this.startX, this.startY, currentX, currentY);
    }
  }

  onMouseUp(event: MouseEvent) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.drawingTool === 'mask') {
      // Pour l'outil masque, créer le masque directement au relâchement de la souris
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      this.endX = event.clientX - rect.left;
      this.endY = event.clientY - rect.top;

      // Vérifier qu'on a bien dessiné quelque chose (pas juste un clic)
      if (Math.abs(this.endX - this.startX) > 5 || Math.abs(this.endY - this.startY) > 5) {
        // Créer le masque directement
        this.createMask();
      }
      this.clearCanvas();
    } else if (this.drawingTool === 'line' || this.drawingTool === 'arrow' ||
      this.drawingTool === 'rectangle' || this.drawingTool === 'circle') {
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      this.endX = event.clientX - rect.left;
      this.endY = event.clientY - rect.top;
      this.drawShape(this.startX, this.startY, this.endX, this.endY);
    }
  }

  private redrawCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private drawShape(x1: number, y1: number, x2: number, y2: number) {
    this.ctx.beginPath();

    switch (this.drawingTool) {
      case 'line':
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        break;

      case 'arrow':
        this.drawArrow(x1, y1, x2, y2);
        break;

      case 'rectangle':
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;

      case 'mask':
        // Dessiner un rectangle noir rempli pour masquer le contenu (comme files-editor.com)
        this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        break;

      case 'circle':
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        this.ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        break;
    }
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number) {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Ligne principale
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Pointe de la flèche
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  private createMask() {
    // Pour le masquage, envoyer les coordonnées en points PDF
    // Utiliser exactement la même logique que dans getFieldStyle et onCanvasClick

    // Coordonnées X et dimensions (simples, pas besoin d'inversion)
    const x = Math.min(this.startX, this.endX) / this.scale;
    const width = Math.abs(this.endX - this.startX) / this.scale;
    const height = Math.abs(this.endY - this.startY) / this.scale;

    // Convertir Y : canvas (haut=0) vers PDF (bas=0)
    // Dans getFieldStyle: top_px = pageHeight - (field.y * scale) - height_px
    // Donc: field.y = (pageHeight - top_px - height_px) / scale
    // 
    // Dans onCanvasClick: y_pt = (pageHeight - clickY_px) / scale
    // Pour un rectangle, field.y est la position du coin BAS
    // 
    // Le canvas de dessin a exactement la même taille que le canvas PDF
    // this.height = pageHeight du viewer (en pixels)
    const top_px = Math.min(this.startY, this.endY);
    const height_px = Math.abs(this.endY - this.startY);

    // Utiliser this.height qui est la hauteur du canvas de dessin (identique au canvas PDF)
    // C'est la même valeur que this.pageHeight dans le viewer
    const pageHeight = this.height;

    // Calculer field.y (position du coin BAS en points PDF)
    // En inversant la formule de getFieldStyle:
    // top_px = pageHeight - (field.y * scale) - height_px
    // field.y = (pageHeight - top_px - height_px) / scale
    const y = (pageHeight - top_px - height_px) / this.scale;

    this.drawingComplete.emit({ x, y, width, height });
  }

  finishDrawing() {
    if (this.drawingTool === 'mask') {
      // Ne devrait pas arriver car le masque est créé directement dans onMouseUp
      this.createMask();
    } else {
      // Pour les autres outils, envoyer l'image
      const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
      this.drawingComplete.emit(dataUrl);
    }
    this.clearCanvas();
  }

  cancelDrawing() {
    this.clearCanvas();
    this.drawingCancelled.emit();
  }

  private clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.currentPath = [];
  }
}
