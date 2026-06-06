import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from '../../src/input.js';

function keydown(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}
function keyup(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
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
});
