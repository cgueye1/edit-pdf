import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class DocsService {
  private apiUrl = `${environment.apiUrl}/api/docs`;
  private secureLinkApi = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  /** Récupère le détail d'une demande (pour savoir si un PDF est déjà attaché → utiliser PUT au prochain upload). */
  getRequestDetail(requestId: string): Observable<{ submittedForm?: { pdfUrl?: string } }> {
    return this.http.get(`${this.secureLinkApi}/requests/${requestId}`, {
      withCredentials: true,
    }) as Observable<{ submittedForm?: { pdfUrl?: string } }>;
  }

  /** Envoie le PDF rempli (POST = premier envoi, PUT = mise à jour après retour dans l'éditeur). */
  uploadFilledPdfForRequest(requestId: string, file: File, usePut: boolean = false): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    const url = `${this.secureLinkApi}/requests/${requestId}/upload-filled-pdf`;
    const request = usePut
      ? this.http.put(url, formData, { withCredentials: true })
      : this.http.post(url, formData, { withCredentials: true });
    return request as Observable<unknown>;
  }

  // upload simple PDF signé
  uploadSignedPdf(docId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('signedPdf', file);

    return this.http.post(`${this.apiUrl}/${docId}/signed`, formData);
  }

  // marquer une signature (Solimus ou Secure Link selon environment.useSecureLink)
  markSignature(
    documentId: number,
    userId: number,
    file: File,
    signatureNotes: string = '',
  ): Observable<any> {
    const formData = new FormData();
    formData.append('signedPdf', file);

    if ((environment as any).useSecureLink) {
      // Secure Link : adapter l’endpoint selon votre API (ex. demande, document client)
      formData.append('documentId', documentId.toString());
      formData.append('signatureNotes', signatureNotes);
      return this.http.post(`${this.secureLinkApi}/clients/documents/signed`, formData);
    }

    formData.append('documentId', documentId.toString());
    formData.append('userId', userId.toString());
    formData.append('signatureNotes', signatureNotes);
    return this.http.post(`${this.apiUrl}/signature/mark`, formData);
  }
}
