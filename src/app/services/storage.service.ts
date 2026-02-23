import { Injectable } from '@angular/core';
import { PDFDocumentState } from '../models/pdf.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STORAGE_KEY = 'pdfEditorDocuments';

  saveDocument(document: PDFDocumentState): void {
    const documents = this.getAllDocuments();
    const existingIndex = documents.findIndex(doc => doc.id === document.id);
    
    const documentToSave = {
      ...document,
      originalFile: undefined // Ne pas sauvegarder le PDF
    };
    
    if (existingIndex !== -1) {
      documents[existingIndex] = documentToSave as any;
    } else {
      documents.push(documentToSave as any);
    }

    if (documents.length > 10) {
      documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      documents.splice(10);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(documents));
  }

  getAllDocuments(): PDFDocumentState[] {
    const documentsJson = localStorage.getItem(this.STORAGE_KEY);
    if (!documentsJson) return [];

    try {
      const documents = JSON.parse(documentsJson);
      return documents.map((doc: any) => ({
        ...doc,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt)
      }));
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
      return [];
    }
  }

  getDocument(id: string): PDFDocumentState | null {
    const documents = this.getAllDocuments();
    return documents.find(doc => doc.id === id) || null;
  }

  deleteDocument(id: string): void {
    const documentsJson = localStorage.getItem(this.STORAGE_KEY);
    if (!documentsJson) return;
    
    try {
      const documents = JSON.parse(documentsJson);
      const filteredDocuments = documents.filter((doc: any) => doc.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredDocuments));
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
    }
  }

  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}