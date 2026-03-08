import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class DocsService {
  private apiUrl = `${environment.apiUrl}/api/docs`;

  constructor(private http: HttpClient) {}

  // upload simple PDF signé
  uploadSignedPdf(docId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('signedPdf', file);

    return this.http.post(`${this.apiUrl}/${docId}/signed`, formData);
  }

  // marquer une signature
  markSignature(
    documentId: number,
    userId: number,
    file: File,
    signatureNotes: string = '',
  ): Observable<any> {
    const formData = new FormData();
    formData.append('documentId', documentId.toString());
    formData.append('userId', userId.toString());
    formData.append('signedPdf', file);
    formData.append('signatureNotes', signatureNotes);

    return this.http.post(`${this.apiUrl}/signature/mark`, formData);
  }
}
