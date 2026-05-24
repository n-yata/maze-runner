import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../../src/storage.js';

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager();
  });

  it('returns 0 when no high score stored', () => {
    expect(storage.getHighScore()).toBe(0);
  });

  it('stores a high score', () => {
    storage.setHighScore(1500);
    expect(storage.getHighScore()).toBe(1500);
  });

  it('only updates if new score is higher', () => {
    storage.setHighScore(1000);
    storage.setHighScore(500);
    expect(storage.getHighScore()).toBe(1000);
  });

  it('updates when new score exceeds current high score', () => {
    storage.setHighScore(1000);
    storage.setHighScore(2000);
    expect(storage.getHighScore()).toBe(2000);
  });

  it('clears the high score', () => {
    storage.setHighScore(999);
    storage.clear();
    expect(storage.getHighScore()).toBe(0);
  });

  it('returns 0 for corrupted localStorage value', () => {
    localStorage.setItem('mazerun_highscore', 'not-a-number');
    expect(storage.getHighScore()).toBe(0);
  });
});
