import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { interval, Subscription } from 'rxjs';

@Component({
    selector: 'app-otp-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close()" [@fadeIn]>
      <div class="modal-container" (click)="$event.stopPropagation()" [@slideUp]>

        <div class="modal-header">
          <button class="btn-close" (click)="close()">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="message-section">
            <h2 class="title">Code de vérification</h2>
            <p class="instruction-text">
              Saisissez le code à 4 chiffres envoyé par téléphone au <span class="phone-number">{{ maskedPhone }}</span>
            </p>
          </div>

          <div class="otp-input-section">
            <div class="otp-inputs">
              <input
                *ngFor="let digit of otpDigits; let i = index"
                #otpInput
                type="text"
                inputmode="numeric"
                maxlength="1"
                class="otp-digit"
                [(ngModel)]="otpDigits[i]"
                (keydown)="onKeyDown($event, i)"
                (input)="onInput($event, i)"
                (paste)="onPaste($event)"
                [class.error]="hasError"
              />
            </div>
            <p class="error-message" *ngIf="hasError">
              Code incorrect. Veuillez réessayer.
            </p>
          </div>

          <div class="resend-section">
            <p class="resend-question">Vous n'avez pas reçu de code ?</p>
            <button
              class="btn-resend"
              (click)="resendCode()"
              [disabled]="resendCountdown > 0">
              <span *ngIf="resendCountdown > 0">
                Renvoyer le code dans {{ formatCountdown(resendCountdown) }}
              </span>
              <span *ngIf="resendCountdown === 0">
                Renvoyer le code
              </span>
            </button>
          </div>

          <div class="modal-actions">
            <button
              class="btn btn-primary"
              (click)="submit()"
              [disabled]="!isOtpComplete || isSubmitting"
              type="button">
              <span *ngIf="!isSubmitting">Valider</span>
              <span *ngIf="isSubmitting">
                <i class="fas fa-spinner fa-spin"></i> Vérification...
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-container {
      width: 450px;
      max-width: 90vw;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      position: relative;
      z-index: 2001;
    }

    .modal-header {
      display: flex;
      justify-content: flex-end;
      padding: 16px 20px;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: rgba(0,0,0,0.5);
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      font-size: 18px;
    }

    .btn-close:hover {
      background: rgba(0,0,0,0.05);
      color: rgba(0,0,0,0.7);
    }

    .modal-body {
      padding: 32px 24px 24px;
    }

    .message-section {
      text-align: center;
      margin-bottom: 32px;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1f;
      margin: 0 0 16px 0;
    }

    .instruction-text {
      font-size: 0.95rem;
      color: #4a5568;
      margin: 0;
      line-height: 1.5;
    }

    .phone-number {
      color: #1a1a1f;
      font-weight: 600;
    }

    .otp-input-section {
      margin-bottom: 24px;
    }

    .otp-inputs {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .otp-digit {
      width: 56px;
      height: 56px;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 600;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      transition: all 0.2s;
      outline: none;
      color: #1a1a1f;
    }

    .otp-digit:focus {
      border-color: #4fd1c7;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(79, 209, 199, 0.1);
    }

    .otp-digit.error {
      border-color: #f56565;
      background: #fff5f5;
    }

    .error-message {
      text-align: center;
      color: #f56565;
      font-size: 0.875rem;
      margin: 8px 0 0 0;
    }

    .resend-section {
      text-align: center;
      margin-bottom: 24px;
    }

    .resend-question {
      font-size: 0.9rem;
      color: #4a5568;
      margin: 0 0 8px 0;
    }

    .btn-resend {
      background: transparent;
      border: none;
      color: #4fd1c7;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .btn-resend:hover:not(:disabled) {
      background: rgba(79, 209, 199, 0.1);
      color: #38b2ac;
    }

    .btn-resend:disabled {
      color: #a0aec0;
      cursor: not-allowed;
    }

    .modal-actions {
      display: flex;
      justify-content: center;
    }

    .btn {
      padding: 12px 32px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      font-size: 1rem;
    }

    .btn-primary {
      background: #3182ce;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2c5aa0;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .otp-digit {
        width: 50px;
        height: 50px;
        font-size: 1.25rem;
      }
    }
  `],
    animations: [
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease', style({ opacity: 1 }))
            ]),
            transition(':leave', [
                animate('180ms ease', style({ opacity: 0 }))
            ])
        ]),
        trigger('slideUp', [
            transition(':enter', [
                style({ transform: 'translateY(20px) scale(0.97)', opacity: 0 }),
                animate('250ms cubic-bezier(0.34,1.56,0.64,1)', style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
            ]),
            transition(':leave', [
                animate('180ms ease', style({ transform: 'translateY(10px) scale(0.98)', opacity: 0 }))
            ])
        ])
    ]
})
export class OtpModalComponent implements OnInit, OnDestroy, OnChanges {
    @Input() isOpen = false;
    @Input() phoneNumber: string = '771234567'; // Numéro de téléphone par défaut
    @Output() closed = new EventEmitter<void>();
    @Output() otpSubmitted = new EventEmitter<string>();
    @Output() resendOtp = new EventEmitter<void>();

    otpDigits: string[] = ['', '', '', ''];
    hasError = false;
    isSubmitting = false;
    resendCountdown = 30; // 30 secondes
    private countdownSubscription?: Subscription;

    get maskedPhone(): string {
        if (this.phoneNumber.length >= 9) {
            // Format: 77 *** ** 43
            const start = this.phoneNumber.substring(0, 2);
            const end = this.phoneNumber.substring(this.phoneNumber.length - 2);
            return `${start} *** ** ${end}`;
        }
        return this.phoneNumber;
    }

    ngOnInit(): void {
        if (this.isOpen) {
            this.startCountdown();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
            // Réinitialiser le modal quand il s'ouvre
            this.otpDigits = ['', '', '', ''];
            this.hasError = false;
            this.isSubmitting = false;
            this.startCountdown();
        }
    }

    ngOnDestroy(): void {
        if (this.countdownSubscription) {
            this.countdownSubscription.unsubscribe();
        }
    }

    startCountdown(): void {
        this.resendCountdown = 30;
        if (this.countdownSubscription) {
            this.countdownSubscription.unsubscribe();
        }
        this.countdownSubscription = interval(1000).subscribe(() => {
            if (this.resendCountdown > 0) {
                this.resendCountdown--;
            } else {
                if (this.countdownSubscription) {
                    this.countdownSubscription.unsubscribe();
                }
            }
        });
    }

    formatCountdown(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    resendCode(): void {
        if (this.resendCountdown > 0) return;

        this.resendOtp.emit();
        this.startCountdown();
        // TODO: Appeler l'API backend pour renvoyer le code
    }

    get isOtpComplete(): boolean {
        // Vérifier que tous les 4 champs contiennent un chiffre
        const allFilled = this.otpDigits.length === 4 &&
            this.otpDigits.every(digit => digit && digit.trim() !== '');
        return allFilled;
    }

    onKeyDown(event: KeyboardEvent, index: number): void {
        const input = event.target as HTMLInputElement;

        // Permettre les touches de navigation
        if (['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Tab'].includes(event.key)) {
            if (event.key === 'Backspace' && !input.value && index > 0) {
                // Aller au champ précédent si le champ actuel est vide
                const prevInput = document.querySelectorAll('.otp-digit')[index - 1] as HTMLInputElement;
                if (prevInput) prevInput.focus();
            }
            return;
        }

        // Ne permettre que les chiffres
        if (!/^[0-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
        }
    }

    onInput(event: Event, index: number): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(/[^0-9]/g, '');

        // Limiter à un seul chiffre
        if (value.length > 1) {
            value = value[0];
        }

        // Mettre à jour la valeur de l'input
        input.value = value;

        // Créer un nouveau tableau pour forcer la détection des changements Angular
        const newDigits = [...this.otpDigits];
        newDigits[index] = value;
        this.otpDigits = newDigits;

        // Aller au champ suivant si un chiffre est entré
        if (value && index < 3) {
            setTimeout(() => {
                const nextInput = document.querySelectorAll('.otp-digit')[index + 1] as HTMLInputElement;
                if (nextInput) nextInput.focus();
            }, 0);
        }

        this.hasError = false;
    }

    onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        const pastedData = event.clipboardData?.getData('text').replace(/[^0-9]/g, '').slice(0, 4) || '';

        if (pastedData.length === 4) {
            this.otpDigits = pastedData.split('');
            // Mettre à jour les valeurs des inputs
            const inputs = document.querySelectorAll('.otp-digit') as NodeListOf<HTMLInputElement>;
            inputs.forEach((input, index) => {
                input.value = this.otpDigits[index] || '';
            });
            // Focus sur le dernier champ
            if (inputs[3]) inputs[3].focus();
        }
    }

    submit(): void {
        if (!this.isOtpComplete) {
            return;
        }

        this.isSubmitting = true;
        const otpCode = this.otpDigits.join('');
        console.log('Code OTP complet:', otpCode);

        // Émettre l'événement avec le code OTP
        this.otpSubmitted.emit(otpCode);

        // Note: La validation réelle sera faite dans le composant parent
        // Ici, on émet juste l'événement
    }

    close(): void {
        this.otpDigits = ['', '', '', ''];
        this.hasError = false;
        this.isSubmitting = false;
        if (this.countdownSubscription) {
            this.countdownSubscription.unsubscribe();
        }
        this.closed.emit();
    }

    setError(hasError: boolean): void {
        this.hasError = hasError;
        this.isSubmitting = false;
    }
}
