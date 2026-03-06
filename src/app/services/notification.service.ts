import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../components/notification/notification.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private showNotification(notification: Omit<Notification, 'id'>): void {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      id,
      ...notification
    };

    const current = this.notificationsSubject.value;
    this.notificationsSubject.next([...current, newNotification]);

    // Auto-remove après la durée spécifiée
    const duration = notification.duration || 3000;
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  success(message: string, duration: number = 3000): void {
    this.showNotification({ message, type: 'success', duration });
  }

  error(message: string, duration: number = 5000): void {
    this.showNotification({ message, type: 'error', duration });
  }

  warning(message: string, duration: number = 4000): void {
    this.showNotification({ message, type: 'warning', duration });
  }

  info(message: string, duration: number = 3000): void {
    this.showNotification({ message, type: 'info', duration });
  }

  remove(id: string): void {
    const current = this.notificationsSubject.value;
    this.notificationsSubject.next(current.filter(n => n.id !== id));
  }

  clear(): void {
    this.notificationsSubject.next([]);
  }
}



