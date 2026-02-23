import { Component, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pages-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pages-sidebar.component.html',
  styleUrls: ['./pages-sidebar.component.scss']
})
export class PagesSidebarComponent {
  @Input() pages: number[] = [];
  @Input() currentPage: number = 1;
  @Input() isOpen: boolean = true;
  @Input() isMobile: boolean = false;

  @Output() pageSelected = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();

  @ViewChildren('thumbCanvas') thumbCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  closeSidebar() {
    this.close.emit();
  }

  selectPage(page: number) {
    this.pageSelected.emit(page);
  }
}
