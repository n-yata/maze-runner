import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.allocUnsafe(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

function encodePNG(w, h, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  const rowBytes = w * 4;
  const raw = Buffer.allocUnsafe((rowBytes + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (rowBytes + 1)] = 0;
    px.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 6 })), pngChunk('IEND', Buffer.alloc(0))]);
}

// 宇宙テーマの配色（src/constants.ts と対応）
const C = {
  BG:        [5, 6, 15],       // #05060F 深宇宙
  WALL:      [39, 71, 200],    // #2747C8 コロニー壁
  CORE:      [255, 230, 109],  // #FFE66D コア（パワー）
  CORE_GLOW: [80, 73, 43],     // CORE を背景に 30% で重ねた近似グロー
  CRYSTAL:   [125, 240, 255],  // #7DF0FF エネルギー結晶
  SHIP:      [159, 208, 255],  // #9FD0FF 宇宙船ハル
  COCKPIT:   [6, 50, 74],      // #06324A コックピット
  THRUSTER:  [255, 138, 60],   // #FF8A3C 推進炎
  ALIEN_RED: [255, 77, 94],    // #FF4D5E 赤エイリアン
  ALIEN_CYAN:[77, 224, 255],   // #4DE0FF シアンエイリアン
  EYE:       [255, 255, 255],  // 目（白）
  PUPIL:     [10, 10, 26],     // #0A0A1A 瞳
  STAR:      [200, 210, 235],  // 星（控えめな白）
};

function sp(px, w, h, x, y, rgb) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255;
}

function fillRect(px, w, h, rx, ry, rw, rh, rgb) {
  for (let y = Math.max(0, Math.round(ry)); y < Math.min(h, Math.round(ry + rh)); y++)
    for (let x = Math.max(0, Math.round(rx)); x < Math.min(w, Math.round(rx + rw)); x++)
      sp(px, w, h, x, y, rgb);
}

function fillCircle(px, w, h, cx, cy, rad, rgb) {
  const r2 = rad * rad;
  for (let y = Math.max(0, Math.floor(cy - rad - 1)); y <= Math.min(h - 1, Math.ceil(cy + rad + 1)); y++)
    for (let x = Math.max(0, Math.floor(cx - rad - 1)); x <= Math.min(w - 1, Math.ceil(cx + rad + 1)); x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2)
        sp(px, w, h, x, y, rgb);
}

// 上半円（ドーム）。dy <= 0 かつ円内のみ塗る
function fillDome(px, w, h, cx, cy, rad, rgb) {
  const r2 = rad * rad;
  for (let y = Math.max(0, Math.floor(cy - rad - 1)); y <= Math.min(h - 1, Math.ceil(cy)); y++)
    for (let x = Math.max(0, Math.floor(cx - rad - 1)); x <= Math.min(w - 1, Math.ceil(cx + rad + 1)); x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2)
        sp(px, w, h, x, y, rgb);
}

// 多角形スキャンライン塗りつぶし。pts = [[x,y], ...]
function fillPoly(px, w, h, pts, rgb) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
        xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xStart = Math.max(0, Math.round(xs[k]));
      const xEnd = Math.min(w - 1, Math.round(xs[k + 1]));
      for (let x = xStart; x <= xEnd; x++) sp(px, w, h, x, y, rgb);
    }
  }
}

// 太さ width の線分を矩形ポリゴンとして塗る
function fillLine(px, w, h, x1, y1, x2, y2, width, rgb) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (width / 2);
  const oy = (dx / len) * (width / 2);
  fillPoly(px, w, h, [
    [x1 + ox, y1 + oy], [x2 + ox, y2 + oy],
    [x2 - ox, y2 - oy], [x1 - ox, y1 - oy],
  ], rgb);
}

// エイリアン（ドーム頭＋波打つ底＋大きな目＋触角）。SVG と同一構図
function drawAlien(px, w, h, cx, cy, r, color) {
  // 触角（2本＋先端の発光球）
  for (const s of [-0.4 * r, 0.4 * r]) {
    fillLine(px, w, h, cx + s * 0.6, cy - 0.5 * r, cx + s, cy - 1.15 * r, Math.max(2, r * 0.09), color);
    fillCircle(px, w, h, cx + s, cy - 1.25 * r, Math.max(2, r * 0.18), color);
  }
  // 頭（ドーム）
  fillDome(px, w, h, cx, cy, r, color);
  // 体＋波打つ底（多角形）
  fillPoly(px, w, h, [
    [cx - r, cy], [cx + r, cy],
    [cx + r, cy + r], [cx + 0.5 * r, cy + 0.55 * r],
    [cx, cy + r], [cx - 0.5 * r, cy + 0.55 * r],
    [cx - r, cy + r],
  ], color);
  // 大きな目＋瞳
  fillCircle(px, w, h, cx, cy - 0.05 * r, 0.5 * r, C.EYE);
  fillCircle(px, w, h, cx, cy - 0.05 * r, 0.24 * r, C.PUPIL);
}

function generateIcon(size) {
  const w = size, h = size;
  const px = Buffer.alloc(w * h * 4);
  const sc = size / 512;
  const S = (v) => v * sc;

  // 深宇宙の背景
  fillRect(px, w, h, 0, 0, w, h, C.BG);

  // 星々
  for (const [sx, sy, sr] of [
    [70, 300, 2], [120, 430, 1.5], [250, 260, 1.5], [300, 430, 2], [430, 320, 1.5],
    [450, 440, 2], [190, 350, 1.5], [380, 380, 1.5], [60, 120, 1.5], [470, 130, 2],
  ]) fillCircle(px, w, h, S(sx), S(sy), Math.max(1, S(sr)), C.STAR);

  // コロニー外壁（枠）
  const bw = Math.max(2, Math.round(S(28)));
  fillRect(px, w, h, 0, 0, w, bw, C.WALL);
  fillRect(px, w, h, 0, h - bw, w, bw, C.WALL);
  fillRect(px, w, h, 0, 0, bw, h, C.WALL);
  fillRect(px, w, h, w - bw, 0, bw, h, C.WALL);

  // コロニー通路（内壁アクセント）
  for (const [x, y, rw, rh] of [
    [56, 60, 120, 22], [336, 60, 120, 22], [56, 60, 22, 70], [434, 60, 22, 70],
  ]) fillRect(px, w, h, S(x), S(y), S(rw), S(rh), C.WALL);

  // コア（グロー＋本体）
  for (const cxv of [110, 402]) {
    fillCircle(px, w, h, S(cxv), S(120), S(26), C.CORE_GLOW);
    fillCircle(px, w, h, S(cxv), S(120), S(15), C.CORE);
  }

  // エネルギー結晶（ドット）
  for (const [dx, dy] of [[180, 120], [256, 120], [332, 120], [256, 200]])
    fillCircle(px, w, h, S(dx), S(dy), Math.max(2, S(9)), C.CRYSTAL);

  // エイリアン2体
  drawAlien(px, w, h, S(150), S(185), S(54), C.ALIEN_RED);
  drawAlien(px, w, h, S(378), S(205), S(46), C.ALIEN_CYAN);

  // 自機（宇宙船・右向き、中心 240,330 / r=86）
  const scx = S(240), scy = S(330), sr = S(86);
  // 推進炎
  fillPoly(px, w, h, [
    [scx - 0.9 * sr, scy - 0.35 * sr],
    [scx - 1.8 * sr, scy],
    [scx - 0.9 * sr, scy + 0.35 * sr],
  ], C.THRUSTER);
  // 船体
  fillPoly(px, w, h, [
    [scx + sr, scy],
    [scx - 0.85 * sr, scy - 0.8 * sr],
    [scx - 0.5 * sr, scy],
    [scx - 0.85 * sr, scy + 0.8 * sr],
  ], C.SHIP);
  // コックピット
  fillCircle(px, w, h, scx + 0.15 * sr, scy, 0.28 * sr, C.COCKPIT);

  return encodePNG(w, h, px);
}

mkdirSync('icons', { recursive: true });
for (const [size, name] of [[192, 'icon-192'], [512, 'icon-512'], [180, 'apple-touch-icon']]) {
  writeFileSync(`icons/${name}.png`, generateIcon(size));
  console.log(`Generated icons/${name}.png`);
}
