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
    // FIX : Conserver une COPIE des bytes originaux pour l'export
    this.originalPdfBytes = pdfBytes.slice(0);
    this.pdfDoc = await PDFDocument.load(pdfBytes);
    return this.pdfDoc;
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  private hexToRgb(hex: string): Color {
    if (!hex) return rgb(0, 0, 0);
    const colors: Record<string, string> = {
      black: '#000000', white: '#ffffff',
      red: '#ff0000',   green: '#00ff00', blue: '#0000ff',
    };
    if (colors[hex.toLowerCase()]) hex = colors[hex.toLowerCase()];
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
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

  // ─── Méthodes de création (retournent juste un PDFField, ne dessinent PLUS) ──
  // Ces méthodes ne dessinent plus sur le PDF immédiatement.
  // Le dessin se fait uniquement dans exportPdf() avec les positions finales.

  async addTextField(
    text: string, x: number, y: number, pageIndex: number,
    options?: { fontSize?: number; color?: string; fontFamily?: string }
  ): Promise<PDFField> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');
    const fontSize = options?.fontSize || 12;
    const textWidth = text.length > 0 ? text.length * fontSize * 0.6 : 100;
    return {
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text', x, y,
      width:  Math.max(textWidth, 100),
      height: Math.max(fontSize * 1.5, 24),
      value: text, page: pageIndex,
      fontSize, color: options?.color || '#000000',
    };
  }

  async addCheckbox(
    checked: boolean | string, x: number, y: number,
    pageIndex: number, size = 10, options?: { fontSize?: number }
  ): Promise<PDFField> {
    return {
      id: `checkbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'checkbox', x, y,
      width: size, height: size,
      value: checked, page: pageIndex, fontSize: size,
    };
  }

  async addImage(
    imageDataUrl: string, x: number, y: number,
    pageIndex: number, width = 200, height = 200
  ): Promise<PDFField> {
    return {
      id: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'image', x, y, width, height,
      value: imageDataUrl, page: pageIndex,
    };
  }

  async addSignature(
    signatureDataUrl: string, x: number, y: number,
    pageIndex: number, width = 200, height = 80
  ): Promise<PDFField> {
    return {
      id: `signature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'signature', x, y, width, height,
      value: signatureDataUrl, page: pageIndex,
    };
  }

  async addInputField(
    x: number, y: number, pageIndex: number,
    width = 200, height = 14,
    label?: string, placeholder?: string,
    options?: { fontSize?: number; color?: string }
  ): Promise<PDFField> {
    const fontSize = options?.fontSize || 12;
    const inputX = label ? x + (label.length * fontSize * 0.6) + 10 : x;
    return {
      id: `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'input', x: inputX, y, width, height,
      value: '', page: pageIndex, fontSize,
      color: options?.color || '#000000', label, placeholder,
    };
  }

  async addTextareaField(
    x: number, y: number, pageIndex: number,
    width = 300, height = 80,
    label?: string, placeholder?: string,
    options?: { fontSize?: number; color?: string }
  ): Promise<PDFField> {
    const fontSize = options?.fontSize || 12;
    const inputX = label ? x + (label.length * fontSize * 0.6) + 10 : x;
    return {
      id: `textarea_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'textarea', x: inputX, y, width, height,
      value: '', page: pageIndex, fontSize,
      color: options?.color || '#000000', label, placeholder,
    };
  }

  // ─── EXPORT — redessine tous les champs sur le PDF original ──────────────

  async exportPdf(fields: PDFField[], filename = 'document-edite.pdf', preview = false): Promise<Blob> {
    if (!this.pdfDoc) throw new Error('PDF non chargé');

    // FIX PRINCIPAL :
    // Repartir du PDF original (sans aucun dessin préalable),
    // puis redessiner TOUS les champs avec leurs coordonnées ACTUELLES.
    // Cela garantit que les déplacements/redimensionnements sont bien pris en compte.
    let exportDoc: PDFDocument;
    if (this.originalPdfBytes) {
      // Recharger le PDF original propre
      exportDoc = await PDFDocument.load(this.originalPdfBytes);
    } else {
      // PDF vierge créé en mémoire : copier les pages sans contenu ajouté
      exportDoc = await PDFDocument.create();
      const pageCount = this.pdfDoc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        const [copiedPage] = await exportDoc.copyPages(this.pdfDoc, [i]);
        exportDoc.addPage(copiedPage);
      }
    }

    // Redessiner chaque champ à sa position actuelle
    for (const field of fields) {
      await this.drawFieldOnDoc(exportDoc, field);
    }

    const pdfBytes   = await exportDoc.save();
    const arrayBuffer = new Uint8Array(pdfBytes).buffer;
    const blob        = new Blob([arrayBuffer], { type: 'application/pdf' });

    if (!preview) {
      saveAs(blob, filename);
    }

    return blob;
  }

  // ─── Dessin d'un champ sur un PDFDocument ────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
// pdf.service.ts — remplacez drawFieldOnDoc()
// ═══════════════════════════════════════════════════════════════════════════
//
// field.x/y sont en POINTS PDF, origin BAS-GAUCHE
// → utilisables directement avec pdf-lib (même système de coordonnées)
//
// field.y = coin INFÉRIEUR du champ
// pdf-lib drawText(y) = position de la BASELINE du texte
//
// Pour centrer le texte dans le champ :
//   y_baseline = field.y + (field.height - fontSize) / 2
//
// VÉRIFICATION avec les valeurs réelles :
//   field.y = 606.92  (après drag, coin bas du champ)
//   field.height = 20, fontSize = 18
//   y_baseline = 606.92 + (20-18)/2 = 606.92 + 1 = 607.92
//   → texte dessiné à 607.92 points depuis le bas ✓
//
// ═══════════════════════════════════════════════════════════════════════════

  private async drawFieldOnDoc(doc: PDFDocument, field: PDFField): Promise<void> {
    const pages = doc.getPages();
    const page  = pages[field.page];
    if (!page) return;

    const fontSize = field.fontSize || 12;
    const font     = await doc.embedFont(StandardFonts.Helvetica);
// Dans drawFieldOnDoc, avant de dessiner :
    const effectiveFontSize = Math.min(fontSize, field.height * 0.75);
    // 75% de la hauteur = marge confortable au-dessus et en dessous
    // field.x/y en points PDF, origin bas-gauche → direct pour pdf-lib
    const x = field.x;
    switch (field.type) {

      case 'text':
      case 'input': {
        const text = (field.value as string) || '';
        if (!text.trim()) break;

        // field.y est le coin BAS du champ en points PDF (depuis le bas de la page)
        // Dans le viewer HTML, le texte est centré verticalement grâce à alignItems: 'center'
        // Pour reproduire cela dans le PDF, on doit placer la baseline du texte
        // de manière à ce que le texte soit visuellement centré dans le champ
        //
        // Le centre visuel du champ est à field.y + field.height / 2
        // La baseline du texte doit être positionnée pour que le centre visuel du texte
        // corresponde au centre du champ. La baseline est environ à 70% de la hauteur de police
        // depuis le bas du texte, donc pour centrer visuellement :
        //   baseline = field.y + field.height / 2 + effectiveFontSize * 0.3
        const y = field.y + field.height / 2 + effectiveFontSize * 0.3;

        page.drawText(text, {
          x, y,
          size:  effectiveFontSize,
          font,
          color: this.hexToRgb(field.color || '#000000'),
        });
        break;
      }

      case 'textarea': {
        const text = (field.value as string) || '';
        if (!text.trim()) break;

        const lineHeight = effectiveFontSize * 1.3;
        const lines      = text.split('\n');

        // Partir du haut du champ (field.y + field.height) et descendre
        lines.forEach((line, i) => {
          const y = field.y + field.height - effectiveFontSize * (i + 1) - (lineHeight - fontSize) * i;
          if (y >= field.y) {
            page.drawText(line || ' ', {
              x, y,
              size:  fontSize,
              font,
              color: this.hexToRgb(field.color || '#000000'),
            });
          }
        });
        break;
      }

      case 'checkbox': {
        // Utiliser fontSize en priorité pour correspondre exactement au viewer HTML
        // La taille de l'icône dans le viewer est field.fontSize, donc on doit utiliser la même taille
        const size = field.fontSize || field.width || field.height || 10;
        const thickness = Math.max(size * 0.1, 1.2);
        const bx = field.x;
        
        // Dans le viewer HTML :
        // - Le conteneur a une hauteur de field.height (en points PDF)
        // - Le conteneur est positionné avec top = pageHeight - (field.y * scale) - (field.height * scale)
        // - field.y est donc le coin BAS du conteneur
        // - La checkbox est centrée verticalement dans le conteneur grâce à alignItems: 'center'
        // - L'icône a une taille de field.fontSize pixels
        
        // Dans le PDF :
        // - On dessine depuis le coin bas-gauche (y=0 en bas)
        // - field.y est le coin BAS du conteneur
        // - Pour centrer la checkbox dans le conteneur, on doit dessiner à field.y + (field.height - size) / 2
        // - Mais on doit utiliser field.fontSize pour la taille, pas field.width/height
        // Dans le viewer HTML :
        // - Le conteneur a une hauteur de field.height (en points PDF)
        // - L'icône FontAwesome a une taille de field.fontSize pixels
        // - L'icône est centrée verticalement dans le conteneur avec alignItems: 'center'
        // - L'icône FontAwesome a un padding interne, donc visuellement elle apparaît plus petite
        
        // Pour correspondre exactement :
        // - Utiliser field.fontSize pour la taille, mais réduire à 68% pour correspondre à la taille visuelle
        const checkboxHeight = field.height || size;
        const checkboxSize = (field.fontSize || size) * 0.68;
        
        // Le conteneur commence à field.y (coin bas) et a une hauteur de checkboxHeight
        // Dans le viewer HTML, l'icône est centrée avec alignItems: 'center'
        // Le centre visuel du conteneur est à field.y + checkboxHeight / 2
        // Pour que la checkbox soit centrée, son centre doit être à ce même point
        // Le coin bas de la checkbox est donc à : field.y + (checkboxHeight - checkboxSize) / 2
        // Ajuster légèrement vers le haut (3% de la taille) pour compenser le padding de l'icône FontAwesome
        const by = field.y + (checkboxHeight - checkboxSize) / 2 + (checkboxSize * 0.03);

        if (field.value === true) {
          // Coche ✓ - utiliser checkboxSize pour la taille réelle
          const ck = checkboxSize * 0.15;
          page.drawLine({
            start: { x: bx + ck,            y: by + checkboxSize / 2     },
            end:   { x: bx + checkboxSize / 2 - ck, y: by + ck           },
            color: rgb(0, 0, 0), thickness,
          });
          page.drawLine({
            start: { x: bx + checkboxSize / 2 - ck, y: by + ck           },
            end:   { x: bx + checkboxSize - ck,      y: by + checkboxSize - ck    },
            color: rgb(0, 0, 0), thickness,
          });
        } else if (field.value === 'cross') {
          // Croix ✗ - utiliser checkboxSize pour la taille réelle
          const crossOffset = checkboxSize * 0.2;
          page.drawLine({
            start: { x: bx + crossOffset,        y: by + crossOffset        },
            end:   { x: bx + checkboxSize - crossOffset,  y: by + checkboxSize - crossOffset },
            color: rgb(0, 0, 0), thickness,
          });
          page.drawLine({
            start: { x: bx + checkboxSize - crossOffset,  y: by + crossOffset        },
            end:   { x: bx + crossOffset,         y: by + checkboxSize - crossOffset  },
            color: rgb(0, 0, 0), thickness,
          });
        }
        break;
      }

      case 'date': {
        const text = (field.value as string) || '';
        if (!text.trim()) break;

        // Même logique que pour 'text' et 'input'
        const y = field.y + field.height / 2 + effectiveFontSize * 0.3;

        page.drawText(text, {
          x, y,
          size:  effectiveFontSize,
          font,
          color: this.hexToRgb(field.color || '#000000'),
        });
        break;
      }

      case 'mask': {
        // Dessiner un rectangle blanc pour masquer le contenu (comme files-editor.com)
        // La couleur peut être personnalisée via field.color (défaut: blanc)
        const maskColor = field.color || '#FFFFFF';
        const rgbColor = this.hexToRgb(maskColor);
        
        // Dessiner le rectangle (la rotation est gérée dans le viewer HTML uniquement)
        page.drawRectangle({
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          color: rgbColor,
          borderColor: rgbColor,
          borderWidth: 0,
        });
        break;
      }

      case 'image':
      case 'signature': {
        const dataUrl = field.value as string;
        if (!dataUrl) break;
        try {
          const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());
          const img   = dataUrl.startsWith('data:image/png')
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
          
          // Conserver le ratio d'aspect de l'image
          const imgDims = img.scale(1);
          const imgRatio = imgDims.width / imgDims.height;
          const fieldRatio = field.width / field.height;
          
          let drawWidth = field.width;
          let drawHeight = field.height;
          let drawX = field.x;
          let drawY = field.y;
          
          // Ajuster pour conserver le ratio
          if (imgRatio > fieldRatio) {
            // Image plus large que le champ
            drawHeight = field.width / imgRatio;
            drawY = field.y + (field.height - drawHeight) / 2;
          } else {
            // Image plus haute que le champ
            drawWidth = field.height * imgRatio;
            drawX = field.x + (field.width - drawWidth) / 2;
          }
          
          page.drawImage(img, {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight,
          });
        } catch (e) {
          console.error('Erreur image/signature', field.id, e);
        }
        break;
      }
    }
  }

}
