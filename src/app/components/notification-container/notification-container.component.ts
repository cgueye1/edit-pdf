import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationComponent } from '../notification/notification.component';
import { Notification } from '../notification/notification.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-container',
  standalone: true,
  imports: [CommonModule, NotificationComponent],
  template: `
    <div class="notification-container">
      <app-notification 
        *ngFor="let notification of notifications" 
        [notification]="notification">
      </app-notification>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 0;
      right: 0;
      z-index: 10000;
      pointer-events: none;
    }
  `]
})
export class NotificationContainerComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.subscription = this.notificationService.notifications$.subscribe(
      notifications => this.notifications = notifications
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}



