import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Renderer2,
} from '@angular/core';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

@Directive({
  selector: '[appResizable]',
  standalone: true,
})
export class ResizableDirective implements OnInit, OnDestroy, OnChanges {
  @Input() appResizable = true;
  @Input() resizeData: any;
  @Input() minWidth = 50;
  @Input() minHeight = 30;

  @Output() resizeStart = new EventEmitter<any>();
  @Output() resizing    = new EventEmitter<{ width: number; height: number; x: number; y: number }>();
  @Output() resizeEnd   = new EventEmitter<{ width: number; height: number; x: number; y: number; data: any }>();

  private isResizing     = false;
  private currentHandle: ResizeHandle | null = null;

  // Position de la souris au début du resize (viewport)
  private mouseStartX = 0;
  private mouseStartY = 0;

  // Dimensions et position de l'élément au début du resize
  // EN COORDONNÉES RELATIVES À offsetParent (left/top CSS)
  private startWidth  = 0;
  private startHeight = 0;
  private startLeft   = 0; // px relatifs à offsetParent
  private startTop    = 0; // px relatifs à offsetParent

  private handles: HTMLElement[] = [];
  private mouseMoveListener?: () => void;
  private mouseUpListener?:   () => void;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    if (this.appResizable) {
      this.createHandles();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['appResizable']) {
      if (this.appResizable && this.handles.length === 0) {
        this.createHandles();
      } else if (!this.appResizable && this.handles.length > 0) {
        this.removeHandles();
      }
    }
    
    // Afficher les poignées si l'élément devient redimensionnable
    if (this.appResizable && this.handles.length > 0) {
      this.showHandles();
    } else if (!this.appResizable) {
      this.hideHandles();
    }
  }

  ngOnDestroy(): void {
    this.removeHandles();
    this.removeDocumentListeners();
  }

  // ─── Création des poignées ───────────────────────────────────────────────

  private createHandles(): void {
    const handleTypes: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const element = this.el.nativeElement;

    handleTypes.forEach(handle => {
      const handleEl = this.renderer.createElement('div') as HTMLElement;
      this.renderer.addClass(handleEl, 'resize-handle');
      this.renderer.addClass(handleEl, `resize-handle-${handle}`);

      const styles: Record<string, string> = {
        position:       'absolute',
        zIndex:         '1001',
        background:     '#3182ce',
        border:         '2px solid white',
        borderRadius:   '50%',
        width:          '12px',
        height:         '12px',
        cursor:         this.getCursor(handle),
        opacity:        '0',
        transition:     'opacity 0.2s',
        pointerEvents:  'auto',
        boxSizing:      'border-box',
      };
      Object.entries(styles).forEach(([k, v]) =>
        this.renderer.setStyle(handleEl, k, v)
      );

      this.positionHandle(handleEl, handle);

      this.renderer.listen(handleEl, 'mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.startResize(e, handle);
      });

      this.renderer.appendChild(element, handleEl);
      this.handles.push(handleEl);
    });

    // Afficher les poignées au survol OU si l'élément est déjà redimensionnable
    this.renderer.listen(element, 'mouseenter', () => {
      if (this.appResizable) this.showHandles();
    });
    this.renderer.listen(element, 'mouseleave', () => {
      if (!this.isResizing && !this.appResizable) this.hideHandles();
    });
  }

  private positionHandle(handleEl: HTMLElement, handle: ResizeHandle): void {
    const center = { top: '50%', transform: 'translateY(-50%)' };
    const mid    = { left: '50%', transform: 'translateX(-50%)' };

    const positions: Record<ResizeHandle, Record<string, string>> = {
      nw: { top: '-6px',    left: '-6px'  },
      n:  { top: '-6px',    ...mid        },
      ne: { top: '-6px',    right: '-6px' },
      e:  { right: '-6px',  ...center     },
      se: { bottom: '-6px', right: '-6px' },
      s:  { bottom: '-6px', ...mid        },
      sw: { bottom: '-6px', left: '-6px'  },
      w:  { left: '-6px',   ...center     },
    };

    Object.entries(positions[handle]).forEach(([k, v]) =>
      this.renderer.setStyle(handleEl, k, v)
    );
  }

  private getCursor(handle: ResizeHandle): string {
    return ({
      nw: 'nw-resize', n: 'n-resize',  ne: 'ne-resize',
      e:  'e-resize',  se: 'se-resize', s:  's-resize',
      sw: 'sw-resize', w:  'w-resize',
    } as Record<ResizeHandle, string>)[handle];
  }

  private showHandles(): void {
    this.handles.forEach(h => this.renderer.setStyle(h, 'opacity', '1'));
  }

  private hideHandles(): void {
    this.handles.forEach(h => this.renderer.setStyle(h, 'opacity', '0'));
  }

  private removeHandles(): void {
    this.handles.forEach(h =>
      this.renderer.removeChild(this.el.nativeElement, h)
    );
    this.handles = [];
  }

  // ─── Logique de resize ───────────────────────────────────────────────────

  private startResize(event: MouseEvent, handle: ResizeHandle): void {
    if (!this.appResizable) return;

    const element      = this.el.nativeElement;
    const offsetParent = element.offsetParent as HTMLElement;
    if (!offsetParent) return;

    this.isResizing     = true;
    this.currentHandle  = handle;

    // Position souris en viewport
    this.mouseStartX = event.clientX;
    this.mouseStartY = event.clientY;

    // FIX CLÉ : lire left/top depuis le style CSS (coordonnées relatives à offsetParent)
    // et NON depuis getBoundingClientRect() qui donne le viewport
    this.startWidth  = element.offsetWidth;
    this.startHeight = element.offsetHeight;
    this.startLeft   = parseFloat(element.style.left)  || 0;
    this.startTop    = parseFloat(element.style.top)   || 0;

    this.addDocumentListeners();
    this.resizeStart.emit(this.resizeData);
  }

  private addDocumentListeners(): void {
    const mouseMoveHandler = (event: MouseEvent) => {
      if (!this.isResizing || !this.currentHandle) return;
      event.preventDefault();
      event.stopPropagation();
      this.resize(event.clientX, event.clientY);
    };

    const mouseUpHandler = () => {
      if (!this.isResizing) return;
      this.endResize();
    };

    document.addEventListener('mousemove', mouseMoveHandler, { passive: false });
    document.addEventListener('mouseup',   mouseUpHandler);

    this.mouseMoveListener = () => document.removeEventListener('mousemove', mouseMoveHandler);
    this.mouseUpListener   = () => document.removeEventListener('mouseup',   mouseUpHandler);
  }

  private removeDocumentListeners(): void {
    this.mouseMoveListener?.(); this.mouseMoveListener = undefined;
    this.mouseUpListener?.();   this.mouseUpListener   = undefined;
  }

  private resize(clientX: number, clientY: number): void {
    if (!this.currentHandle) return;

    const deltaX = clientX - this.mouseStartX;
    const deltaY = clientY - this.mouseStartY;

    let newWidth  = this.startWidth;
    let newHeight = this.startHeight;
    let newLeft   = this.startLeft;
    let newTop    = this.startTop;

    const h = this.currentHandle;

    // Calcul des nouvelles dimensions selon la poignée
    if (h.includes('e')) newWidth  = Math.max(this.minWidth,  this.startWidth  + deltaX);
    if (h.includes('s')) newHeight = Math.max(this.minHeight, this.startHeight + deltaY);

    if (h.includes('w')) {
      newWidth = Math.max(this.minWidth, this.startWidth - deltaX);
      // Décaler left pour que le bord droit reste fixe
      newLeft  = this.startLeft + (this.startWidth - newWidth);
    }
    if (h.includes('n')) {
      newHeight = Math.max(this.minHeight, this.startHeight - deltaY);
      // Décaler top pour que le bord bas reste fixe
      newTop    = this.startTop + (this.startHeight - newHeight);
    }

    // Appliquer — tout en coordonnées relatives à offsetParent
    const element = this.el.nativeElement;
    element.style.setProperty('width',  `${newWidth}px`,  'important');
    element.style.setProperty('height', `${newHeight}px`, 'important');
    element.style.setProperty('left',   `${newLeft}px`,   'important');
    element.style.setProperty('top',    `${newTop}px`,    'important');

    this.resizing.emit({ width: newWidth, height: newHeight, x: newLeft, y: newTop });
  }

  private endResize(): void {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.removeDocumentListeners();
    this.hideHandles();

    const element = this.el.nativeElement;

    // FIX : émettre les coordonnées relatives à offsetParent (left/top CSS)
    // et NON getBoundingClientRect() qui donne le viewport
    const finalLeft   = parseFloat(element.style.left)   || 0;
    const finalTop    = parseFloat(element.style.top)    || 0;
    const finalWidth  = parseFloat(element.style.width)  || element.offsetWidth;
    const finalHeight = parseFloat(element.style.height) || element.offsetHeight;

    this.resizeEnd.emit({
      width:  finalWidth,
      height: finalHeight,
      x:      finalLeft,   // ← relatif à offsetParent, cohérent avec DraggableDirective
      y:      finalTop,    // ← relatif à offsetParent, cohérent avec DraggableDirective
      data:   this.resizeData,
    });

    this.currentHandle = null;
  }
}
