import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface SendOtpRequest {
  phoneNumber: string;
}

interface ValidateOtpRequest {
  phoneNumber: string;
  otp: string;
}

@Injectable({
  providedIn: 'root',
})
export class OtpService {

  private apiUrl = 'https://wakana.online/pharma-delivery/api/otp';

  constructor(private http: HttpClient) {}

  // envoyer OTP
  sendOtp(phoneNumber: string): Observable<any> {
    const body: SendOtpRequest = { phoneNumber };
    return this.http.post(`${this.apiUrl}/send`, body);
  }

  // valider OTP
  validateOtp(phoneNumber: string, otp: string): Observable<boolean> {
    const body: ValidateOtpRequest = { phoneNumber, otp };
    return this.http.post<boolean>(`${this.apiUrl}/validate`, body);
  }
}