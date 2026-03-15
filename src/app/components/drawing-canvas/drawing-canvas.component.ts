import {
  Component, Input, Output, EventEmitter,
  ViewChild, ElementRef, AfterViewInit, OnChanges,
  SimpleChanges, HostListener, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <canvas
      #drawingCanvas
      [width]="width"
      [height]="height"
      [style.cursor]="getCursor()"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp($event)"
      (mouseleave)="onMouseLeave($event)"
      class="drawing-canvas">
    </canvas>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      z-index: 100;
      pointer-events: none;
    }
    .drawing-canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: auto;
    }
  `]
})
export class DrawingCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('drawingCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() width = 800;
  @Input() height = 1000;
  @Input() drawingTool: string | null = null;
  @Input() scale = 1.5;
  @Input() drawingColorInput = '#FFFF00';
  @Input() drawingLineWidthInput = 16;
  @Input() drawingOpacityInput = 0.4;

  @Output() drawingComplete = new EventEmitter<
    | string
    | { x: number; y: number; width: number; height: number }
    | { dataUrl: string; x: number; y: number; width: number; height: number }
  >();
  @Output() drawingCancelled = new EventEmitter<void>();
  @Output() drawingOptionsChange = new EventEmitter<{ color?: string; lineWidth?: number; opacity?: number }>();

  // ─── état interne ─────────────────────────────────────────────────────────
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private endX = 0;
  private endY = 0;
  private currentPath: { x: number; y: number }[] = [];
  private lastMoveX = 0;
  private lastMoveY = 0;
  private rafPending = false;

  // couleur / style courants
  drawingColor  = '#FFFF00';
  lineWidth     = 16;
  opacity       = 0.4;

  Math = Math;

  // ─── lifecycle ────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['drawingColorInput']?.currentValue)
      this.drawingColor = changes['drawingColorInput'].currentValue;
    if (changes['drawingLineWidthInput']?.currentValue > 0)
      this.lineWidth = changes['drawingLineWidthInput'].currentValue;
    if (changes['drawingOpacityInput']?.currentValue >= 0)
      this.opacity = changes['drawingOpacityInput'].currentValue;
    if (this.ctx) this.applyStyle();
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.applyStyle();
  }

  ngOnDestroy(): void {}

  // ─── curseur ──────────────────────────────────────────────────────────────

  getCursor(): string {
    if (!this.drawingTool) return 'default';

    if (this.drawingTool === 'highlight') {
      // Curseur : I-beam (curseur texte) avec halo de points couleur surlignage autour
      const dotColor = encodeURIComponent(this.drawingColor);
      const size = 32;
      const cx = size / 2;
      const cy = size / 2;
      const r = 2;        // rayon des points
      const orbit = 11;   // distance du centre
      const svg = `
        <svg fill="#000000" height="187px" width="187px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-315.25 -315.25 1115.50 1115.50" xml:space="preserve" stroke="#000000" stroke-width="0.00485" transform="matrix(1, 0, 0, 1, 0, 0)"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC" stroke-width="9.7"></g><g id="SVGRepo_iconCarrier"> <polygon points="312.274,30 312.274,0 172.726,0 172.726,30 227.5,30 227.5,227.5 202.5,227.5 202.5,257.5 227.5,257.5 227.5,455 172.726,455 172.726,485 312.274,485 312.274,455 257.5,455 257.5,257.5 282.5,257.5 282.5,227.5 257.5,227.5 257.5,30 "></polygon> </g></svg>`.trim();
      const encoded = `data:image/svg+xml;base64,${btoa(svg)}`;
      return `url("${encoded}") ${cx} ${cy}, text`;
    }

    if (this.drawingTool === 'draw') return 'crosshair';
    if (this.drawingTool === 'mask') return 'crosshair';
    return 'crosshair';
  }

  // ─── style canvas ─────────────────────────────────────────────────────────

  private applyStyle(): void {
    if (!this.ctx) return;
    const isHL = this.drawingTool === 'highlight';

    this.ctx.strokeStyle = this.drawingColor;
    this.ctx.fillStyle   = this.drawingColor;
    this.ctx.lineWidth   = isHL ? Math.max(this.lineWidth, 12) : this.lineWidth;
    this.ctx.lineCap     = isHL ? 'butt' : 'round';
    this.ctx.lineJoin    = 'round';

    if (isHL) {
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.globalAlpha = Math.min(Math.max(this.opacity, 0.15), 0.7);
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.globalAlpha = 1;
    }
  }

  // ─── événements souris ───────────────────────────────────────────────────

  onMouseDown(event: MouseEvent): void {
    if (!this.drawingTool) return;
    event.preventDefault();

    this.isDrawing = true;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;

    this.applyStyle();

    if (this.drawingTool === 'highlight') {
      this.currentPath = [{ x: this.startX, y: this.startY }];
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);

    } else if (this.drawingTool === 'draw') {
      this.currentPath = [{ x: this.startX, y: this.startY }];
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDrawing || !this.drawingTool) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    if (this.drawingTool === 'highlight' || this.drawingTool === 'draw') {
      this.lastMoveX = cx;
      this.lastMoveY = cy;
      if (!this.rafPending) {
        this.rafPending = true;
        requestAnimationFrame(() => this.drawSegment());
      }
    } else {
      this.redrawCanvas();
      this.drawShape(this.startX, this.startY, cx, cy);
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.endX = event.clientX - rect.left;
    this.endY = event.clientY - rect.top;

    if (this.drawingTool === 'mask') {
      if (Math.abs(this.endX - this.startX) > 5 || Math.abs(this.endY - this.startY) > 5) {
        this.createMask();
      }
      this.clearCanvas();
      return;
    }

    if (this.drawingTool === 'highlight' || this.drawingTool === 'draw') {
      if (this.currentPath.length > 1) this.finishDrawing();
      else this.clearCanvas();
      return;
    }

    if (['line', 'arrow', 'rectangle', 'circle'].includes(this.drawingTool!)) {
      this.drawShape(this.startX, this.startY, this.endX, this.endY);
      this.finishDrawing();
    }
  }

  onMouseLeave(event: MouseEvent): void {
    if (this.isDrawing && this.drawingTool !== 'highlight' && this.drawingTool !== 'draw') {
      this.onMouseUp(event);
    }
  }

  // ─── Dessin segment par segment (rAF) ─────────────────────────────────────

  private drawSegment(): void {
    this.rafPending = false;
    if (!this.ctx || !this.drawingTool || this.currentPath.length === 0) return;

    const x = this.lastMoveX;
    const y = this.lastMoveY;
    const last = this.currentPath[this.currentPath.length - 1];
    if (Math.abs(last.x - x) < 0.3 && Math.abs(last.y - y) < 0.3) return;

    if (this.drawingTool === 'highlight') {
      // ✅ FIX : Y est verrouillé sur startY → trait horizontal parfaitement droit
      const hl = Math.max(this.lineWidth, 12);
      const fixedY = this.startY; // ← clé du fix : on ignore le Y de la souris
      this.ctx.lineWidth = hl;
      this.ctx.lineCap   = 'butt';
      this.ctx.lineJoin  = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(last.x, fixedY);
      this.ctx.lineTo(x, fixedY);
      this.ctx.stroke();
      // On stocke le vrai x mais fixedY pour garder la trace horizontale
      this.currentPath.push({ x, y: fixedY });

    } else if (this.drawingTool === 'draw') {
      // Dessin libre : réappliquer le style puis redessiner tout le tracé (plus fiable)
      this.applyStyle();
      this.currentPath.push({ x, y });
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
      for (let i = 1; i < this.currentPath.length; i++) {
        this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
      }
      this.ctx.stroke();
    }
  }

  // ─── Formes ───────────────────────────────────────────────────────────────

  private redrawCanvas(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private drawShape(x1: number, y1: number, x2: number, y2: number): void {
    this.applyStyle();
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
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.setLineDash([]);
        this.applyStyle();
        break;

      case 'circle':
        const r = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        this.ctx.arc(x1, y1, r, 0, 2 * Math.PI);
        this.ctx.stroke();
        break;
    }
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number): void {
    const headLen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();
  }

  // ─── Finalisation ─────────────────────────────────────────────────────────

  finishDrawing(): void {
    const pad = Math.ceil(Math.max(this.lineWidth, 12)) + 8;

    if (['line', 'arrow', 'rectangle', 'circle'].includes(this.drawingTool!)) {
      let minX: number, minY: number, w: number, h: number;

      if (this.drawingTool === 'circle') {
        const r = Math.sqrt(Math.pow(this.endX - this.startX, 2) + Math.pow(this.endY - this.startY, 2));
        minX = this.startX - r - pad;
        minY = this.startY - r - pad;
        w = 2 * r + 2 * pad;
        h = 2 * r + 2 * pad;
      } else {
        minX = Math.min(this.startX, this.endX) - pad;
        minY = Math.min(this.startY, this.endY) - pad;
        w = Math.abs(this.endX - this.startX) + 2 * pad;
        h = Math.abs(this.endY - this.startY) + 2 * pad;
      }

      this.emitCroppedRegion(
        Math.max(0, minX), Math.max(0, minY),
        Math.min(w, this.width), Math.min(h, this.height)
      );
      return;
    }

    if ((this.drawingTool === 'highlight' || this.drawingTool === 'draw') && this.currentPath.length > 1) {
      let pxMin = this.currentPath[0].x, pyMin = this.currentPath[0].y;
      let pxMax = pxMin, pyMax = pyMin;
      this.currentPath.forEach(p => {
        pxMin = Math.min(pxMin, p.x); pyMin = Math.min(pyMin, p.y);
        pxMax = Math.max(pxMax, p.x); pyMax = Math.max(pyMax, p.y);
      });

      const hlHeight = this.drawingTool === 'highlight' ? Math.max(this.lineWidth, 12) : undefined;
      // ✅ FIX décalage : this.startY = Y exact du trait horizontal, pas pyMin qui peut dériver
      const cropMinY = hlHeight
        ? Math.max(0, this.startY - hlHeight / 2 - 2)
        : Math.max(0, pyMin - pad);
      let cropH = hlHeight
        ? hlHeight + 4
        : Math.min(this.height - cropMinY, Math.max(pyMax - pyMin + 2 * pad, 2 * pad));
      let cropW = Math.min(this.width, Math.max(pxMax - pxMin + 2 * pad, 2 * pad));
      // Pour le dessin libre : garantir une taille minimale pour que emitCroppedRegion émette (w/h >= 1)
      if (this.drawingTool === 'draw') {
        const minSize = 2 * pad;
        cropW = Math.min(this.width, Math.max(cropW, minSize));
        cropH = Math.min(this.height - cropMinY, Math.max(cropH, minSize));
      }

      this.emitCroppedRegion(
        Math.max(0, pxMin - pad),
        cropMinY,
        cropW,
        cropH,
      );
      return;
    }

    this.drawingComplete.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
    this.clearCanvas();
  }

  private emitCroppedRegion(minX: number, minY: number, w: number, h: number): void {
    if (w < 1 || h < 1) { this.clearCanvas(); return; }

    const cropped = this.cropRegion(minX, minY, w, h);
    if (cropped) {
      this.drawingComplete.emit({
        dataUrl: cropped,
        x:      minX / this.scale,
        y:      (this.height - minY - h) / this.scale,
        width:  w / this.scale,
        height: h / this.scale,
      });
    }
    this.clearCanvas();
  }

  private cropRegion(minX: number, minY: number, w: number, h: number): string | null {
    const src = this.canvasRef.nativeElement;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx2 = off.getContext('2d');
    if (!ctx2) return null;
    ctx2.drawImage(src, minX, minY, w, h, 0, 0, w, h);
    return off.toDataURL('image/png');
  }

  private clearCanvas(): void {
    if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
    this.currentPath = [];
  }

  private createMask(): void {
    const x      = Math.min(this.startX, this.endX) / this.scale;
    const w      = Math.abs(this.endX - this.startX) / this.scale;
    const h      = Math.abs(this.endY - this.startY) / this.scale;
    const top_px = Math.min(this.startY, this.endY);
    const h_px   = Math.abs(this.endY - this.startY);
    const y      = (this.height - top_px - h_px) / this.scale;
    this.drawingComplete.emit({ x, y, width: w, height: h });
  }

  cancelDrawing(): void {
    this.clearCanvas();
    this.drawingCancelled.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.clearCanvas();
    }
  }
}
