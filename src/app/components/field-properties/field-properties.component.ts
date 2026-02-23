import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PDFField } from '../../models/pdf.model';

@Component({
  selector: 'app-field-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './field-properties.component.html',
  styleUrls: ['./field-properties.component.css']
})
export class FieldPropertiesComponent implements OnChanges {
  @Input() field: PDFField | null = null;
  @Output() fieldUpdated = new EventEmitter<PDFField>();
  @Output() fieldDeleted = new EventEmitter<string>();

  fieldTypes: string[] = ['text', 'checkbox', 'input', 'textarea', 'image', 'signature'];

  editedField: PDFField | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['field'] && this.field) {
      this.editedField = { 
        ...this.field,
        validation: this.field.validation || {}
      };
    } else if (!this.field) {
      this.editedField = null;
    }
  }

  updateField(): void {
    if (this.editedField) {
      this.fieldUpdated.emit(this.editedField);
    }
  }

  deleteField(): void {
    if (this.field) {
      if (confirm(`Voulez-vous vraiment supprimer ce champ ?`)) {
        this.fieldDeleted.emit(this.field.id);
      }
    }
  }

  onFieldTypeChange(type: string): void {
    if (this.editedField) {
      this.editedField.type = type as any;
      this.updateField();
    }
  }

  onRequiredChange(required: boolean): void {
    if (this.editedField) {
      this.editedField.required = required;
      if (!this.editedField.validation) {
        this.editedField.validation = {};
      }
      this.editedField.validation.required = required;
      this.updateField();
    }
  }

  onMinLengthChange(value: number | null): void {
    if (this.editedField) {
      if (!this.editedField.validation) {
        this.editedField.validation = {};
      }
      this.editedField.validation.minLength = value || undefined;
      this.updateField();
    }
  }

  onMaxLengthChange(value: number | null): void {
    if (this.editedField) {
      if (!this.editedField.validation) {
        this.editedField.validation = {};
      }
      this.editedField.validation.maxLength = value || undefined;
      this.updateField();
    }
  }

  onMinChange(value: number | null): void {
    if (this.editedField) {
      if (!this.editedField.validation) {
        this.editedField.validation = {};
      }
      this.editedField.validation.min = value || undefined;
      this.updateField();
    }
  }

  onMaxChange(value: number | null): void {
    if (this.editedField) {
      if (!this.editedField.validation) {
        this.editedField.validation = {};
      }
      this.editedField.validation.max = value || undefined;
      this.updateField();
    }
  }
}



