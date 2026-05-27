import type { Vec2 } from './types.js';
import {
  TILE_SIZE,
  FRUIT_SPAWN_THRESHOLDS,
  FRUIT_DURATION,
  FRUIT_MAX_ACTIVE,
  getFruitDef,
} from './constants.js';

export interface FruitState {
  col: number;
  row: number;
  timer: number;
  level: number;
}

export class FruitManager {
  private states: FruitState[] = [];
  private readonly spawnedThresholds = new Set<number>();

  private pickRandomPos(validPositions: Vec2[]): Vec2 | null {
    const occupied = new Set(this.states.map(s => `${s.col},${s.row}`));
    const candidates = validPositions.filter(p => !occupied.has(`${p.x},${p.y}`));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  checkSpawn(dotsEaten: number, level: number, validPositions: Vec2[]): void {
    for (const thresh of FRUIT_SPAWN_THRESHOLDS) {
      if (dotsEaten >= thresh && !this.spawnedThresholds.has(thresh)) {
        if (this.states.length >= FRUIT_MAX_ACTIVE) {
          // At capacity: consume threshold so it won't retry endlessly
          this.spawnedThresholds.add(thresh);
        } else {
          const pos = this.pickRandomPos(validPositions);
          if (pos) {
            this.spawnedThresholds.add(thresh);
            this.states.push({ col: pos.x, row: pos.y, timer: FRUIT_DURATION, level });
          }
          // If pos is null (no valid positions), leave threshold unconsumed to retry next frame
        }
      }
    }
  }

  update(dt: number, playerPixelPos: Vec2): number {
    let totalScore = 0;
    this.states = this.states.filter(state => {
      state.timer -= dt;
      if (state.timer <= 0) return false;

      const fruitX = state.col * TILE_SIZE + TILE_SIZE / 2;
      const fruitY = state.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = playerPixelPos.x - fruitX;
      const dy = playerPixelPos.y - fruitY;
      if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE) {
        totalScore += getFruitDef(state.level).score;
        return false;
      }
      return true;
    });
    return totalScore;
  }

  getStates(): FruitState[] {
    return this.states;
  }

  reset(): void {
    this.states = [];
    this.spawnedThresholds.clear();
  }
}
