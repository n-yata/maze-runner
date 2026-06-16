import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../../src/input.js';

function keydown(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}
function keyup(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}
function touch(type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', x: number, y: number): void {
  const touchPoint = { clientX: x, clientY: y };
  const event = new Event(type) as Event & {
    touches: Array<{ clientX: number; clientY: number }>;
    changedTouches: Array<{ clientX: number; clientY: number }>;
  };
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [touchPoint],
  });
  Object.defineProperty(event, 'changedTouches', { value: [touchPoint] });
  window.dispatchEvent(event);
}

describe('InputManager - held direction (boss shooting controls)', () => {
  let input: InputManager;
  beforeEach(() => { input = new InputManager(); });
  afterEach(() => { input.destroy(); });

  it('holds the direction while a key is down and clears on release', () => {
    expect(input.getHeldDirection()).toBe('NONE');
    keydown('ArrowRight');
    expect(input.getHeldDirection()).toBe('RIGHT');
    keyup('ArrowRight');
    expect(input.getHeldDirection()).toBe('NONE'); // 離したら停止
  });

  it('falls back to a still-pressed key when another is released', () => {
    keydown('ArrowLeft');
    keydown('ArrowRight');
    expect(input.getHeldDirection()).toBe('RIGHT');
    keyup('ArrowRight');
    expect(input.getHeldDirection()).toBe('LEFT'); // 左はまだ押している
    keyup('ArrowLeft');
    expect(input.getHeldDirection()).toBe('NONE');
  });

  it('still buffers a one-shot direction for maze movement (consumeDirection)', () => {
    keydown('ArrowUp');
    expect(input.consumeDirection()).toBe('UP');
    expect(input.consumeDirection()).toBe('NONE'); // 消費後はクリアされる
  });

  it('treats WASD the same as arrow keys for held direction', () => {
    keydown('a'); // = LEFT
    expect(input.getHeldDirection()).toBe('LEFT');
    keyup('a');
    expect(input.getHeldDirection()).toBe('NONE');
  });

  it('exposes a touch pad state while touching and clears it on release', () => {
    touch('touchstart', 120, 240);

    expect(input.getTouchPadState()).toEqual({
      active: true,
      startX: 120,
      startY: 240,
      currentX: 120,
      currentY: 240,
      direction: 'NONE',
    });

    touch('touchmove', 168, 244);
    expect(input.getHeldDirection()).toBe('RIGHT');
    expect(input.getTouchPadState()).toMatchObject({
      active: true,
      currentX: 168,
      currentY: 244,
      direction: 'RIGHT',
    });

    touch('touchend', 168, 244);
    expect(input.getTouchPadState().active).toBe(false);
    expect(input.consumeDirection()).toBe('RIGHT');
  });

  it('clears touch pad state on touch cancel without buffering a swipe', () => {
    touch('touchstart', 120, 240);
    touch('touchmove', 120, 280);
    expect(input.getTouchPadState().active).toBe(true);
    expect(input.getHeldDirection()).toBe('DOWN');

    touch('touchcancel', 120, 280);
    expect(input.getTouchPadState().active).toBe(false);
    expect(input.getHeldDirection()).toBe('NONE');
    expect(input.consumeDirection()).toBe('NONE');
  });
});
