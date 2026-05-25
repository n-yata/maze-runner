import type { Vec2 } from './types.js';
import {
  TILE_SIZE,
  FRUIT_SPAWN_THRESHOLDS,
  FRUIT_DURATION,
  FRUIT_SPAWN_POS,
  getFruitDef,
} from './constants.js';

export interface FruitState {
  col: number;
  row: number;
  timer: number;
  level: number;
}

export class FruitManager {
  private state: FruitState | null = null;
  private readonly spawnedThresholds = new Set<number>();

  checkSpawn(dotsEaten: number, level: number): void {
    if (this.state) return;
    for (const thresh of FRUIT_SPAWN_THRESHOLDS) {
      if (dotsEaten >= thresh && !this.spawnedThresholds.has(thresh)) {
        this.spawnedThresholds.add(thresh);
        this.state = {
          col: FRUIT_SPAWN_POS.x,
          row: FRUIT_SPAWN_POS.y,
          timer: FRUIT_DURATION,
          level,
        };
        return;
      }
    }
  }

  update(dt: number, playerPixelPos: Vec2): number {
    if (!this.state) return 0;

    this.state.timer -= dt;
    if (this.state.timer <= 0) {
      this.state = null;
      return 0;
    }

    const fruitX = this.state.col * TILE_SIZE + TILE_SIZE / 2;
    const fruitY = this.state.row * TILE_SIZE + TILE_SIZE / 2;
    const dx = playerPixelPos.x - fruitX;
    const dy = playerPixelPos.y - fruitY;
    if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE) {
      const score = getFruitDef(this.state.level).score;
      this.state = null;
      return score;
    }

    return 0;
  }

  getState(): FruitState | null {
    return this.state;
  }

  reset(): void {
    this.state = null;
    this.spawnedThresholds.clear();
  }
}
