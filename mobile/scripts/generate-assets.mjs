/**
 * Generates placeholder app icons / splash art with zero image dependencies.
 * Replace assets/*.png with real artwork before submitting to App Store Connect.
 *
 * Run: node scripts/generate-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const TEAL_DEEP = [13, 109, 99];
const TEAL_INK = [12, 29, 25];
const MIST = [246, 249, 247];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA8 pixel buffer -> PNG file bytes. */
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Squared distance from point to segment, used for cheap anti-aliased strokes. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The Meridian mark: an ascending line through a shallow trough — the same
 * "sentiment curve" gesture the web hero uses.
 */
function markPoints(size) {
  const pts = [
    [0.18, 0.66],
    [0.34, 0.58],
    [0.5, 0.62],
    [0.66, 0.42],
    [0.82, 0.34],
  ];
  return pts.map(([x, y]) => [x * size, y * size]);
}

function render(size, { background, stroke, strokeAlpha = 1 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const pts = markPoints(size);
  const halfWidth = size * 0.035;
  const dotRadius = size * 0.058;
  const [dotX, dotY] = pts[pts.length - 1];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let color;
      let alpha;

      if (background) {
        // Diagonal wash plus a soft top-left bloom mirrors the web atmosphere.
        const diagonal = (x / size) * 0.35 + (y / size) * 0.65;
        const bloom = Math.max(
          0,
          1 - Math.hypot(x - size * 0.2, y - size * 0.12) / (size * 0.85),
        );
        color = mix(background.from, background.to, diagonal);
        color = mix(color, background.bloom, bloom * 0.45);
        alpha = 255;
      } else {
        color = [0, 0, 0];
        alpha = 0;
      }

      let inkCoverage = 0;
      for (let s = 0; s < pts.length - 1; s++) {
        const d = distToSegment(x, y, ...pts[s], ...pts[s + 1]);
        inkCoverage = Math.max(
          inkCoverage,
          Math.min(1, Math.max(0, halfWidth - d + 0.5)),
        );
      }
      const dotDistance = Math.hypot(x - dotX, y - dotY);
      inkCoverage = Math.max(
        inkCoverage,
        Math.min(1, Math.max(0, dotRadius - dotDistance + 0.5)),
      );

      if (inkCoverage > 0) {
        const cover = inkCoverage * strokeAlpha;
        const base = alpha === 0 ? stroke : color;
        color = mix(base, stroke, cover);
        alpha = Math.max(alpha, Math.round(cover * 255));
      }

      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, size, rgba);
}

function solid(size, color) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = color[0];
    rgba[i * 4 + 1] = color[1];
    rgba[i * 4 + 2] = color[2];
    rgba[i * 4 + 3] = 255;
  }
  return encodePng(size, size, rgba);
}

const files = {
  'icon.png': render(1024, {
    background: { from: [16, 128, 116], to: TEAL_INK, bloom: [133, 214, 206] },
    stroke: MIST,
  }),
  'splash-icon.png': render(512, { stroke: TEAL_DEEP }),
  'android-icon-foreground.png': render(1024, { stroke: MIST }),
  'android-icon-background.png': solid(1024, TEAL_DEEP),
  'android-icon-monochrome.png': render(1024, { stroke: [255, 255, 255] }),
  'favicon.png': render(64, {
    background: { from: [16, 128, 116], to: TEAL_INK, bloom: [133, 214, 206] },
    stroke: MIST,
  }),
};

for (const [name, bytes] of Object.entries(files)) {
  writeFileSync(resolve(OUT, name), bytes);
  console.log(`wrote assets/${name} (${bytes.length} bytes)`);
}
