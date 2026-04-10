import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RealtimeSignatureService, SignatureStroke } from '../../services/realtime-signature.service';

type Point = { x: number; y: number; t?: number };

@Component({
  selector: 'app-remote-sign',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './remote-sign.component.html',
  styleUrl: './remote-sign.component.scss',
})
export class RemoteSignComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly realtime = inject(RealtimeSignatureService);

  /** Fourni par AppComponent quand les query params ne sont pas sur ActivatedRoute (base href / iframe / timing). */
  @Input() remoteSession: string | null = null;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  sessionId = '';
  connected = false;
  error = '';

  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private last: Point | null = null;

  // paramètres simples
  color = '#000000';
  width = 2;

  ngOnInit(): void {
    const sid = this.resolveSessionId();
    if (!sid) {
      this.error = 'Session manquante.';
      return;
    }
    this.sessionId = sid;
    this.initCanvas();
    this.connectSocket();
  }

  ngOnDestroy(): void {
    this.realtime.disconnect();
  }

  private resolveSessionId(): string {
    const fromInput = this.remoteSession?.trim();
    if (fromInput) return fromInput;
    const fromRoute = this.route.snapshot.queryParamMap.get('session')?.trim();
    if (fromRoute) return fromRoute;
    try {
      const w = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') : null;
      return w?.trim() || '';
    } catch {
      return '';
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    canvas.style.touchAction = 'none';
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.width;
    }
  }

  private connectSocket(): void {
    const s = this.realtime.connect();
    s.on('connect', () => {
      s.emit('join', { sessionId: this.sessionId, role: 'mobile' }, () => {});
      this.connected = true;
    });
    s.on('connect_error', () => {
      this.connected = false;
      this.error = 'Connexion temps réel impossible. Vérifiez le réseau.';
    });
  }

  private toNormalizedPoint(ev: PointerEvent): Point {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), t: Date.now() };
  }

  private drawLine(a: Point, b: Point): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.width;
    this.ctx.beginPath();
    this.ctx.moveTo(a.x * w, a.y * h);
    this.ctx.lineTo(b.x * w, b.y * h);
    this.ctx.stroke();
  }

  onPointerDown(ev: PointerEvent): void {
    if (!this.connected || !this.sessionId) return;
    (ev.target as HTMLElement)?.setPointerCapture?.(ev.pointerId);
    this.drawing = true;
    this.last = this.toNormalizedPoint(ev);
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.drawing || !this.last) return;
    const now = this.toNormalizedPoint(ev);
    this.drawLine(this.last, now);
    const stroke: SignatureStroke = { color: this.color, width: this.width, points: [this.last, now] };
    this.realtime.connect().emit('stroke', { sessionId: this.sessionId, ...stroke });
    this.last = now;
  }

  onPointerUp(ev: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    try {
      (ev.target as HTMLElement)?.releasePointerCapture?.(ev.pointerId);
    } catch {}
  }

  clear(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.realtime.connect().emit('clear', { sessionId: this.sessionId });
  }

  validate(): void {
    this.realtime.connect().emit('done', { sessionId: this.sessionId });
    // L’écran reste affiché : le PC décidera de fermer. (Optionnel : message “ok”.)
  }
}

