import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class DocsService {
  private apiUrl = `${environment.apiUrl}/api/docs`;
  private secureLinkApi = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  /** Récupère le détail d'une demande (pour savoir si un PDF est déjà attaché → utiliser PUT au prochain upload). */
  getRequestDetail(requestId: string): Observable<{
    submittedForm?: { pdfUrl?: string };
    submittedForms?: Array<{ label: string; pdfUrl?: string; editorState?: unknown }>;
  }> {
    return this.http.get(`${this.secureLinkApi}/requests/${requestId}`, {
      withCredentials: true,
    }) as Observable<{
      submittedForm?: { pdfUrl?: string };
      submittedForms?: Array<{ label: string; pdfUrl?: string; editorState?: unknown }>;
    }>;
  }

  /** Envoie le PDF rempli (POST = premier envoi, PUT = mise à jour). label = nom du document (multi-PDF). */
  uploadFilledPdfForRequest(
    requestId: string,
    file: File,
    usePut: boolean = false,
    uploadToken?: string,
    label?: string,
    editorState?: unknown,
  ): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    if (label != null && label.trim() !== '') {
      formData.append('label', label.trim());
    }
    if (editorState != null) {
      try {
        formData.append('editorState', JSON.stringify(editorState));
      } catch (_) {}
    }
    const url = `${this.secureLinkApi}/requests/${requestId}/upload-filled-pdf`;
    const headers: Record<string, string> = {};
    if (uploadToken) {
      headers['X-Upload-Token'] = uploadToken;
    }
    const options = { withCredentials: true as const, headers };
    const request = usePut
      ? this.http.put(url, formData, options)
      : this.http.post(url, formData, options);
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
    /** UUID de la demande Secure Link (prioritaire sur documentId legacy). */
    secureLinkRequestId?: string,
  ): Observable<any> {
    const formData = new FormData();
    formData.append('signedPdf', file);

    if ((environment as any).useSecureLink) {
      const rid = secureLinkRequestId?.trim();
      if (rid) {
        formData.append('requestId', rid);
      } else {
        formData.append('documentId', String(documentId));
      }
      formData.append('signatureNotes', signatureNotes);
      return this.http.post(`${this.secureLinkApi}/clients/documents/signed`, formData, {
        withCredentials: true,
      });
    }

    formData.append('documentId', documentId.toString());
    formData.append('userId', userId.toString());
    formData.append('signatureNotes', signatureNotes);
    return this.http.post(`${this.apiUrl}/signature/mark`, formData);
  }

  private pkiHttpOptions(uploadToken?: string) {
    const headers: Record<string, string> = {};
    if (uploadToken) {
      headers['X-Upload-Token'] = uploadToken;
    }
    return { withCredentials: true as const, headers };
  }

  /**
   * Après un upload réussi : certificat utilisateur + signature PAdES.
   * Silencieux si PKI désactivée côté API (erreur absorbée).
   * Utilise le même X-Upload-Token que l’upload (iframe sans cookie).
   */
  applyPkiAfterUpload(
    requestId: string,
    label: string | undefined,
    uploadToken?: string,
  ): Observable<{ ok: boolean; pki?: unknown; skipped?: boolean }> {
    const env = environment as {
      useSecureLink?: boolean;
      pkiAfterUpload?: boolean;
    };
    if (!env.useSecureLink || env.pkiAfterUpload === false) {
      return of({ ok: true, skipped: true });
    }
    const opts = this.pkiHttpOptions(uploadToken);
    const ensureUrl = uploadToken
      ? `${this.secureLinkApi}/pki/ensure-certificate?requestId=${encodeURIComponent(requestId)}`
      : `${this.secureLinkApi}/pki/ensure-certificate`;
    const body: { requestId: string; label?: string } = { requestId };
    if (label != null && String(label).trim() !== '') {
      body.label = String(label).trim();
    }
    return this.http.post(ensureUrl, {}, opts).pipe(
      switchMap(() =>
        this.http.post(`${this.secureLinkApi}/pki/sign`, body, opts),
      ),
      map((pki) => ({ ok: true, pki })),
      catchError((err) => {
        console.warn('[PKI]', err);
        return of({ ok: false });
      }),
    );
  }
}
