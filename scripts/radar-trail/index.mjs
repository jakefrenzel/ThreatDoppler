// Renders the radar mark's sweep trail to assets/radar-trail.png. The design draws it as
//   conic-gradient(from 45deg, transparent 0deg 250deg, rgba(255,107,53,.6) 360deg)
// on a disc inset 18% inside the mark. SVG has no conic gradient, so RadarMark shows this image
// under the ring and arm instead. Unlike the design, the gradient's centre sits at the back of the
// arm's round cap rather than the pivot, so the fade reaches the middle instead of narrowing to a
// point under the cap; the bright edge still runs along the arm. Re-run if any of this changes:
//
//   node scripts/radar-trail/index.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 512; // the mark is at most 140 pt, so the disc is under 270 px at 3x
const COLOR = [0xff, 0x6b, 0x35]; // palette.ember
const MAX_ALPHA = 0.6;
const START = 45 + 250; // degrees clockwise from 12 o'clock, where the trail is transparent
const SWEEP = 110; // up to the arm at 45°, where it is brightest
const SAMPLES = 4; // per axis, to smooth the disc's edge and the step under the arm
// Mark units (100 per side): the disc's radius, and how far behind the pivot the gradient's centre
// sits along the arm's line (the cap's radius, half the 7-unit stroke).
const DISC = 32;
const BACK = 3.5;

// Raw RGBA rows, each starting with filter byte 0.
const out = Buffer.alloc(SIZE * (SIZE * 4 + 1));
const r = SIZE / 2;
const unit = r / DISC;
// The arm points 45° clockwise from 12 o'clock, so behind it is down and to the left.
const apex = [r - (BACK * unit) / Math.SQRT2, r + (BACK * unit) / Math.SQRT2];
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let alpha = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const dx = x + (sx + 0.5) / SAMPLES - r;
        const dy = y + (sy + 0.5) / SAMPLES - r;
        if (dx * dx + dy * dy > r * r) continue;
        const ax = x + (sx + 0.5) / SAMPLES - apex[0];
        const ay = y + (sy + 0.5) / SAMPLES - apex[1];
        const angle = ((Math.atan2(ax, -ay) * 180) / Math.PI + 360) % 360;
        const t = (((angle - START) % 360) + 360) % 360 / SWEEP;
        if (t < 1) alpha += MAX_ALPHA * t;
      }
    }
    const i = y * (SIZE * 4 + 1) + 1 + x * 4;
    out[i] = COLOR[0];
    out[i + 1] = COLOR[1];
    out[i + 2] = COLOR[2];
    out[i + 3] = Math.round((alpha / (SAMPLES * SAMPLES)) * 255);
  }
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(out, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const file = fileURLToPath(new URL('../../assets/radar-trail.png', import.meta.url));
writeFileSync(file, png);
console.log(`Wrote ${file} (${png.length} bytes)`);
