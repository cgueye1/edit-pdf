import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment.prod';

export type SignatureStroke = {
  color: string;
  width: number;
  points: Array<{ x: number; y: number; t?: number }>; // x/y normalisés 0..1
};

@Injectable({ providedIn: 'root' })
export class RealtimeSignatureService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket && this.socket.connected) return this.socket;
    const base = (environment as any)?.apiUrl || '';
    // Socket.IO se connecte au même host que l’API Secure Link
    this.socket = io(`${base}/realtime-signature`, {
      path: '/api/socket.io',
      transports: ['websocket'],
      withCredentials: true,
    });
    return this.socket;
  }

  disconnect(): void {
    try {
      this.socket?.disconnect();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }
}

