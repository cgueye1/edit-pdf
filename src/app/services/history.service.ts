import { Injectable } from '@angular/core';
import { PDFDocumentState, HistoryState } from '../models/pdf.model';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly MAX_HISTORY = 10; // Réduit de 50 à 10 pour éviter le quota
  private state: HistoryState = {
    past: [],
    present: null,
    future: []
  };

  saveState(state: PDFDocumentState): void {
    // Si c'est le premier état
    if (!this.state.present) {
      this.state.present = this.deepCopy(state);
      return;
    }

    // Vérifier si l'état a réellement changé
    if (this.hasStateChanged(this.state.present, state)) {
      // Ajouter l'état actuel au passé
      this.state.past.push(this.state.present);
      
      // Limiter la taille de l'historique
      if (this.state.past.length > this.MAX_HISTORY) {
        this.state.past.shift();
      }

      // Définir le nouvel état comme présent
      this.state.present = this.deepCopy(state);
      
      // Effacer le futur
      this.state.future = [];
      
      // Sauvegarder dans localStorage
      this.saveToLocalStorage();
    }
  }

  undo(): PDFDocumentState | null {
    if (this.state.past.length === 0) return null;

    // Ajouter l'état présent au futur
    if (this.state.present) {
      this.state.future.unshift(this.state.present);
    }

    // Récupérer le dernier état du passé
    const previousState = this.state.past.pop()!;
    this.state.present = previousState;

    this.saveToLocalStorage();
    return this.deepCopy(previousState);
  }

  redo(): PDFDocumentState | null {
    if (this.state.future.length === 0) return null;

    // Ajouter l'état présent au passé
    if (this.state.present) {
      this.state.past.push(this.state.present);
    }

    // Récupérer le premier état du futur
    const nextState = this.state.future.shift()!;
    this.state.present = nextState;

    this.saveToLocalStorage();
    return this.deepCopy(nextState);
  }

  canUndo(): boolean {
    return this.state.past.length > 0;
  }

  canRedo(): boolean {
    return this.state.future.length > 0;
  }

  clearHistory(): void {
    this.state = {
      past: [],
      present: null,
      future: []
    };
    localStorage.removeItem('pdfEditorHistory');
  }

  getHistory(): HistoryState {
    return this.deepCopy(this.state);
  }

  loadFromLocalStorage(): void {
    const saved = localStorage.getItem('pdfEditorHistory');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        // Convertir les dates
        if (this.state.present) {
          this.state.present.createdAt = new Date(this.state.present.createdAt);
          this.state.present.updatedAt = new Date(this.state.present.updatedAt);
        }
        this.state.past.forEach(state => {
          state.createdAt = new Date(state.createdAt);
          state.updatedAt = new Date(state.updatedAt);
        });
        this.state.future.forEach(state => {
          state.createdAt = new Date(state.createdAt);
          state.updatedAt = new Date(state.updatedAt);
        });
      } catch (error) {
        // Erreur silencieuse - nettoyer l'historique corrompu
        this.clearHistory();
      }
    }
  }

  private saveToLocalStorage(): void {
    try {
      // Nettoyer les données volumineuses avant sauvegarde
      const cleanedState = this.cleanStateForStorage(this.state);
      const jsonString = JSON.stringify(cleanedState);
      
      // Vérifier la taille (localStorage limite ~5-10MB)
      if (jsonString.length > 4 * 1024 * 1024) { // 4MB max
        // Réduire encore plus l'historique si trop volumineux
        if (this.state.past.length > 5) {
          this.state.past = this.state.past.slice(-5);
        }
        const reducedState = this.cleanStateForStorage(this.state);
        localStorage.setItem('pdfEditorHistory', JSON.stringify(reducedState));
      } else {
        localStorage.setItem('pdfEditorHistory', jsonString);
      }
    } catch (error: any) {
      // Si erreur de quota, nettoyer l'ancien historique et réessayer
      if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
        this.state.past = this.state.past.slice(-3); // Garder seulement les 3 derniers
        this.state.future = [];
        try {
          const cleanedState = this.cleanStateForStorage(this.state);
          localStorage.setItem('pdfEditorHistory', JSON.stringify(cleanedState));
        } catch (e) {
          // Si toujours en erreur, ne pas sauvegarder l'historique
          localStorage.removeItem('pdfEditorHistory');
        }
      }
    }
  }

  private cleanStateForStorage(state: HistoryState): HistoryState {
    // Nettoyer les données inutiles pour réduire la taille
    const clean = (doc: PDFDocumentState | null): PDFDocumentState | null => {
      if (!doc) return null;
      return {
        ...doc,
        originalFile: undefined, // Ne pas sauvegarder le fichier PDF
        fields: doc.fields.map(f => {
          // Nettoyer les champs pour réduire la taille
          const cleaned: any = { ...f };
          // Supprimer les données volumineuses inutiles
          if (cleaned.value && typeof cleaned.value === 'string' && cleaned.value.length > 10000) {
            cleaned.value = cleaned.value.substring(0, 10000); // Limiter les très longs textes
          }
          return cleaned;
        })
      };
    };

    return {
      past: state.past.map(clean).filter((d): d is PDFDocumentState => d !== null),
      present: clean(state.present),
      future: state.future.map(clean).filter((d): d is PDFDocumentState => d !== null)
    };
  }

  private hasStateChanged(oldState: PDFDocumentState, newState: PDFDocumentState): boolean {
    // Comparaison simple des IDs de champs
    const oldFields = JSON.stringify(oldState.fields);
    const newFields = JSON.stringify(newState.fields);
    
    return oldFields !== newFields || 
           oldState.currentPage !== newState.currentPage;
  }

  private deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}