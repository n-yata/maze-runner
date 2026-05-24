import type { Direction } from './types.js';

const SWIPE_THRESHOLD = 30;

export class InputManager {
  private buffered: Direction = 'NONE';
  private touchStartX = 0;
  private touchStartY = 0;
  private onStartCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;
  private readonly boundKeyDown = this.onKeyDown.bind(this);
  private readonly boundTouchStart = this.onTouchStart.bind(this);
  private readonly boundTouchEnd = this.onTouchEnd.bind(this);

  constructor() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
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
    }
    if (e.key === ' ' || e.key === 'Enter') {
      this.onStartCallback?.();
    }
    if (e.key === 'Escape') {
      this.onPauseCallback?.();
    }
  }

  private onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    if (!t) return;
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
  }

  private onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
      this.onStartCallback?.();
      return;
    }

    if (absDx > absDy) {
      this.buffered = dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      this.buffered = dy > 0 ? 'DOWN' : 'UP';
    }
  }

  private keyToDirection(key: string): Direction {
    switch (key) {
      case 'ArrowUp':    case 'w': case 'W': return 'UP';
      case 'ArrowDown':  case 's': case 'S': return 'DOWN';
      case 'ArrowLeft':  case 'a': case 'A': return 'LEFT';
      case 'ArrowRight': case 'd': case 'D': return 'RIGHT';
      default: return 'NONE';
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

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchend', this.boundTouchEnd);
  }
}
