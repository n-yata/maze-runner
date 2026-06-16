import type { Direction } from './types.js';

const SWIPE_THRESHOLD = 30;
const HOLD_THRESHOLD = 12;

export interface TouchPadState {
  readonly active: boolean;
  readonly startX: number;
  readonly startY: number;
  readonly currentX: number;
  readonly currentY: number;
  readonly direction: Direction;
}

const INACTIVE_TOUCH_PAD: TouchPadState = {
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  direction: 'NONE',
};

export class InputManager {
  private buffered: Direction = 'NONE';
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private touchCurrentY = 0;
  private heldDir: Direction = 'NONE';
  private heldKeys = new Set<Direction>();
  private touching = false;
  private onStartCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;
  private readonly boundKeyDown = this.onKeyDown.bind(this);
  private readonly boundKeyUp = this.onKeyUp.bind(this);
  private readonly boundTouchStart = this.onTouchStart.bind(this);
  private readonly boundTouchMove = this.onTouchMove.bind(this);
  private readonly boundTouchEnd = this.onTouchEnd.bind(this);
  private readonly boundTouchCancel = this.onTouchCancel.bind(this);

  constructor() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: true });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.boundTouchCancel, { passive: true });
  }

  onStart(cb: () => void): void {
    this.onStartCallback = cb;
  }

  onPause(cb: () => void): void {
    this.onPauseCallback = cb;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const dir = this.keyToDirection(e.key);
    if (dir !== 'NONE') {
      e.preventDefault();
      this.buffered = dir;
      this.heldKeys.add(dir);
      if (!this.touching) this.heldDir = dir;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      this.onStartCallback?.();
    }
    if (e.key === 'Escape') {
      this.onPauseCallback?.();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const dir = this.keyToDirection(e.key);
    if (dir !== 'NONE') {
      this.heldKeys.delete(dir);
      if (!this.touching) this.heldDir = this.latestHeldKey();
    }
  }

  private latestHeldKey(): Direction {
    if (this.heldKeys.has('RIGHT')) return 'RIGHT';
    if (this.heldKeys.has('LEFT')) return 'LEFT';
    if (this.heldKeys.has('UP')) return 'UP';
    if (this.heldKeys.has('DOWN')) return 'DOWN';
    return 'NONE';
  }

  private onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    if (!t) return;
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchCurrentX = t.clientX;
    this.touchCurrentY = t.clientY;
    this.touching = true;
    this.heldDir = 'NONE';
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.touching) return;
    const t = e.touches[0];
    if (!t) return;
    this.touchCurrentX = t.clientX;
    this.touchCurrentY = t.clientY;
    this.heldDir = this.directionFromDelta(t.clientX - this.touchStartX, t.clientY - this.touchStartY, HOLD_THRESHOLD);
  }

  private onTouchEnd(e: TouchEvent): void {
    this.touching = false;
    this.heldDir = this.latestHeldKey();
    const t = e.changedTouches[0];
    if (!t) return;
    this.touchCurrentX = t.clientX;
    this.touchCurrentY = t.clientY;

    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const dir = this.directionFromDelta(dx, dy, SWIPE_THRESHOLD);
    if (dir === 'NONE') {
      this.onStartCallback?.();
      return;
    }
    this.buffered = dir;
  }

  private onTouchCancel(): void {
    this.touching = false;
    this.heldDir = this.latestHeldKey();
  }

  private directionFromDelta(dx: number, dy: number, threshold: number): Direction {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < threshold && absDy < threshold) return 'NONE';
    if (absDx >= absDy) return dx > 0 ? 'RIGHT' : 'LEFT';
    return dy > 0 ? 'DOWN' : 'UP';
  }

  private keyToDirection(key: string): Direction {
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        return 'UP';
      case 'ArrowDown':
      case 's':
      case 'S':
        return 'DOWN';
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return 'LEFT';
      case 'ArrowRight':
      case 'd':
      case 'D':
        return 'RIGHT';
      default:
        return 'NONE';
    }
  }

  consumeDirection(): Direction {
    const d = this.buffered;
    this.buffered = 'NONE';
    return d;
  }

  peekDirection(): Direction {
    return this.buffered;
  }

  pushDirection(dir: Direction): void {
    this.buffered = dir;
  }

  getHeldDirection(): Direction {
    return this.heldDir;
  }

  getTouchPadState(): TouchPadState {
    if (!this.touching) return INACTIVE_TOUCH_PAD;
    return {
      active: true,
      startX: this.touchStartX,
      startY: this.touchStartY,
      currentX: this.touchCurrentX,
      currentY: this.touchCurrentY,
      direction: this.heldDir,
    };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('touchcancel', this.boundTouchCancel);
  }
}
