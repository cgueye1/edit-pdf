import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() notification!: Notification;
  private timeoutId?: number;

  ngOnInit(): void {
    const duration = this.notification.duration || 3000;
    if (duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.close();
      }, duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  close(): void {
    const element = document.getElementById(`notification-${this.notification.id}`);
    if (element) {
      element.style.opacity = '0';
      element.style.transform = 'translateX(100%)';
      setTimeout(() => {
        element.remove();
      }, 300);
    }
  }

  getIcon(): string {
    switch (this.notification.type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-exclamation-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  }
}


