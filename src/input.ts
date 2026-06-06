import type { Direction } from './types.js';

const SWIPE_THRESHOLD = 30;
const HOLD_THRESHOLD = 12; // ボス戦のホールド移動: タッチ開始位置からこのpx以上ずれたら移動方向とみなす

export class InputManager {
  private buffered: Direction = 'NONE';
  private touchStartX = 0;
  private touchStartY = 0;
  // ホールド入力（ボス戦のシューティング操作用）: 押されている/スライドしている間だけ方向が立つ
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

  constructor() {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: true });
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
      this.heldKeys.add(dir);
      if (!this.touching) this.heldDir = dir; // 押下中はホールド方向を立てる
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
      if (!this.touching) this.heldDir = this.latestHeldKey(); // 離したらホールドを更新（残りキー or NONE）
    }
  }

  /** まだ押されているキーから優先順（横→縦）でホールド方向を決める。なければ NONE。 */
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
    this.touching = true;
    this.heldDir = 'NONE'; // スライドするまでは停止
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.touching) return;
    const t = e.touches[0];
    if (!t) return;
    // タッチ開始位置からの変位でホールド方向を決める（離すまで＝スライド保持中は動き続ける）
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx >= HOLD_THRESHOLD && absDx >= absDy) {
      this.heldDir = dx > 0 ? 'RIGHT' : 'LEFT';
    } else if (absDy >= HOLD_THRESHOLD && absDy > absDx) {
      this.heldDir = dy > 0 ? 'DOWN' : 'UP';
    } else {
      this.heldDir = 'NONE'; // 中心付近（デッドゾーン）では停止
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    this.touching = false;
    this.heldDir = this.latestHeldKey(); // タッチを離したら停止（キー押下があればそれを継続）
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

    // 既存のスワイプ操作（迷路フェーズの方向予約）は従来どおり維持する
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

  pushDirection(dir: Direction): void {
    this.buffered = dir;
  }

  /** 現在ホールド中（キー押下 or タッチでスライド中）の方向。押していなければ NONE。ボス戦の移動に使う。 */
  getHeldDirection(): Direction {
    return this.heldDir;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
  }
}
