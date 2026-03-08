// otp-modal.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewChildren,
  QueryList,
  ElementRef,
  OnDestroy,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { OtpService } from '../../services/OtpService';

@Component({
  selector: 'app-otp-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './otp-modal.component.html',
  styleUrls: ['./otp-modal.component.scss'],
})
export class OtpModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() phoneNumber!: string;

  @Output() closed = new EventEmitter<void>();
  @Output() validated = new EventEmitter<boolean>();

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  otpDigits: string[] = ['', '', '', ''];
  resendCountdown = 30;
  isSubmitting = false;
  hasError = false;

  private countdownSub?: Subscription;

  constructor(private otpService: OtpService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.reset();
      this.sendOtp();
      this.startCountdown();

      setTimeout(() => {
        this.focusInput(0);
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
  }

  get maskedPhone(): string {
    if (!this.phoneNumber) return '';
    const start = this.phoneNumber.slice(0, 5);
    const end = this.phoneNumber.slice(-2);
    return `${start} *** ${end}`;
  }

  get isOtpComplete(): boolean {
    return this.otpDigits.every((d) => d !== '');
  }

  sendOtp() {
    this.otpService.sendOtp(this.phoneNumber).subscribe({
      next: () => console.log('OTP envoyé'),
      error: () => console.error('Erreur OTP'),
    });
  }

  resendCode() {
    if (this.resendCountdown > 0) return;
    this.sendOtp();
    this.startCountdown();
  }

  validateOtp() {
    if (!this.isOtpComplete) return;

    this.isSubmitting = true;
    const otp = this.otpDigits.join('');

    this.otpService.validateOtp(this.phoneNumber, otp).subscribe({
      next: (valid) => {
        this.isSubmitting = false;

        if (valid) {
          this.validated.emit(true);
          this.close();
        } else {
          this.hasError = true;
          this.otpDigits = ['', '', '', ''];
          
          // Réinitialiser tous les champs visuellement
          setTimeout(() => {
            const inputs = this.otpInputs.toArray();
            inputs.forEach(input => {
              input.nativeElement.value = '';
            });
            this.focusInput(0);
          }, 100);
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.hasError = true;
      },
    });
  }

  startCountdown() {
    this.resendCountdown = 30;
    this.countdownSub?.unsubscribe();
    this.countdownSub = interval(1000).subscribe(() => {
      if (this.resendCountdown > 0) {
        this.resendCountdown--;
      }
    });
  }

  onInput(event: any, index: number) {
    // Récupérer la valeur saisie
    let value = event.target.value;

    // Si c'est plus d'un caractère, ne garder que le dernier
    if (value.length > 1) {
      value = value.charAt(value.length - 1);
    }

    // Vérifier si c'est un chiffre
    if (!/^[0-9]$/.test(value)) {
      // Si ce n'est pas un chiffre, vider le champ
      this.otpDigits[index] = '';
      event.target.value = '';
      return;
    }

    // Mettre à jour le tableau
    this.otpDigits[index] = value;
    this.hasError = false;

    // Passer au champ suivant
    if (index < 3) {
      setTimeout(() => {
        this.focusInput(index + 1);
      }, 10);
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      event.preventDefault();

      if (this.otpDigits[index] !== '') {
        // Si le champ actuel a une valeur, la supprimer
        this.otpDigits[index] = '';
        (event.target as HTMLInputElement).value = '';
      } else if (index > 0) {
        // Si le champ est vide, aller au précédent
        setTimeout(() => {
          this.focusInput(index - 1);
        }, 10);
      }
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();

    const pasteData = event.clipboardData?.getData('text') || '';
    const digits = pasteData.replace(/\D/g, '').slice(0, 4);

    if (digits.length > 0) {
      // Mettre à jour les champs
      for (let i = 0; i < digits.length; i++) {
        this.otpDigits[i] = digits[i];
      }

      // Mettre à jour les valeurs dans les inputs
      setTimeout(() => {
        const inputs = this.otpInputs.toArray();
        for (let i = 0; i < digits.length; i++) {
          if (inputs[i]) {
            inputs[i].nativeElement.value = digits[i];
          }
        }

        // Pour les champs restants, s'assurer qu'ils sont vides
        for (let i = digits.length; i < 4; i++) {
          if (inputs[i]) {
            inputs[i].nativeElement.value = '';
          }
        }

        // Focus sur le prochain champ
        const nextIndex = Math.min(digits.length, 3);
        if (inputs[nextIndex]) {
          inputs[nextIndex].nativeElement.focus();
          inputs[nextIndex].nativeElement.select();
        }
      }, 10);
    }
  }

  onFocus(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    setTimeout(() => {
      input.select();
    }, 10);
  }

  focusInput(index: number) {
    const inputs = this.otpInputs.toArray();
    if (inputs[index]) {
      // S'assurer que la valeur affichée correspond à otpDigits
      inputs[index].nativeElement.value = this.otpDigits[index] || '';
      inputs[index].nativeElement.focus();
      inputs[index].nativeElement.select();
    }
  }

  close() {
    this.reset();
    this.closed.emit();
  }

  reset() {
    this.otpDigits = ['', '', '', ''];
    this.hasError = false;
    this.isSubmitting = false;
    this.countdownSub?.unsubscribe();
    this.resendCountdown = 30;
    
    // Réinitialiser tous les champs visuellement
    setTimeout(() => {
      const inputs = this.otpInputs?.toArray();
      if (inputs) {
        inputs.forEach(input => {
          input.nativeElement.value = '';
        });
      }
    }, 10);
  }
}