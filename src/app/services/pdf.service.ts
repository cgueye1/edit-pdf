import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts, Color } from 'pdf-lib';
import { saveAs } from 'file-saver';
import { PDFField } from '../models/pdf.model';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private pdfDoc: PDFDocument | null = null;
  private originalPdfBytes: ArrayBuffer | null = null;

  // ─── Chargement ──────────────────────────────────────────────────────────

  async createBlankPdf(width = 595, height = 842): Promise<PDFDocument> {
    this.pdfDoc = await PDFDocument.create();
    this.pdfDoc.addPage([width, height]);
    this.originalPdfBytes = null;
    return this.pdfDoc;
  }

  async loadPdf(pdfBytes: ArrayBuffer): Promise<PDFDocument> {
    this.originalPdfBytes = pdfBytes.slice(0);
    this.pdfDoc = await PDFDocument.load(pdfBytes);
    return this.pdfDoc;
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  private hexToRgb(hex: string): Color {
    if (!hex || typeof hex !== 'string') return rgb(0, 0, 0);

    // Noms de couleurs CSS courants
    const named: Record<string, string> = {
      black: '#000000', white: '#ffffff', red: '#ff0000',
      green: '#00ff00', blue: '#0000ff', yellow: '#ffff00',
    };
    const lower = hex.toLowerCase().trim();
    if (named[lower]) hex = named[lower];

    hex = hex.replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return rgb(0, 0, 0);

    const n = parseInt(hex, 16);
    if (isNaN(n)) return rgb(0, 0, 0);

    return rgb(
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255,
    );
  }

  /**
   * Choisit la police standard la plus proche selon bold/italic.
   * Par défaut : Helvetica (fin, non bold) = style Calibri corps.
   */
  private async embedFont(
    doc: PDFDocument,
    bold: boolean,
    italic: boolean,
  ) {
    if (bold && italic) return doc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (bold)           return doc.embedFont(StandardFonts.HelveticaBold);
    if (italic)         return doc.embedFont(StandardFonts.HelveticaOblique);
    return               doc.embedFont(StandardFonts.Helvetica); // régulier = fin, non bold
  }

  async getPageCount(): Promise<number> {
    return this.pdfDoc ? this.pdfDoc.getPageCount() : 0;
  }

  async getPageDimensions(pageIndex: number): Promise<{ width: number; height: number }> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');
    const page = this.pdfDoc.getPages()[pageIndex];
    return { width: page.getWidth(), height: page.getHeight() };
  }

  async getPdfBytes(): Promise<Uint8Array> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');
    return this.pdfDoc.save();
  }

  clear(): void {
    this.pdfDoc = null;
    this.originalPdfBytes = null;
  }

  // ─── Méthodes de création de champs ──────────────────────────────────────

  async addTextField(
    text: string,
    x: number,
    y: number,
    pageIndex: number,
    options?: { fontSize?: number; color?: string; fontFamily?: string },
  ): Promise<PDFField> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');
    const fontSize = options?.fontSize || 12;
    const textWidth = text.length > 0 ? text.length * fontSize * 0.6 : 100;
    return {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      x, y,
      width: Math.max(textWidth, 100),
      height: Math.max(fontSize * 1.5, 24),
      value: text,
      page: pageIndex,
      fontSize,
      color: options?.color || '#000000',
    };
  }

  async addCheckbox(
    checked: boolean | string,
    x: number,
    y: number,
    pageIndex: number,
    size = 10,
    options?: { fontSize?: number },
  ): Promise<PDFField> {
    return {
      id: `checkbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'checkbox',
      x, y,
      width: size,
      height: size,
      value: checked,
      page: pageIndex,
      fontSize: size,
    };
  }

  async addImage(
    imageDataUrl: string,
    x: number,
    y: number,
    pageIndex: number,
    width = 200,
    height = 200,
  ): Promise<PDFField> {
    return {
      id: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'image',
      x, y, width, height,
      value: imageDataUrl,
      page: pageIndex,
    };
  }

  async addSignature(
    signatureDataUrl: string,
    x: number,
    y: number,
    pageIndex: number,
    width = 200,
    height = 80,
  ): Promise<PDFField> {
    return {
      id: `signature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'signature',
      x, y, width, height,
      value: signatureDataUrl,
      page: pageIndex,
    };
  }

  async addInputField(
    x: number,
    y: number,
    pageIndex: number,
    width = 200,
    height = 14,
    label?: string,
    placeholder?: string,
    options?: { fontSize?: number; color?: string },
  ): Promise<PDFField> {
    const fontSize = options?.fontSize || 12;
    const inputX = label ? x + label.length * fontSize * 0.6 + 10 : x;
    return {
      id: `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'input',
      x: inputX, y, width, height,
      value: '',
      page: pageIndex,
      fontSize,
      color: options?.color || '#000000',
      label,
      placeholder,
    };
  }

  async addTextareaField(
    x: number,
    y: number,
    pageIndex: number,
    width = 300,
    height = 80,
    label?: string,
    placeholder?: string,
    options?: { fontSize?: number; color?: string },
  ): Promise<PDFField> {
    const fontSize = options?.fontSize || 12;
    const inputX = label ? x + label.length * fontSize * 0.6 + 10 : x;
    return {
      id: `textarea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'textarea',
      x: inputX, y, width, height,
      value: '',
      page: pageIndex,
      fontSize,
      color: options?.color || '#000000',
      label,
      placeholder,
    };
  }

  // ─── EXPORT ───────────────────────────────────────────────────────────────

  async exportPdf(
    fields: PDFField[],
    filename = 'document-edite.pdf',
    preview = false,
    signed = false,
  ): Promise<Blob> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');

    let exportDoc: PDFDocument;

    if (this.originalPdfBytes) {
      // ✅ Recharger le PDF original propre — ignorer les erreurs de chiffrement
      try {
        exportDoc = await PDFDocument.load(this.originalPdfBytes, {
          ignoreEncryption: true,
        });
      } catch {
        exportDoc = await PDFDocument.load(this.originalPdfBytes);
      }
    } else {
      exportDoc = await PDFDocument.create();
      const pageCount = this.pdfDoc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        const [copiedPage] = await exportDoc.copyPages(this.pdfDoc, [i]);
        exportDoc.addPage(copiedPage);
      }
    }

    // Dessiner chaque champ
    for (const field of fields) {
      await this.drawFieldOnDoc(exportDoc, field);
    }

    const pdfBytes = await exportDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

    if (!preview || signed) {
      saveAs(blob, filename);
    }

    return blob;
  }

  // ─── Dessin d'un champ sur le PDFDocument ────────────────────────────────

  private async drawFieldOnDoc(doc: PDFDocument, field: PDFField): Promise<void> {
    const pages = doc.getPages();
    const page = pages[field.page];
    if (!page) return;

    // ✅ fontSize tel quel — pas de réduction arbitraire
    const fontSize = field.fontSize || 12;

    // ✅ Police selon bold/italic (défaut = régulier, fin, style Calibri corps)
    const font = await this.embedFont(doc, field.bold === true, field.italic === true);

    // ✅ Couleur : utiliser la couleur du champ, jamais noir par défaut sauf si vraiment absent
    const color = this.hexToRgb(field.color || '#000000');

    const x = field.x;

    switch (field.type) {

      // ── Texte / Input / Date ──────────────────────────────────────────────
      case 'text':
      case 'input':
      case 'date': {
        const text = typeof field.value === 'string' ? field.value.trim() : '';
        if (!text) break;

        // Centrage vertical : baseline = bas du champ + moitié hauteur + descente police
        // En PDF, la baseline est à ~72% de la hauteur de la police depuis le bas du glyphe
        // Pour centrer dans field.height :
        //   centre_champ = field.y + field.height / 2
        //   baseline     = centre_champ - fontSize * 0.15  (ajustement visuel)
        const y = field.y + (field.height / 2) - (fontSize * 0.15);

        // Soulignement manuel (pdf-lib ne supporte pas textDecoration)
        if (field.underline) {
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          const underlineY = y - fontSize * 0.15;
          page.drawLine({
            start: { x, y: underlineY },
            end:   { x: x + textWidth, y: underlineY },
            thickness: Math.max(fontSize * 0.06, 0.5),
            color,
          });
        }

        page.drawText(text, { x, y, size: fontSize, font, color });
        break;
      }

      // ── Textarea ──────────────────────────────────────────────────────────
      case 'textarea': {
        const text = typeof field.value === 'string' ? field.value.trim() : '';
        if (!text) break;

        const lineHeight = fontSize * 1.4;
        const lines = text.split('\n');
        // Partir du haut du champ
        const startY = field.y + field.height - fontSize;

        lines.forEach((line, i) => {
          const y = startY - i * lineHeight;
          if (y >= field.y - fontSize) {
            page.drawText(line || ' ', { x, y, size: fontSize, font, color });
          }
        });
        break;
      }

      // ── Checkbox ──────────────────────────────────────────────────────────
      case 'checkbox': {
        const size = field.fontSize || field.width || 10;
        const checkboxSize = size * 0.68;
        const thickness = Math.max(size * 0.1, 1.2);
        const bx = field.x;
        const by = field.y + (field.height - checkboxSize) / 2;

        if (field.value === true) {
          const ck = checkboxSize * 0.15;
          page.drawLine({
            start: { x: bx + ck, y: by + checkboxSize / 2 },
            end:   { x: bx + checkboxSize / 2 - ck, y: by + ck },
            color: rgb(0, 0, 0), thickness,
          });
          page.drawLine({
            start: { x: bx + checkboxSize / 2 - ck, y: by + ck },
            end:   { x: bx + checkboxSize - ck, y: by + checkboxSize - ck },
            color: rgb(0, 0, 0), thickness,
          });
        } else if (field.value === 'cross') {
          const o = checkboxSize * 0.2;
          page.drawLine({
            start: { x: bx + o, y: by + o },
            end:   { x: bx + checkboxSize - o, y: by + checkboxSize - o },
            color: rgb(0, 0, 0), thickness,
          });
          page.drawLine({
            start: { x: bx + checkboxSize - o, y: by + o },
            end:   { x: bx + o, y: by + checkboxSize - o },
            color: rgb(0, 0, 0), thickness,
          });
        }
        break;
      }

      // ── Image / Signature ─────────────────────────────────────────────────
      case 'image':
      case 'signature': {
        const dataUrl = field.value as string;
        if (!dataUrl || !dataUrl.startsWith('data:')) break;

        try {
          const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());
          const isPng = dataUrl.startsWith('data:image/png');
          const img = isPng
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);

          const imgDims   = img.scale(1);
          const imgRatio  = imgDims.width / imgDims.height;
          const fieldRatio = field.width / field.height;

          let dw = field.width,  dh = field.height;
          let dx = field.x,      dy = field.y;

          if (imgRatio > fieldRatio) {
            dh = field.width / imgRatio;
            dy = field.y + (field.height - dh) / 2;
          } else {
            dw = field.height * imgRatio;
            dx = field.x + (field.width - dw) / 2;
          }

          page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
        } catch (e) {
          console.error('Erreur image/signature', field.id, e);
        }
        break;
      }

      // ── Redact (masque blanc) ─────────────────────────────────────────────
      case 'redact': {
        page.drawRectangle({
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          color: rgb(1, 1, 1),
          borderColor: rgb(1, 1, 1),
        });
        break;
      }

      // ── Mask (même chose que redact) ──────────────────────────────────────
      case 'mask': {
        page.drawRectangle({
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          color: rgb(1, 1, 1),
          borderColor: rgb(1, 1, 1),
        });
        break;
      }
    }
  }
}
