import { Component, Output, EventEmitter, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pdf-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-toolbar.component.html',
  styleUrls: ['./pdf-toolbar.component.css']
})
export class PdfToolbarComponent {

  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() totalPages = 0;
  @Input() currentPage = 1;
  @Input() showTextProperties = false;
  @Input() textProperties = {
    fontSize: 11,
    color: '#333333',
    fontFamily: 'Calibri',
    backgroundColor: 'transparent',
    textAlign: 'left',
    verticalAlign: 'top',
    bold: false,
    italic: false,
    underline: false
  };
  @Input() drawingOptions: { color: string; lineWidth: number; opacity: number; blendMode?: 'normal' | 'multiply' } = {
    color: '#FFFF00',
    lineWidth: 14,
    opacity: 0.35,
    blendMode: 'multiply',
  };
  @Input() activeTool: string | null = null;

  @Output() toolSelected = new EventEmitter<string>();
  @Output() undo = new EventEmitter<void>();
  @Output() redo = new EventEmitter<void>();
  @Output() export = new EventEmitter<void>();
  @Output() preview = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() load = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() textPropertiesChange = new EventEmitter<any>();
  @Output() toggleProperties = new EventEmitter<void>();
  @Output() drawingOptionsChange = new EventEmitter<{ color?: string; lineWidth?: number; opacity?: number; blendMode?: 'normal' | 'multiply' }>();

  // ── État dropdown dessin ──────────────────────────────────────────────────
  showDrawingDropdown = false;
  showPreview = false;
  Math = Math;
  parseInt = parseInt;
  parseFloat = parseFloat;

  /** Outils qui font partie du groupe "dessin" */
  readonly DRAWING_TOOLS = ['highlight', 'draw', 'line', 'arrow', 'rectangle', 'circle', 'eraser'];

  /** Palettes de couleurs rapides */
  colorSwatches = [
    '#FFFF00', '#FFD700', '#FF6B35', '#E63946',
    '#2196F3', '#4CAF50', '#9C27B0', '#000000',
  ];

  isDrawingToolActive(): boolean {
    return !!this.activeTool && this.DRAWING_TOOLS.includes(this.activeTool);
  }

  getActiveDrawIcon(): string {
    const icons: Record<string, string> = {
      highlight: 'fa-highlighter',
      draw: 'fa-pen',
      line: 'fa-minus',
      arrow: 'fa-long-arrow-alt-right',
      rectangle: 'fa-square',
      circle: 'fa-circle',
      eraser: 'fa-eraser',
    };
    if (this.activeTool && icons[this.activeTool]) return icons[this.activeTool];
    return 'fa-pencil-alt';
  }

  getActiveDrawLabel(): string {
    const labels: Record<string, string> = {
      highlight: 'Surligner',
      draw: 'Dessin',
      line: 'Ligne',
      arrow: 'Flèche',
      rectangle: 'Rectangle',
      circle: 'Cercle',
      eraser: 'Effaceur',
    };
    if (this.activeTool && labels[this.activeTool]) return labels[this.activeTool];
    return 'Dessiner';
  }

  toggleDrawingDropdown(): void {
    this.showDrawingDropdown = !this.showDrawingDropdown;
  }

  /** Fermer le dropdown si clic en dehors */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.draw-dropdown-wrapper')) {
      this.showDrawingDropdown = false;
    }
  }

  selectDrawTool(tool: string): void {
    this.activeTool = tool;
    this.toolSelected.emit(tool);
    // Garder le dropdown ouvert pour changer les options facilement
    // sauf pour l'effaceur qui n'a pas d'options
    if (tool === 'eraser') {
      this.showDrawingDropdown = false;
    }
  }

  // ── Options de dessin ─────────────────────────────────────────────────────

  onDrawingColorChange(value: string): void {
    this.drawingOptions = { ...this.drawingOptions, color: value };
    this.drawingOptionsChange.emit({ color: value });
  }

  onDrawingLineWidthChange(value: number): void {
    this.drawingOptions = { ...this.drawingOptions, lineWidth: value };
    this.drawingOptionsChange.emit({ lineWidth: value });
  }

  onDrawingOpacityChange(value: number): void {
    this.drawingOptions = { ...this.drawingOptions, opacity: value };
    this.drawingOptionsChange.emit({ opacity: value });
  }



  // ── Outils principaux ─────────────────────────────────────────────────────

  selectTool(tool: string): void {
    this.activeTool = tool;
    this.showDrawingDropdown = false;
    this.toolSelected.emit(tool);
  }

  onUndo(): void { this.undo.emit(); }
  onRedo(): void { this.redo.emit(); }
  onExport(): void { this.export.emit(); }
  onPreview(): void { this.preview.emit(); }
  onSave(): void { this.save.emit(); }
  onLoad(): void { this.load.emit(); }
  onClear(): void { this.clear.emit(); }
  onToggleProperties(): void { this.toggleProperties.emit(); }

  // ── Pages ─────────────────────────────────────────────────────────────────

  openPreview(): void {
    this.showPreview = true;
  }
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.onPageChange(this.currentPage + 1);
  }

  previousPage(): void {
    if (this.currentPage > 1) this.onPageChange(this.currentPage - 1);
  }

  // ── Propriétés texte ──────────────────────────────────────────────────────

  fontFamilies = [
    'Calibri', 'Calibri Light',
    'Helvetica', 'Helvetica-Bold',
    'Times-Roman', 'Times-Bold',
    'Courier', 'Arial', 'Verdana', 'Georgia',
  ];
  fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  textAlignments = [
    { value: 'left',    icon: 'align-left',    label: 'Gauche'  },
    { value: 'center',  icon: 'align-center',  label: 'Centre'  },
    { value: 'right',   icon: 'align-right',   label: 'Droite'  },
    { value: 'justify', icon: 'align-justify', label: 'Justifié'},
  ];
  verticalAlignments = [
    { value: 'top',    icon: 'arrow-up',      label: 'Haut'   },
    { value: 'middle', icon: 'arrows-alt-v',  label: 'Milieu' },
    { value: 'bottom', icon: 'arrow-down',    label: 'Bas'    },
  ];

  onFontSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.textProperties.fontSize = parseInt(select.value, 10);
    this.textPropertiesChange.emit(this.textProperties);
  }
  onColorChange(event: Event): void {
    this.textProperties.color = (event.target as HTMLInputElement).value;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onFontFamilyChange(event: Event): void {
    this.textProperties.fontFamily = (event.target as HTMLSelectElement).value;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onBackgroundColorChange(event: Event): void {
    this.textProperties.backgroundColor = (event.target as HTMLInputElement).value;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onTextAlignChange(align: string): void {
    this.textProperties.textAlign = align;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onVerticalAlignChange(align: string): void {
    this.textProperties.verticalAlign = align;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onBoldToggle(): void {
    this.textProperties.bold = !this.textProperties.bold;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onItalicToggle(): void {
    this.textProperties.italic = !this.textProperties.italic;
    this.textPropertiesChange.emit(this.textProperties);
  }
  onUnderlineToggle(): void {
    this.textProperties.underline = !this.textProperties.underline;
    this.textPropertiesChange.emit(this.textProperties);
  }
}
