import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DocsService {

  private apiUrl = 'https://solimus.sn:8082/api/docs';

  constructor(private http: HttpClient) {}

  uploadSignedPdf(docId: number, file: File): Observable<any> {

    const formData = new FormData();
    formData.append('signedPdf', file);

    return this.http.post(`${this.apiUrl}/${docId}/signed`, formData);
  }

}