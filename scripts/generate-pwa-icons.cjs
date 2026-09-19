const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngBuffer(width, height, isMaskable = false) {
  // Raw pixel array: RGBA (4 bytes per pixel)
  // Each scanline has 1 filter byte (0 = None) + width * 4 bytes
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = (width / 2) * (isMaskable ? 0.95 : 0.88);
  const rInner = (width / 2) * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background color: deep slate (#020617)
      let r = 2, g = 6, b = 23, a = 255;

      // Outer squircle or circle
      if (!isMaskable && dist > rOuter) {
        // Soft edge antialiasing
        if (dist < rOuter + 1.5) {
          a = Math.max(0, Math.floor(255 * (1 - (dist - rOuter) / 1.5)));
        } else {
          a = 0;
        }
      }

      if (a > 0) {
        // Subtle outer border ring
        if (dist >= rOuter - 4 && dist <= rOuter) {
          r = 30; g = 41; b = 59; // #1e293b
        }

        // Industrial cogwheel / telemetry teeth
        const angle = Math.atan2(dy, dx);
        if (dist >= rInner + 10 && dist <= rOuter - 15) {
          const teeth = Math.sin(angle * 12);
          if (teeth > 0.4) {
            r = 14; g = 165; b = 233; // #0ea5e9
          } else {
            r = 15; g = 23; b = 42; // #0f172a
          }
        }

        // Central Sugar Cane Emerald Stalk
        if (Math.abs(dx + width * 0.05) < width * 0.07 && Math.abs(dy) < height * 0.35) {
          // Emerald stalk
          r = 16; g = 185; b = 129; // #10b981
          // Segment joints
          if (Math.abs(dy) < 3 || Math.abs(dy - height * 0.15) < 3 || Math.abs(dy + height * 0.15) < 3) {
            r = 4; g = 120; b = 87; // #047857
          }
        }

        // Digital Twin Accent Node
        const nodeDx = dx - width * 0.18;
        const nodeDy = dy - height * 0.05;
        const nodeDist = Math.sqrt(nodeDx * nodeDx + nodeDy * nodeDy);
        if (nodeDist < width * 0.08) {
          r = 56; g = 189; b = 248; // #38bdf8
        }
        if (nodeDist < width * 0.04) {
          r = 245; g = 158; b = 11; // #f59e0b (amber core)
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcPayload = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcPayload);
  chunk.writeUInt32BE(crc, 8 + len);

  return chunk;
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. 192x192 standard icon
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPngBuffer(192, 192, false));

// 2. 512x512 standard icon
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPngBuffer(512, 512, false));

// 3. 512x512 maskable icon (full-bleed safe zone)
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPngBuffer(512, 512, true));

// 4. Apple Touch Icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, false));

// 5. Favicon 32x32
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPngBuffer(32, 32, false));

console.log('PWA PNG assets successfully generated in /public:');
console.log('  - pwa-192x192.png');
console.log('  - pwa-512x512.png');
console.log('  - pwa-maskable-512x512.png');
console.log('  - apple-touch-icon.png');
console.log('  - favicon.ico');
