export interface PDFField {
  id: string;
  type: 'text' | 'checkbox' | 'signature' | 'image' | 'input' | 'textarea' | 'date' | 'number' | 'email' | 'redact' | 'mask';
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
  /** Opacité pour dessin/surlignage */
  opacity?: number;
  /** Indique que ce champ est une annotation de dessin (ligne, flèche, rectangle, cercle, surlignage) */
  isAnnotation?: boolean;
  /** Indique que cette annotation est un surlignage */
  isHighlight?: boolean;
  /** Mode de fusion pour le surligneur (Multiply = type PDFAid, texte teinté) */
  blendMode?: 'normal' | 'multiply';
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
