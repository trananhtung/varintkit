import {
  encodeUvarint, decodeUvarint, encodeBigUvarint, decodeBigUvarint,
  encodeUvarintSeq, decodeUvarintSeq,
  encodeVarint, decodeVarint, encodeBigVarint, decodeBigVarint,
  encodeVarintSeq, decodeVarintSeq,
  zigzagEncode, zigzagDecode, zigzagEncodeBig, zigzagDecodeBig,
  ByteWriter, ByteReader,
} from "../src/index.js";

// ── Unsigned LEB128 ─────────────────────────────────────────────────────────

describe("encodeUvarint", () => {
  it.each([
    [0,       [0x00]],
    [1,       [0x01]],
    [127,     [0x7f]],
    [128,     [0x80, 0x01]],
    [129,     [0x81, 0x01]],
    [255,     [0xff, 0x01]],
    [256,     [0x80, 0x02]],
    [300,     [0xac, 0x02]],
    [16383,   [0xff, 0x7f]],
    [16384,   [0x80, 0x80, 0x01]],
    [624485,  [0xe5, 0x8e, 0x26]],  // canonical LEB128 example from Wikipedia
    [2097151, [0xff, 0xff, 0x7f]],
    [Number.MAX_SAFE_INTEGER, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f]],
  ])("encodes %d → %j", (value, expected) => {
    expect(Array.from(encodeUvarint(value))).toEqual(expected);
  });

  it("throws on negative value", () => {
    expect(() => encodeUvarint(-1)).toThrow(RangeError);
  });

  it("throws on non-integer", () => {
    expect(() => encodeUvarint(1.5)).toThrow(RangeError);
  });

  it("throws on value > MAX_SAFE_INTEGER", () => {
    expect(() => encodeUvarint(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe("decodeUvarint", () => {
  it.each([
    [[0x00], 0],
    [[0x01], 1],
    [[0x7f], 127],
    [[0x80, 0x01], 128],
    [[0xe5, 0x8e, 0x26], 624485],
    [[0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f], Number.MAX_SAFE_INTEGER],
  ])("decodes %j → %d", (bytes, expected) => {
    const result = decodeUvarint(new Uint8Array(bytes));
    expect(result.value).toBe(expected);
    expect(result.bytesRead).toBe(bytes.length);
  });

  it("respects offset", () => {
    const buf = new Uint8Array([0x00, 0x00, 0xe5, 0x8e, 0x26, 0x00]);
    const result = decodeUvarint(buf, 2);
    expect(result.value).toBe(624485);
    expect(result.bytesRead).toBe(3);
  });

  it("throws on truncated input", () => {
    expect(() => decodeUvarint(new Uint8Array([0x80]))).toThrow(RangeError);
  });

  it("throws on value exceeding safe integer", () => {
    // 0xff repeated 8 times + 0x01 encodes 2^56 - 1 which exceeds safe int
    const big = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]);
    expect(() => decodeUvarint(big)).toThrow(RangeError);
  });
});

describe("uvarint round-trip", () => {
  const values = [0, 1, 63, 64, 127, 128, 255, 256, 16383, 16384, 624485, 1 << 21, 1 << 28, Number.MAX_SAFE_INTEGER];
  it.each(values)("round-trips %d", (v) => {
    expect(decodeUvarint(encodeUvarint(v)).value).toBe(v);
  });
});

// ── BigInt unsigned LEB128 ──────────────────────────────────────────────────

describe("encodeBigUvarint / decodeBigUvarint", () => {
  it.each([
    [0n, [0x00]],
    [127n, [0x7f]],
    [128n, [0x80, 0x01]],
    [624485n, [0xe5, 0x8e, 0x26]],
    [2n ** 32n, [0x80, 0x80, 0x80, 0x80, 0x10]],
    [2n ** 56n - 1n, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]],
  ])("encodes %s", (value, expected) => {
    expect(Array.from(encodeBigUvarint(value))).toEqual(expected);
  });

  it("round-trips large BigInt values", () => {
    const v = 2n ** 63n - 1n;
    expect(decodeBigUvarint(encodeBigUvarint(v)).value).toBe(v);
  });

  it("throws on negative BigInt", () => {
    expect(() => encodeBigUvarint(-1n)).toThrow(RangeError);
  });
});

// ── Sequences ───────────────────────────────────────────────────────────────

describe("encodeUvarintSeq / decodeUvarintSeq", () => {
  it("encodes and decodes a sequence", () => {
    const values = [0, 1, 128, 300, 16384, 624485];
    const buf = encodeUvarintSeq(values);
    expect(decodeUvarintSeq(buf)).toEqual(values);
  });

  it("decodeUvarintSeq with count limit", () => {
    const buf = encodeUvarintSeq([10, 20, 30, 40, 50]);
    expect(decodeUvarintSeq(buf, 3)).toEqual([10, 20, 30]);
  });

  it("empty sequence", () => {
    expect(decodeUvarintSeq(encodeUvarintSeq([]))).toEqual([]);
  });
});

// ── Zigzag encoding ─────────────────────────────────────────────────────────

describe("zigzag encoding", () => {
  it.each([
    [0, 0],
    [-1, 1],
    [1, 2],
    [-2, 3],
    [2, 4],
    [-2147483648, 4294967295],
    [2147483647, 4294967294],
  ])("zigzagEncode(%d) = %d", (input, expected) => {
    expect(zigzagEncode(input)).toBe(expected);
  });

  it.each([
    [0, 0],
    [1, -1],
    [2, 1],
    [3, -2],
    [4, 2],
  ])("zigzagDecode(%d) = %d", (input, expected) => {
    expect(zigzagDecode(input)).toBe(expected);
  });

  it("zigzag round-trips", () => {
    for (const v of [-1000000, -1, 0, 1, 1000000]) {
      expect(zigzagDecode(zigzagEncode(v))).toBe(v);
    }
  });

  it("BigInt zigzag", () => {
    const v = -9007199254740991n;
    expect(zigzagDecodeBig(zigzagEncodeBig(v))).toBe(v);
  });
});

// ── Signed varint (zigzag LEB128) ────────────────────────────────────────────

describe("encodeVarint / decodeVarint", () => {
  it.each([
    [0, [0x00]],
    [-1, [0x01]],
    [1, [0x02]],
    [-2, [0x03]],
    [2, [0x04]],
    [-64, [0x7f]],
    [64, [0x80, 0x01]],
    [-300, [0xd7, 0x04]],
    [300, [0xd8, 0x04]],
  ])("encodeVarint(%d) = %j", (value, expected) => {
    expect(Array.from(encodeVarint(value))).toEqual(expected);
  });

  it("signed varint round-trips", () => {
    const values = [-1000000, -128, -1, 0, 1, 127, 1000000, -2147483648, 2147483647];
    for (const v of values) {
      expect(decodeVarint(encodeVarint(v)).value).toBe(v);
    }
  });

  it("signed varint sequence", () => {
    const values = [-5, -1, 0, 1, 5, 100, -100];
    expect(decodeVarintSeq(encodeVarintSeq(values))).toEqual(values);
  });
});

describe("BigInt signed varint", () => {
  it("round-trips", () => {
    const values = [-9007199254740991n, -1n, 0n, 1n, 9007199254740991n];
    for (const v of values) {
      expect(decodeBigVarint(encodeBigVarint(v)).value).toBe(v);
    }
  });
});

// ── ByteWriter ───────────────────────────────────────────────────────────────

describe("ByteWriter", () => {
  it("writes and returns bytes", () => {
    const w = new ByteWriter();
    w.writeUint8(0xde).writeUint8(0xad).writeUint8(0xbe).writeUint8(0xef);
    expect(Array.from(w.toBytes())).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(w.bytesWritten).toBe(4);
  });

  it("writes fixed-width integers LE/BE", () => {
    const w = new ByteWriter();
    w.writeUint32LE(0x01020304);
    expect(Array.from(w.toBytes())).toEqual([0x04, 0x03, 0x02, 0x01]);
    w.reset();
    w.writeUint32BE(0x01020304);
    expect(Array.from(w.toBytes())).toEqual([0x01, 0x02, 0x03, 0x04]);
  });

  it("writes float64", () => {
    const w = new ByteWriter();
    w.writeFloat64LE(3.14);
    const r = new ByteReader(w.toBytes());
    expect(r.readFloat64LE()).toBeCloseTo(3.14);
  });

  it("writes uvarint", () => {
    const w = new ByteWriter();
    w.writeUvarint(624485);
    expect(Array.from(w.toBytes())).toEqual([0xe5, 0x8e, 0x26]);
  });

  it("writes varint (signed)", () => {
    const w = new ByteWriter();
    w.writeVarint(-1).writeVarint(0).writeVarint(1);
    const r = new ByteReader(w.toBytes());
    expect(r.readVarint()).toBe(-1);
    expect(r.readVarint()).toBe(0);
    expect(r.readVarint()).toBe(1);
  });

  it("writes BigInt", () => {
    const w = new ByteWriter();
    w.writeBigUint64LE(0xdeadbeefcafe1234n);
    const r = new ByteReader(w.toBytes());
    expect(r.readBigUint64LE()).toBe(0xdeadbeefcafe1234n);
  });

  it("writes length-prefixed string", () => {
    const w = new ByteWriter();
    w.writeLengthPrefixedString("hello");
    const r = new ByteReader(w.toBytes());
    expect(r.readLengthPrefixedString()).toBe("hello");
  });

  it("writes UTF-8 string", () => {
    const w = new ByteWriter();
    w.writeString("hello");
    expect(w.bytesWritten).toBe(5);
  });

  it("auto-grows buffer", () => {
    const w = new ByteWriter(2);
    for (let i = 0; i < 1000; i++) w.writeByte(i & 0xff);
    expect(w.bytesWritten).toBe(1000);
  });

  it("reset clears position", () => {
    const w = new ByteWriter();
    w.writeUint32LE(0xdeadbeef);
    w.reset();
    w.writeUint8(0x01);
    expect(w.bytesWritten).toBe(1);
    expect(Array.from(w.toBytes())).toEqual([0x01]);
  });
});

// ── ByteReader ───────────────────────────────────────────────────────────────

describe("ByteReader", () => {
  it("reads sequential fields", () => {
    const buf = new Uint8Array([0x01, 0x02, 0x00, 0x00, 0x00, 0x00]);
    const r = new ByteReader(buf);
    expect(r.readUint8()).toBe(1);
    expect(r.readUint16LE()).toBe(2);
    expect(r.remaining).toBe(3);
    expect(r.isEOF).toBe(false);
  });

  it("throws on reading past EOF", () => {
    const r = new ByteReader(new Uint8Array([0x01]));
    r.readUint8();
    expect(() => r.readUint8()).toThrow(RangeError);
  });

  it("skip advances cursor", () => {
    const buf = new Uint8Array([0x00, 0x00, 0x00, 0x42]);
    const r = new ByteReader(buf);
    r.skip(3);
    expect(r.readUint8()).toBe(0x42);
  });

  it("readInt8 returns negative values", () => {
    const r = new ByteReader(new Uint8Array([0xff, 0x80]));
    expect(r.readInt8()).toBe(-1);
    expect(r.readInt8()).toBe(-128);
  });

  it("readBytes returns a slice", () => {
    const r = new ByteReader(new Uint8Array([1, 2, 3, 4, 5]));
    expect(Array.from(r.readBytes(3))).toEqual([1, 2, 3]);
    expect(r.offset).toBe(3);
  });
});

// ── Integration: protobuf-like encoding ──────────────────────────────────────

describe("protobuf-style message encoding", () => {
  it("encodes and decodes a simple message", () => {
    // Simulate: { field1: 150 (uint), field2: "testing" (string) }
    const w = new ByteWriter();
    // field_number=1, wire_type=0 (varint)
    w.writeUvarint((1 << 3) | 0); // tag
    w.writeUvarint(150);
    // field_number=2, wire_type=2 (length-delimited)
    w.writeUvarint((2 << 3) | 2); // tag
    w.writeLengthPrefixedString("testing");

    const r = new ByteReader(w.toBytes());
    const tag1 = r.readUvarint();
    expect(tag1 >>> 3).toBe(1);  // field number
    expect(tag1 & 0x07).toBe(0); // wire type: varint
    expect(r.readUvarint()).toBe(150);

    const tag2 = r.readUvarint();
    expect(tag2 >>> 3).toBe(2);  // field number
    expect(tag2 & 0x07).toBe(2); // wire type: length-delimited
    expect(r.readLengthPrefixedString()).toBe("testing");

    expect(r.isEOF).toBe(true);
  });
});

// ── Integration: WASM-style vector serialization ──────────────────────────────

describe("WASM-style vector encoding", () => {
  it("encodes a list of values with uvarint length prefix", () => {
    const numbers = [1, 100, 10000, 624485];
    const w = new ByteWriter();
    w.writeUvarint(numbers.length);
    for (const n of numbers) w.writeUvarint(n);

    const r = new ByteReader(w.toBytes());
    const count = r.readUvarint();
    const decoded: number[] = [];
    for (let i = 0; i < count; i++) decoded.push(r.readUvarint());
    expect(decoded).toEqual(numbers);
  });
});
