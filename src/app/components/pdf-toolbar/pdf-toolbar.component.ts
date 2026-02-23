import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pdf-toolbar',
  standalone: true,          // <-- rendu standalone
  imports: [CommonModule, FormsModule], // <-- modules nécessaires pour ngIf, ngFor, ngModel
  templateUrl: './pdf-toolbar.component.html',
  styleUrls: ['./pdf-toolbar.component.scss']
})
export class PdfToolbarComponent {
  @Input() canUndo = false;
  @Input() canRedo = false;
  @Input() totalPages = 0;
  @Input() currentPage = 1;
  @Input() showTextProperties = false;
  @Input() textProperties = {
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Helvetica',
    backgroundColor: 'transparent',
    textAlign: 'left',
    verticalAlign: 'top',
    bold: false,
    italic: false,
    underline: false
  };

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

  // Options disponibles
  fontFamilies = [
    'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
    'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
    'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
    'Arial', 'Arial-Bold', 'Arial-Italic', 'Arial-BoldItalic',
    'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Impact'
  ];
  fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  textAlignments = [
    { value: 'left', icon: 'align-left', label: 'Gauche' },
    { value: 'center', icon: 'align-center', label: 'Centre' },
    { value: 'right', icon: 'align-right', label: 'Droite' },
    { value: 'justify', icon: 'align-justify', label: 'Justifié' }
  ];
  verticalAlignments = [
    { value: 'top', icon: 'arrow-up', label: 'Haut' },
    { value: 'middle', icon: 'arrows-alt-v', label: 'Milieu' },
    { value: 'bottom', icon: 'arrow-down', label: 'Bas' }
  ];

  activeTool: string | null = null;
  showSavedDocuments = false;

  selectTool(tool: string): void {
    this.activeTool = tool;
    this.toolSelected.emit(tool);
  }

  onUndo(): void { this.undo.emit(); }
  onRedo(): void { this.redo.emit(); }
  onExport(): void { this.export.emit(); }
  onPreview(): void { this.preview.emit(); }
  onSave(): void { this.save.emit(); }
  onLoad(): void { this.load.emit(); }
  onClear(): void { this.clear.emit(); }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }

  onFontSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.textProperties.fontSize = parseInt(select.value, 10);
    this.textPropertiesChange.emit(this.textProperties);
  }

  onColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.textProperties.color = input.value;
    this.textPropertiesChange.emit(this.textProperties);
  }

  onFontFamilyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.textProperties.fontFamily = select.value;
    this.textPropertiesChange.emit(this.textProperties);
  }

  onBackgroundColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.textProperties.backgroundColor = input.value;
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

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.onPageChange(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.onPageChange(this.currentPage - 1);
    }
  }

  onToggleProperties(): void {
    this.toggleProperties.emit();
  }
}
