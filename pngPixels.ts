// A minimal, dependency-free PNG decoder used only to read back the tiny
// (a few pixels wide) images produced by expo-image-manipulator when
// sampling a clip's dominant color (see dominantColor.ts). It implements
// just enough of RFC 1950 (zlib) + RFC 1951 (DEFLATE) + the PNG spec to
// decode an 8-bit, non-interlaced RGB/RGBA PNG — not a general-purpose
// decoder. Written by hand instead of adding a dependency: the images this
// reads are always small (an 8x8 or so downscale), so raw correctness
// matters far more than decode speed here.

// Decoded by hand rather than relying on global atob — Hermes (React
// Native's JS engine) doesn't reliably provide it, unlike a browser.
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

// ---- DEFLATE (RFC 1951) ----

class BitReader {
  private pos = 0;
  private bitBuf = 0;
  private bitCount = 0;
  constructor(private data: Uint8Array) {}

  readBits(n: number): number {
    while (this.bitCount < n) {
      this.bitBuf |= this.data[this.pos++] << this.bitCount;
      this.bitCount += 8;
    }
    const value = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCount -= n;
    return value;
  }

  alignToByte() {
    this.bitBuf = 0;
    this.bitCount = 0;
  }

  readByteDirect(): number {
    return this.data[this.pos++];
  }
}

// A canonical Huffman decoder built from a list of code lengths (one per
// symbol), walked one bit at a time — simple and easy to verify, which
// matters far more than raw speed for the tiny payloads this handles.
class HuffmanTree {
  // Map from `${length}:${code}` to symbol.
  private codes = new Map<string, number>();
  private maxLength = 0;

  constructor(lengths: number[]) {
    const maxLength = Math.max(0, ...lengths);
    this.maxLength = maxLength;
    const blCount = new Array(maxLength + 1).fill(0);
    for (const len of lengths) if (len > 0) blCount[len]++;
    let code = 0;
    const nextCode = new Array(maxLength + 1).fill(0);
    for (let bits = 1; bits <= maxLength; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    for (let symbol = 0; symbol < lengths.length; symbol++) {
      const len = lengths[symbol];
      if (len === 0) continue;
      const c = nextCode[len]++;
      this.codes.set(`${len}:${c}`, symbol);
    }
  }

  decode(reader: BitReader): number {
    let code = 0;
    for (let len = 1; len <= this.maxLength; len++) {
      // DEFLATE Huffman codes are packed MSB-first even though everything
      // else in the stream is LSB-first — build the code bit by bit.
      code = (code << 1) | reader.readBits(1);
      const symbol = this.codes.get(`${len}:${code}`);
      if (symbol !== undefined) return symbol;
    }
    throw new Error('Invalid Huffman code');
  }
}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function buildFixedLitTree(): HuffmanTree {
  const lengths = new Array(288);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  return new HuffmanTree(lengths);
}
function buildFixedDistTree(): HuffmanTree {
  return new HuffmanTree(new Array(30).fill(5));
}

function inflateBlock(reader: BitReader, out: number[], litTree: HuffmanTree, distTree: HuffmanTree) {
  for (;;) {
    const symbol = litTree.decode(reader);
    if (symbol === 256) return; // end of block
    if (symbol < 256) {
      out.push(symbol);
      continue;
    }
    const lengthIndex = symbol - 257;
    const length = LENGTH_BASE[lengthIndex] + reader.readBits(LENGTH_EXTRA[lengthIndex]);
    const distSymbol = distTree.decode(reader);
    const distance = DIST_BASE[distSymbol] + reader.readBits(DIST_EXTRA[distSymbol]);
    let start = out.length - distance;
    for (let i = 0; i < length; i++) out.push(out[start + i]);
  }
}

function readDynamicTrees(reader: BitReader): { lit: HuffmanTree; dist: HuffmanTree } {
  const hlit = reader.readBits(5) + 257;
  const hdist = reader.readBits(5) + 1;
  const hclen = reader.readBits(4) + 4;

  const clLengths = new Array(19).fill(0);
  for (let i = 0; i < hclen; i++) clLengths[CODE_LENGTH_ORDER[i]] = reader.readBits(3);
  const clTree = new HuffmanTree(clLengths);

  const allLengths: number[] = [];
  while (allLengths.length < hlit + hdist) {
    const symbol = clTree.decode(reader);
    if (symbol <= 15) {
      allLengths.push(symbol);
    } else if (symbol === 16) {
      const repeat = reader.readBits(2) + 3;
      const prev = allLengths[allLengths.length - 1] ?? 0;
      for (let i = 0; i < repeat; i++) allLengths.push(prev);
    } else if (symbol === 17) {
      const repeat = reader.readBits(3) + 3;
      for (let i = 0; i < repeat; i++) allLengths.push(0);
    } else {
      const repeat = reader.readBits(7) + 11;
      for (let i = 0; i < repeat; i++) allLengths.push(0);
    }
  }

  const litLengths = allLengths.slice(0, hlit);
  const distLengths = allLengths.slice(hlit, hlit + hdist);
  return { lit: new HuffmanTree(litLengths), dist: new HuffmanTree(distLengths) };
}

function inflateRaw(data: Uint8Array): Uint8Array {
  const reader = new BitReader(data);
  const out: number[] = [];
  let final = 0;
  do {
    final = reader.readBits(1);
    const type = reader.readBits(2);
    if (type === 0) {
      reader.alignToByte();
      const len = reader.readByteDirect() | (reader.readByteDirect() << 8);
      reader.readByteDirect();
      reader.readByteDirect(); // NLEN, unused
      for (let i = 0; i < len; i++) out.push(reader.readByteDirect());
    } else if (type === 1) {
      inflateBlock(reader, out, buildFixedLitTree(), buildFixedDistTree());
    } else if (type === 2) {
      const { lit, dist } = readDynamicTrees(reader);
      inflateBlock(reader, out, lit, dist);
    } else {
      throw new Error('Invalid DEFLATE block type');
    }
  } while (final === 0);
  return Uint8Array.from(out);
}

function zlibInflate(data: Uint8Array): Uint8Array {
  // Skip the 2-byte zlib header; ignore the trailing 4-byte Adler-32 (the
  // caller only wants a rough color, not a checksum-verified decode).
  return inflateRaw(data.subarray(2));
}

// ---- PNG container ----

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export type DecodedPng = { width: number; height: number; channels: number; pixels: Uint8Array };

// Only handles 8-bit-depth, non-interlaced RGB (colorType 2) or RGBA
// (colorType 6) — the two formats expo-image-manipulator actually produces
// for SaveFormat.PNG. Throws for anything else, which the caller treats as
// "couldn't sample a color" and falls back gracefully.
export function decodePng(base64: string): DecodedPng {
  const bytes = base64ToBytes(base64);
  // 8-byte PNG signature.
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length =
      (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;

    if (type === 'IHDR') {
      const view = bytes.subarray(dataStart, dataStart + 13);
      width = (view[0] << 24) | (view[1] << 16) | (view[2] << 8) | view[3];
      height = (view[4] << 24) | (view[5] << 16) | (view[6] << 8) | view[7];
      bitDepth = view[8];
      colorType = view[9];
    } else if (type === 'IDAT') {
      idatChunks.push(bytes.subarray(dataStart, dataStart + length));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataStart + length + 4; // skip CRC
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format (bitDepth=${bitDepth}, colorType=${colorType})`);
  }
  const channels = colorType === 6 ? 4 : 3;

  const totalLength = idatChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of idatChunks) {
    compressed.set(chunk, pos);
    pos += chunk.length;
  }

  const raw = zlibInflate(compressed);

  const bytesPerPixel = channels; // 8-bit depth => 1 byte/channel
  const stride = width * bytesPerPixel;
  const pixels = new Uint8Array(width * height * bytesPerPixel);
  let rawPos = 0;
  let prevRowStart = -1;

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw_x = raw[rawPos++];
      const a = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const b = prevRowStart >= 0 ? pixels[prevRowStart + x] : 0;
      const c = prevRowStart >= 0 && x >= bytesPerPixel ? pixels[prevRowStart + x - bytesPerPixel] : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = raw_x;
          break;
        case 1:
          value = raw_x + a;
          break;
        case 2:
          value = raw_x + b;
          break;
        case 3:
          value = raw_x + Math.floor((a + b) / 2);
          break;
        case 4:
          value = raw_x + paeth(a, b, c);
          break;
        default:
          value = raw_x;
      }
      pixels[rowStart + x] = value & 0xff;
    }
    prevRowStart = rowStart;
  }

  return { width, height, channels, pixels };
}
