import { Component, ElementRef, ViewChild, Output, EventEmitter, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signature-pad.component.html',
  styleUrls: ['./signature-pad.component.scss']
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @Output() signatureSaved = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  
  activeTab: 'image' | 'type' | 'write' = 'image';
  signaturePad!: SignaturePad;
  signatureDataUrl: string | null = null;
  uploadedImageUrl: string | null = null;
  removeBackground = false;
  typedSignature = '';
  penColor = '#000000';
  penWidth = 2;
  lastSignature: string | null = null;

  ngAfterViewInit(): void {
    // Charger la dernière signature
    this.lastSignature = localStorage.getItem('lastSignature');
    
    if (this.activeTab === 'write') {
      setTimeout(() => this.initSignaturePad(), 0);
    }
  }

  switchTab(tab: 'image' | 'type' | 'write'): void {
    this.activeTab = tab;
    if (tab === 'write') {
      setTimeout(() => this.initSignaturePad(), 0);
    }
  }

  initSignaturePad(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    if (!canvas) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Fond transparent pour le canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(255, 255, 255, 0)', // Fond transparent
      penColor: this.penColor,
      minWidth: 0.5,
      maxWidth: this.penWidth
    });

    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.signaturePad && this.activeTab === 'write') {
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        const data = this.signaturePad.toData();
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        this.signaturePad.clear();
        this.signaturePad.fromData(data);
      }
    }
  }

  openFileDialog(): void {
    if (this.fileInputRef) {
      this.fileInputRef.nativeElement.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.uploadedImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.uploadedImageUrl = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async removeBackgroundFromImageAsync(): Promise<string | null> {
    if (!this.uploadedImageUrl) return null;
    
    const imageUrl = this.uploadedImageUrl; // Stocker dans une variable locale pour TypeScript
    
    return new Promise<string | null>((resolve) => {
      // Créer un canvas pour traiter l'image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(imageUrl);
          return;
        }
        
        // Dessiner l'image
        ctx.drawImage(img, 0, 0);
        
        // Obtenir les données de l'image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Algorithme simple de suppression d'arrière-plan (détection des pixels blancs/clair)
        // On considère les pixels avec une luminosité élevée comme arrière-plan
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          
          // Si le pixel est très clair (blanc ou presque blanc), le rendre transparent
          if (brightness > 240) {
            data[i + 3] = 0; // Alpha = 0 (transparent)
          }
        }
        
        // Appliquer les modifications
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => {
        resolve(imageUrl);
      };
      
      img.src = imageUrl;
    });
  }

  clear(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
    this.signatureDataUrl = null;
    this.uploadedImageUrl = null;
    this.typedSignature = '';
  }

  changePenColor(color: string): void {
    this.penColor = color;
    if (this.signaturePad) {
      this.signaturePad.penColor = color;
    }
  }

  changePenWidth(width: number): void {
    this.penWidth = width;
    if (this.signaturePad) {
      this.signaturePad.minWidth = width * 0.5;
      this.signaturePad.maxWidth = width;
    }
  }

  undo(): void {
    if (this.signaturePad) {
      const data = this.signaturePad.toData();
      if (data.length > 0) {
        data.pop();
        this.signaturePad.fromData(data);
      }
    }
  }

  async save(): Promise<void> {
    let signatureData: string | null = null;

    if (this.activeTab === 'image' && this.uploadedImageUrl) {
      if (this.removeBackground) {
        signatureData = await this.removeBackgroundFromImageAsync();
      } else {
        signatureData = this.uploadedImageUrl;
      }
    } else if (this.activeTab === 'type' && this.typedSignature.trim()) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '48px "Brush Script MT", cursive, sans-serif';
        const textWidth = ctx.measureText(this.typedSignature).width;
        canvas.width = textWidth + 40;
        canvas.height = 80;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '48px "Brush Script MT", cursive, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(this.typedSignature, 20, 50);
        signatureData = canvas.toDataURL('image/png');
      }
    } else if (this.activeTab === 'write' && this.signaturePad && !this.signaturePad.isEmpty()) {
      const canvas = this.canvasRef.nativeElement;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      
      if (tempCtx) {
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        const originalCtx = canvas.getContext('2d');
        if (originalCtx) {
          tempCtx.drawImage(canvas, 0, 0);
        }
        signatureData = tempCanvas.toDataURL('image/png');
      } else {
        signatureData = this.signaturePad.toDataURL('image/png');
      }
    }

    if (!signatureData) {
      alert('Veuillez créer une signature d\'abord');
      return;
    }

    // Sauvegarder la signature dans localStorage
    localStorage.setItem('lastSignature', signatureData);
    
    this.signatureDataUrl = signatureData;
    this.signatureSaved.emit(signatureData);
    this.close();
  }

  useLastSignature(): void {
    if (this.lastSignature) {
      this.signatureSaved.emit(this.lastSignature);
      this.close();
    }
  }

  cancel(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  canSave(): boolean {
    if (this.activeTab === 'image') {
      return !!this.uploadedImageUrl;
    } else if (this.activeTab === 'type') {
      return !!this.typedSignature.trim();
    } else if (this.activeTab === 'write') {
      return this.signaturePad && !this.signaturePad.isEmpty();
    }
    return false;
  }
}
