export interface PDFField {
  id: string;
  type: 'text' | 'checkbox' | 'signature' | 'image' | 'input' | 'textarea' | 'date' | 'number' | 'email';
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | boolean | string[];
  page: number;
  rotation?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  fillModeOnly?: boolean;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  imageData?: string;
}

export interface PDFDocumentState {
  id: string;
  name: string;
  originalFile?: ArrayBuffer;
  fields: PDFField[];
  currentPage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryState {
  past: PDFDocumentState[];
  present: PDFDocumentState | null;
  future: PDFDocumentState[];
}