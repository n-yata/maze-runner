import { describe, it, expect, beforeEach } from 'vitest';
import { MapManager } from '../../src/map.js';
import { COLS, ROWS, PLAYER_START, GHOST_HOUSE_CENTER } from '../../src/constants.js';

const STAGES = [1, 2, 3];

/** プレイヤー初期位置から壁以外を flood-fill し、到達できたタイル集合を返す（トンネルワープ込み）。 */
function reachableTiles(map: MapManager): Set<string> {
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>();
  const stack: Array<[number, number]> = [[PLAYER_START.x, PLAYER_START.y]];
  visited.add(key(PLAYER_START.x, PLAYER_START.y));

  while (stack.length > 0) {
    const [c, r] = stack.pop()!;
    const neighbors: Array<[number, number]> = [
      [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1],
    ];
    // トンネルワープ: 端のトンネルタイルは反対側の端へ繋がる
    if (map.isTunnel(c, r)) {
      if (c === 0) neighbors.push([COLS - 1, r]);
      if (c === COLS - 1) neighbors.push([0, r]);
    }
    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (map.isWall(nc, nr)) continue;
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      visited.add(k);
      stack.push([nc, nr]);
    }
  }
  return visited;
}

describe('MapManager - グリッド寸法', () => {
  it('盤面は縦長(COLS=15, ROWS=25)である', () => {
    expect(COLS).toBe(15);
    expect(ROWS).toBe(25);
  });

  it('縦長かつ左右対称が成立する寸法（ROWS>COLS・COLSは奇数）', () => {
    expect(ROWS).toBeGreaterThan(COLS);
    expect(COLS % 2).toBe(1);
  });
});

describe.each(STAGES)('MapManager - ステージ %i の構造', (level) => {
  let map: MapManager;

  beforeEach(() => {
    map = new MapManager();
    map.reset(level);
  });

  it('外周は壁で囲まれている', () => {
    for (let c = 0; c < COLS; c++) {
      expect(map.isWall(c, 0)).toBe(true);
      expect(map.isWall(c, ROWS - 1)).toBe(true);
    }
    for (let r = 0; r < ROWS; r++) {
      // 端の列はトンネル行を除いて壁
      if (!map.isTunnel(0, r)) expect(map.isWall(0, r)).toBe(true);
      if (!map.isTunnel(COLS - 1, r)) expect(map.isWall(COLS - 1, r)).toBe(true);
    }
  });

  it('左右対称である', () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(map.tileAt(c, r)).toBe(map.tileAt(COLS - 1 - c, r));
      }
    }
  });

  it('トンネルが両端に存在する', () => {
    let leftTunnel = false;
    let rightTunnel = false;
    for (let r = 0; r < ROWS; r++) {
      if (map.isTunnel(0, r)) leftTunnel = true;
      if (map.isTunnel(COLS - 1, r)) rightTunnel = true;
    }
    expect(leftTunnel).toBe(true);
    expect(rightTunnel).toBe(true);
  });

  it('ゴーストハウス中心は通行可能', () => {
    expect(map.isWall(GHOST_HOUSE_CENTER.x, GHOST_HOUSE_CENTER.y)).toBe(false);
  });

  it('プレイヤー初期位置は通行可能', () => {
    expect(map.isWall(PLAYER_START.x, PLAYER_START.y)).toBe(false);
  });

  it('全てのドット/パワーエサがプレイヤー初期位置から到達可能（到達不能ドットなし）', () => {
    const reachable = reachableTiles(map);
    const unreachable: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (map.isDot(c, r) || map.isPowerDot(c, r)) {
          if (!reachable.has(`${c},${r}`)) unreachable.push(`(${c},${r})`);
        }
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('ドットが十分に存在する（プレイ可能）', () => {
    expect(map.getRemainingDots()).toBeGreaterThan(50);
  });

  it('パワーエサが存在する', () => {
    expect(map.getPowerDotCount()).toBeGreaterThan(0);
  });
});

describe('MapManager - ドット操作', () => {
  let map: MapManager;

  beforeEach(() => {
    map = new MapManager();
  });

  it('ドットを食べると残数が1減る', () => {
    // 最初に見つかるドットを食べる
    let target: [number, number] | null = null;
    for (let r = 0; r < ROWS && !target; r++) {
      for (let c = 0; c < COLS; c++) {
        if (map.isDot(c, r)) { target = [c, r]; break; }
      }
    }
    expect(target).not.toBeNull();
    const before = map.getRemainingDots();
    map.eatDot(target![0], target![1]);
    expect(map.getRemainingDots()).toBe(before - 1);
  });

  it('壁の位置を食べても残数は変わらない', () => {
    const before = map.getRemainingDots();
    map.eatDot(0, 0); // wall
    expect(map.getRemainingDots()).toBe(before);
  });

  it('reset で食べたドットが復活する', () => {
    const total = map.getTotalDots();
    let eaten = 0;
    for (let r = 0; r < ROWS && eaten < 3; r++) {
      for (let c = 0; c < COLS && eaten < 3; c++) {
        if (map.isDot(c, r)) { map.eatDot(c, r); eaten++; }
      }
    }
    map.reset();
    expect(map.getRemainingDots()).toBe(total);
  });
});

describe('MapManager - isWall 境界', () => {
  let map: MapManager;
  beforeEach(() => { map = new MapManager(); });

  it('範囲外座標は壁扱い', () => {
    expect(map.isWall(-1, 0)).toBe(true);
    expect(map.isWall(0, -1)).toBe(true);
    expect(map.isWall(COLS, 0)).toBe(true);
    expect(map.isWall(0, ROWS)).toBe(true);
  });
});

describe('MapManager - wrapCol', () => {
  let map: MapManager;
  beforeEach(() => { map = new MapManager(); });

  it('負の列は右端に折り返す', () => {
    expect(map.wrapCol(-1)).toBe(COLS - 1);
  });
  it('最大を超える列は0に折り返す', () => {
    expect(map.wrapCol(COLS)).toBe(0);
  });
  it('有効範囲の列はそのまま', () => {
    expect(map.wrapCol(10)).toBe(10);
  });
});

describe('MapManager - getValidFruitPositions', () => {
  let map: MapManager;
  beforeEach(() => { map = new MapManager(); });

  it('空でないリストを返す', () => {
    expect(map.getValidFruitPositions().length).toBeGreaterThan(0);
  });

  it('返された位置は壁でもトンネルでもない', () => {
    for (const pos of map.getValidFruitPositions()) {
      expect(map.isWall(pos.x, pos.y)).toBe(false);
      expect(map.isTunnel(pos.x, pos.y)).toBe(false);
    }
  });
});

describe('MapManager - ボス闘技場 (resetBossArena)', () => {
  let map: MapManager;
  beforeEach(() => {
    map = new MapManager();
    map.resetBossArena();
  });

  it('外周は壁で囲まれている', () => {
    for (let c = 0; c < COLS; c++) {
      expect(map.isWall(c, 0)).toBe(true);
      expect(map.isWall(c, ROWS - 1)).toBe(true);
    }
    for (let r = 0; r < ROWS; r++) {
      expect(map.isWall(0, r)).toBe(true);
      expect(map.isWall(COLS - 1, r)).toBe(true);
    }
  });

  it('内部は開けている（レーザーが上方のボスへ遮蔽なく届くよう内部に壁を置かない）', () => {
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        expect(map.isWall(c, r)).toBe(false);
      }
    }
  });

  it('プレイヤー初期位置から全通路へ到達できる（孤立がない）', () => {
    const reachable = reachableTiles(map);
    let passable = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!map.isWall(c, r)) passable++;
      }
    }
    expect(reachable.size).toBe(passable);
  });

  it('エサ(ドット/パワーエサ)を一切配置しない（常時ビーム・ハート制のため）', () => {
    let dots = 0;
    let power = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (map.isDot(c, r)) dots++;
        if (map.isPowerDot(c, r)) power++;
      }
    }
    expect(dots).toBe(0);
    expect(power).toBe(0);
    expect(map.getRemainingDots()).toBe(0);
  });
});
