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

// 宇宙テーマの配色（src/constants.ts・宇宙飛行士の自機と対応）
const C = {
  BG:         [5, 6, 15],      // #05060F 深宇宙
  STAR:       [200, 210, 235], // 星（控えめな白）
  SUIT:       [232, 242, 255], // #E8F2FF スーツ（明）
  SUIT_SHADE: [159, 208, 255], // #9FD0FF スーツ（陰）
  VISOR:      [6, 50, 74],     // #06324A バイザー（暗いガラス）
  VISOR_GLOW: [125, 240, 255], // #7DF0FF バイザー反射
  BACKPACK:   [94, 118, 168],  // #5E76A8 推進ユニット
  ACCENT:     [43, 224, 168],  // #2BE0A8 胸部パネル/ブーツ
  THRUSTER:   [255, 138, 60],  // #FF8A3C 推進炎
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

// 宇宙飛行士（ヘルメット＋バイザー＋スーツ＋バックパック）。中心(cx,cy)はヘルメット中心、r=ヘルメット半径
function drawAstronaut(px, w, h, cx, cy, r) {
  const bodyTop = cy + r * 0.7;   // 胴体上端
  // バックパック（推進ユニット・胴体背後）
  fillRect(px, w, h, cx - r * 1.0, bodyTop - r * 0.1, r * 2.0, r * 1.9, C.BACKPACK);
  // バックパックの発光ノズル
  fillCircle(px, w, h, cx, bodyTop + r * 1.95, r * 0.32, C.THRUSTER);

  // 脚（2本）
  fillRect(px, w, h, cx - r * 0.62, bodyTop + r * 1.45, r * 0.55, r * 1.15, C.SUIT_SHADE);
  fillRect(px, w, h, cx + r * 0.07, bodyTop + r * 1.45, r * 0.55, r * 1.15, C.SUIT_SHADE);
  // ブーツ
  fillRect(px, w, h, cx - r * 0.66, bodyTop + r * 2.45, r * 0.63, r * 0.4, C.ACCENT);
  fillRect(px, w, h, cx + r * 0.03, bodyTop + r * 2.45, r * 0.63, r * 0.4, C.ACCENT);

  // 腕（2本・肩から下へ）
  fillRect(px, w, h, cx - r * 1.28, bodyTop + r * 0.05, r * 0.5, r * 1.5, C.SUIT);
  fillRect(px, w, h, cx + r * 0.78, bodyTop + r * 0.05, r * 0.5, r * 1.5, C.SUIT);

  // 胴体（スーツ）
  fillRect(px, w, h, cx - r * 0.85, bodyTop, r * 1.7, r * 1.6, C.SUIT);
  // 肩の丸み
  fillCircle(px, w, h, cx - r * 0.85, bodyTop + r * 0.2, r * 0.42, C.SUIT);
  fillCircle(px, w, h, cx + r * 0.85, bodyTop + r * 0.2, r * 0.42, C.SUIT);
  // 胸部コントロールパネル
  fillRect(px, w, h, cx - r * 0.35, bodyTop + r * 0.55, r * 0.7, r * 0.45, C.ACCENT);

  // ヘルメット（球体）
  fillCircle(px, w, h, cx, cy, r, C.SUIT);
  // バイザー（暗いガラス）
  fillCircle(px, w, h, cx, cy + r * 0.05, r * 0.66, C.VISOR);
  // バイザー反射（ハイライト）
  fillCircle(px, w, h, cx - r * 0.26, cy - r * 0.22, r * 0.2, C.VISOR_GLOW);
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
    [70, 300, 2], [120, 430, 1.5], [250, 80, 1.5], [300, 430, 2], [430, 320, 1.5],
    [450, 440, 2], [110, 110, 1.5], [380, 110, 1.5], [60, 380, 1.5], [470, 200, 2],
  ]) fillCircle(px, w, h, S(sx), S(sy), Math.max(1, S(sr)), C.STAR);

  // 宇宙飛行士（中央配置・ヘルメット中心 256,190 / r=92）
  // maskable のセーフゾーン内に収まるよう中央寄せ
  drawAstronaut(px, w, h, S(256), S(186), S(92));

  return encodePNG(w, h, px);
}

mkdirSync('icons', { recursive: true });
for (const [size, name] of [[192, 'icon-192'], [512, 'icon-512'], [180, 'apple-touch-icon']]) {
  writeFileSync(`icons/${name}.png`, generateIcon(size));
  console.log(`Generated icons/${name}.png`);
}
