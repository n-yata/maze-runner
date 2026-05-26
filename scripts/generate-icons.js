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

function sp(px, w, h, x, y, r, g, b) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
}

function fillRect(px, w, h, rx, ry, rw, rh, r, g, b) {
  for (let y = Math.max(0, ry); y < Math.min(h, ry + rh); y++)
    for (let x = Math.max(0, rx); x < Math.min(w, rx + rw); x++)
      sp(px, w, h, x, y, r, g, b);
}

function fillCircle(px, w, h, cx, cy, rad, r, g, b) {
  const r2 = rad * rad;
  for (let y = Math.max(0, cy - rad - 1); y <= Math.min(h - 1, cy + rad + 1); y++)
    for (let x = Math.max(0, cx - rad - 1); x <= Math.min(w - 1, cx + rad + 1); x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2)
        sp(px, w, h, x, y, r, g, b);
}

function fillPacman(px, w, h, cx, cy, rad, r, g, b) {
  const r2 = rad * rad;
  const mouth = 0.45;
  for (let y = Math.max(0, cy - rad - 1); y <= Math.min(h - 1, cy + rad + 1); y++)
    for (let x = Math.max(0, cx - rad - 1); x <= Math.min(w - 1, cx + rad + 1); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2 && Math.abs(Math.atan2(dy, dx)) > mouth)
        sp(px, w, h, x, y, r, g, b);
    }
}

function generateIcon(size) {
  const w = size, h = size;
  const px = Buffer.alloc(w * h * 4);
  for (let i = 3; i < px.length; i += 4) px[i] = 255; // opaque black background

  const sc = size / 512;

  // Blue border (matching SVG: 28px at 512)
  const bw = Math.max(2, Math.round(28 * sc));
  fillRect(px, w, h, 0, 0, w, bw, 0, 0, 204);
  fillRect(px, w, h, 0, h - bw, w, bw, 0, 0, 204);
  fillRect(px, w, h, 0, 0, bw, h, 0, 0, 204);
  fillRect(px, w, h, w - bw, 0, bw, h, 0, 0, 204);

  // Inner walls (from SVG coordinates)
  const walls = [
    [56, 56, 140, 24], [316, 56, 140, 24],
    [56, 160, 140, 24], [316, 160, 140, 24],
    [56, 56, 24, 128], [432, 56, 24, 128],
    [176, 220, 160, 24], [176, 268, 160, 24],
    [176, 220, 24, 72], [312, 220, 24, 72],
  ];
  for (const [x, y, rw, rh] of walls)
    fillRect(px, w, h, Math.round(x * sc), Math.round(y * sc), Math.max(1, Math.round(rw * sc)), Math.max(1, Math.round(rh * sc)), 0, 0, 204);

  // Regular dots
  const dr = Math.max(2, Math.round(10 * sc));
  for (const [dx, dy] of [[100, 108], [256, 108], [412, 108], [100, 200], [412, 200]])
    fillCircle(px, w, h, Math.round(dx * sc), Math.round(dy * sc), dr, 255, 184, 174);

  // Power dots
  const pr = Math.max(3, Math.round(16 * sc));
  fillCircle(px, w, h, Math.round(72 * sc), Math.round(108 * sc), pr, 255, 184, 174);
  fillCircle(px, w, h, Math.round(440 * sc), Math.round(108 * sc), pr, 255, 184, 174);

  // PAC-MAN (SVG center ~256,350 radius 90, facing right)
  fillPacman(px, w, h, Math.round(256 * sc), Math.round(350 * sc), Math.round(90 * sc), 255, 224, 0);

  // Ghost (SVG translate(340,310), size 72x60 + dome)
  const gs = Math.round(36 * sc);
  const gcx = Math.round(376 * sc), gcy = Math.round(338 * sc);
  // Dome (upper semicircle)
  for (let y = gcy - gs; y <= gcy; y++)
    for (let x = gcx - gs; x <= gcx + gs; x++)
      if ((x - gcx) * (x - gcx) + (y - gcy) * (y - gcy) <= gs * gs)
        sp(px, w, h, x, y, 255, 0, 0);
  // Body
  fillRect(px, w, h, gcx - gs, gcy, gs * 2, Math.round(30 * sc), 255, 0, 0);
  // Eyes
  const er = Math.max(2, Math.round(9 * sc));
  const eox = Math.round(13 * sc);
  const ecy = gcy - Math.round(4 * sc);
  fillCircle(px, w, h, gcx - eox, ecy, er, 255, 255, 255);
  fillCircle(px, w, h, gcx + eox, ecy, er, 255, 255, 255);
  // Pupils
  const pur = Math.max(1, Math.round(5 * sc));
  fillCircle(px, w, h, gcx - eox + pur, ecy, pur, 0, 0, 200);
  fillCircle(px, w, h, gcx + eox + pur, ecy, pur, 0, 0, 200);

  return encodePNG(w, h, px);
}

mkdirSync('icons', { recursive: true });
for (const [size, name] of [[192, 'icon-192'], [512, 'icon-512'], [180, 'apple-touch-icon']]) {
  writeFileSync(`icons/${name}.png`, generateIcon(size));
  console.log(`Generated icons/${name}.png`);
}
