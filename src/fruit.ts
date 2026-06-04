import type { Vec2 } from './types.js';
import {
  TILE_SIZE,
  FRUIT_DURATION,
  FRUIT_FIRST_DELAY,
  FRUIT_RESPAWN_INTERVAL,
} from './constants.js';

export interface FruitState {
  col: number;
  row: number;
  timer: number;
  level: number;
}

/**
 * フルーツ（レーザー発動アイテム）の管理。
 * 敵が残っている限り、盤面に常に最大1個のフルーツを一定間隔で出現させる（詰み防止）。
 * 取得するとレーザーモードが発動する（スコアは付与しない）。
 */
export class FruitManager {
  private states: FruitState[] = [];
  private spawnCooldown = FRUIT_FIRST_DELAY;

  private pickRandomPos(validPositions: Vec2[]): Vec2 | null {
    const occupied = new Set(this.states.map(s => `${s.col},${s.row}`));
    const candidates = validPositions.filter(p => !occupied.has(`${p.x},${p.y}`));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  /**
   * 敵が残る限り、盤面にフルーツが無ければクールダウン経過ごとに1個出現させる。
   * これにより取り逃しや撃ち漏らしがあっても必ず再びレーザーを得られる（詰まない）。
   */
  updateSpawning(dt: number, enemiesRemain: boolean, level: number, validPositions: Vec2[]): void {
    if (!enemiesRemain) return;
    // 盤面にフルーツがある間はクールダウンを進めない（早期 return）。
    // よって再出現は「盤面から消えてから FRUIT_RESPAWN_INTERVAL 秒後」になる。
    if (this.states.length > 0) return;

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      const pos = this.pickRandomPos(validPositions);
      if (pos) {
        this.states.push({ col: pos.x, row: pos.y, timer: FRUIT_DURATION, level });
        this.spawnCooldown = FRUIT_RESPAWN_INTERVAL;
      }
      // pos が null（候補なし）の場合は次フレームに再試行
    }
  }

  /**
   * フルーツの寿命を進め、プレイヤーが重なったフルーツを取得する。
   * 今フレームで取得したフルーツ数を返す（>0 ならレーザー発動）。
   */
  update(dt: number, playerPixelPos: Vec2): number {
    let eaten = 0;
    this.states = this.states.filter(state => {
      state.timer -= dt;
      if (state.timer <= 0) return false;

      const fruitX = state.col * TILE_SIZE + TILE_SIZE / 2;
      const fruitY = state.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = playerPixelPos.x - fruitX;
      const dy = playerPixelPos.y - fruitY;
      if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE) {
        eaten++;
        return false;
      }
      return true;
    });
    return eaten;
  }

  getStates(): FruitState[] {
    return this.states;
  }

  reset(): void {
    this.states = [];
    this.spawnCooldown = FRUIT_FIRST_DELAY;
  }
}
