const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePNG(width, height) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw pixel data: 1 byte filter (0) per scanline, width * 4 bytes RGBA
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineSize);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawData[rowOffset] = 0; // filter 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Glowing 3D Orb gradient (Indigo to Violet to Cyan highlight)
        const factor = dist / radius;
        const highlight = Math.max(0, 1 - Math.sqrt((x - cx*0.6)**2 + (y - cy*0.6)**2) / (radius*0.7));
        
        let r = Math.floor(99 + (139 - 99) * factor + highlight * 110);
        let g = Math.floor(102 + (92 - 102) * factor + highlight * 130);
        let b = Math.floor(241 + (246 - 241) * factor + highlight * 140);
        let a = 255;

        // Anti-aliasing edge
        if (dist > radius - 1) {
          a = Math.floor(255 * (radius - dist));
        }

        rawData[pxOffset] = Math.min(255, r);
        rawData[pxOffset + 1] = Math.min(255, g);
        rawData[pxOffset + 2] = Math.min(255, b);
        rawData[pxOffset + 3] = Math.max(0, Math.min(255, a));
      } else {
        // Transparent background
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync('icon16.png', generatePNG(16, 16));
fs.writeFileSync('icon48.png', generatePNG(48, 48));
fs.writeFileSync('icon128.png', generatePNG(128, 128));

console.log('Successfully generated icon16.png, icon48.png, and icon128.png!');
