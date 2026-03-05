import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';

@Directive({
  selector: '[appDraggable]',
  standalone: true,
})
export class DraggableDirective implements OnInit, OnDestroy {
  @Input() appDraggable = true;
  @Input() dragData: any;
  @Input() constrainToParent = false;
  @Input() gridSize = 1;

  @Output() dragStart = new EventEmitter<any>();
  @Output() dragging  = new EventEmitter<{ x: number; y: number }>();
  @Output() dragEnd   = new EventEmitter<{ x: number; y: number; data: any }>();

  private isDragging    = false;
  private clickOffsetX  = 0;
  private clickOffsetY  = 0;

  // Position CSS au début du drag — pour détecter si le champ a vraiment bougé
  private initialLeft   = 0;
  private initialTop    = 0;

  private scrollableAncestor: HTMLElement | null = null;

  private mouseMoveListener?:          () => void;
  private mouseUpListener?:            () => void;
  private touchMoveListener?:          () => void;
  private touchEndListener?:           () => void;
  private documentMouseDownListener?:  () => void;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit(): void {
    const element = this.el.nativeElement;
    // Ne pas forcer le curseur move au chargement, seulement pendant le drag
    element.style.userSelect = 'none';
    element.style.position   = 'absolute';

    const handler = (event: MouseEvent) => {
      if (!this.appDraggable || this.isDragging) return;
      const target = event.target as HTMLElement;
      if (!element.contains(target)) return;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isInput) {
        (target as HTMLInputElement).blur();
        requestAnimationFrame(() => this.startDrag(event.clientX, event.clientY));
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('mousedown', handler, { capture: true });
    this.documentMouseDownListener = () =>
      document.removeEventListener('mousedown', handler, { capture: true });
  }

  ngOnDestroy(): void {
    this.removeDocumentListeners();
    this.documentMouseDownListener?.();
  }

  // ─── Listeners globaux ───────────────────────────────────────────────────

  private addDocumentListeners(): void {
    const mouseMoveHandler = (event: MouseEvent) => {
      if (!this.isDragging) return;
      event.preventDefault();
      event.stopPropagation();
      this.drag(event.clientX, event.clientY);
    };
    const mouseUpHandler = () => {
      if (!this.isDragging) return;
      this.endDrag();
    };
    const touchMoveHandler = (event: TouchEvent) => {
      if (!this.isDragging || event.touches.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.drag(event.touches[0].clientX, event.touches[0].clientY);
    };
    const touchEndHandler = () => {
      if (!this.isDragging) return;
      this.endDrag();
    };

    document.addEventListener('mousemove', mouseMoveHandler, { passive: false });
    document.addEventListener('mouseup',   mouseUpHandler);
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend',  touchEndHandler);

    this.mouseMoveListener = () => document.removeEventListener('mousemove', mouseMoveHandler);
    this.mouseUpListener   = () => document.removeEventListener('mouseup',   mouseUpHandler);
    this.touchMoveListener = () => document.removeEventListener('touchmove', touchMoveHandler);
    this.touchEndListener  = () => document.removeEventListener('touchend',  touchEndHandler);
  }

  private removeDocumentListeners(): void {
    this.mouseMoveListener?.(); this.mouseMoveListener = undefined;
    this.mouseUpListener?.();   this.mouseUpListener   = undefined;
    this.touchMoveListener?.(); this.touchMoveListener = undefined;
    this.touchEndListener?.();  this.touchEndListener  = undefined;
  }

  // ─── HostListeners ───────────────────────────────────────────────────────

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (!this.appDraggable || this.isDragging) return;
    const target = event.target as HTMLElement;
    if (!this.el.nativeElement.contains(target)) return;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    event.preventDefault();
    event.stopPropagation();
    this.startDrag(event.clientX, event.clientY);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (!this.appDraggable || this.isDragging || event.touches.length === 0) return;
    const target = event.target as HTMLElement;
    if (!this.el.nativeElement.contains(target)) return;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    event.preventDefault();
    event.stopPropagation();
    this.startDrag(event.touches[0].clientX, event.touches[0].clientY);
  }

  // ─── Logique drag ────────────────────────────────────────────────────────

  private findScrollableAncestor(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style    = window.getComputedStyle(parent);
      const overflow = style.overflow + style.overflowY + style.overflowX;
      if (/auto|scroll/.test(overflow)) return parent;
      parent = parent.parentElement;
    }
    return null;
  }

  private startDrag(clientX: number, clientY: number): void {
    const element = this.el.nativeElement;
    element.style.transform = '';

    this.scrollableAncestor = this.findScrollableAncestor(element);

    const offsetParent = element.offsetParent as HTMLElement;
    if (!offsetParent) return;

    const elementRect = element.getBoundingClientRect();

    this.clickOffsetX = clientX - elementRect.left;
    this.clickOffsetY = clientY - elementRect.top;

    // FIX : mémoriser la position CSS initiale pour détecter si le champ a bougé
    this.initialLeft = parseFloat(element.style.left) || 0;
    this.initialTop  = parseFloat(element.style.top)  || 0;

    this.isDragging = true;
    this.addDocumentListeners();
    this.dragStart.emit(this.dragData);

    element.style.zIndex     = '1000';
    element.style.opacity    = '0.85';
    element.style.boxShadow  = '0 8px 24px rgba(0,0,0,0.2)';
    element.style.transition = 'none';
  }

  private drag(clientX: number, clientY: number): void {
    const element      = this.el.nativeElement;
    const offsetParent = element.offsetParent as HTMLElement;
    if (!offsetParent) return;

    const offsetParentRect = offsetParent.getBoundingClientRect();

    let newLeft = clientX - offsetParentRect.left - this.clickOffsetX;
    let newTop  = clientY - offsetParentRect.top  - this.clickOffsetY;

    if (this.gridSize > 1) {
      newLeft = Math.round(newLeft / this.gridSize) * this.gridSize;
      newTop  = Math.round(newTop  / this.gridSize) * this.gridSize;
    }

    if (this.constrainToParent) {
      newLeft = Math.max(0, Math.min(newLeft, offsetParent.clientWidth  - element.offsetWidth));
      newTop  = Math.max(0, Math.min(newTop,  offsetParent.clientHeight - element.offsetHeight));
    }

    element.style.left = `${newLeft}px`;
    element.style.top  = `${newTop}px`;

    this.dragging.emit({ x: newLeft, y: newTop });
  }

  private endDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.removeDocumentListeners();

    const element  = this.el.nativeElement;
    const finalLeft = parseFloat(element.style.left) || 0;
    const finalTop  = parseFloat(element.style.top)  || 0;

    element.style.zIndex     = '';
    element.style.opacity    = '';
    element.style.boxShadow  = '';
    element.style.transition = '';

    // ─── FIX CLÉ ─────────────────────────────────────────────────────────
    // N'émettre dragEnd QUE si le champ a réellement bougé.
    // Sans ça, un simple clic (sans déplacer) déclenche dragEnd → onFieldDragEnd
    // → recalcule field.y avec une légère erreur → décalage à l'export.
    // Seuil de 2px pour ignorer les micro-mouvements involontaires.
    const hasMoved = Math.abs(finalLeft - this.initialLeft) > 2
      || Math.abs(finalTop  - this.initialTop)  > 2;

    if (!hasMoved) {
      this.scrollableAncestor = null;
      return; // ← ne pas émettre, ne pas modifier field.y
    }
    // ─────────────────────────────────────────────────────────────────────

    this.dragEnd.emit({
      x:    finalLeft,
      y:    finalTop,
      data: this.dragData,
    });

    this.scrollableAncestor = null;
  }
}
