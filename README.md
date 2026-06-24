# varintkit

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

> Zero-dependency TypeScript LEB128 / variable-length integer encoder-decoder. Unsigned (uvarint), signed zigzag (varint), BigInt, sequences, `ByteWriter` and `ByteReader`. Port of Go `encoding/binary` / Python `leb128`.

[![npm](https://img.shields.io/npm/v/varintkit)](https://www.npmjs.com/package/varintkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Used in **Protocol Buffers**, **WebAssembly** binary format, **DWARF** debug info, and any binary serialization format that compresses small integers.

## Install

```bash
npm install varintkit
```

## Quick start

```typescript
import { encodeUvarint, decodeUvarint, encodeVarint, decodeVarint } from "varintkit";

// Unsigned LEB128
encodeUvarint(624485);     // Uint8Array [0xe5, 0x8e, 0x26]  (3 bytes vs 4 for uint32)
decodeUvarint(new Uint8Array([0xe5, 0x8e, 0x26])).value;  // 624485

// Signed (zigzag encoding)
encodeVarint(-1);    // Uint8Array [0x01]  — maps: -1 → 1
encodeVarint(1);     // Uint8Array [0x02]  — maps:  1 → 2
decodeVarint(new Uint8Array([0x01])).value;  // -1
```

## ByteWriter / ByteReader

Fluent binary buffer builder, inspired by Go's `bytes.Buffer` and Java's `DataOutputStream`:

```typescript
import { ByteWriter, ByteReader } from "varintkit";

// Write a protobuf-like message
const w = new ByteWriter();
w.writeUvarint((1 << 3) | 0);   // field 1, wire type 0 (varint)
w.writeUvarint(150);
w.writeUvarint((2 << 3) | 2);   // field 2, wire type 2 (length-delimited)
w.writeLengthPrefixedString("hello");
w.writeFloat64LE(3.14);
w.writeBigUint64LE(0xdeadbeefcafe1234n);

// Read it back
const r = new ByteReader(w.toBytes());
const tag1 = r.readUvarint();   // field number = tag1 >>> 3, wire type = tag1 & 7
r.readUvarint();                 // 150
r.readUvarint();                 // tag 2
r.readLengthPrefixedString();   // "hello"
r.readFloat64LE();               // 3.14
r.readBigUint64LE();             // 0xdeadbeefcafe1234n
r.isEOF;                         // true
```

## Sequences

```typescript
import { encodeUvarintSeq, decodeUvarintSeq } from "varintkit";

const buf = encodeUvarintSeq([0, 1, 128, 300, 624485]);
decodeUvarintSeq(buf);  // [0, 1, 128, 300, 624485]
decodeUvarintSeq(buf, 3);  // [0, 1, 128]  — read only first 3
```

## BigInt support (64-bit values)

```typescript
import { encodeBigUvarint, decodeBigUvarint, encodeBigVarint, decodeBigVarint } from "varintkit";

const buf = encodeBigUvarint(2n ** 63n - 1n);
decodeBigUvarint(buf).value;  // 9223372036854775807n

decodeBigVarint(encodeBigVarint(-9223372036854775808n)).value;  // -9223372036854775808n
```

## Zigzag encoding

Maps signed integers to non-negative integers for efficient varint packing of mixed-sign data (used by protobuf `sint32`/`sint64`):

```typescript
import { zigzagEncode, zigzagDecode } from "varintkit";

zigzagEncode(0);   // 0
zigzagEncode(-1);  // 1
zigzagEncode(1);   // 2
zigzagEncode(-2);  // 3
```

## API

### Unsigned LEB128

```typescript
encodeUvarint(value: number): Uint8Array
decodeUvarint(bytes: Uint8Array, offset?: number): { value: number; bytesRead: number }
encodeBigUvarint(value: bigint): Uint8Array
decodeBigUvarint(bytes: Uint8Array, offset?: number): { value: bigint; bytesRead: number }
encodeUvarintSeq(values: number[]): Uint8Array
decodeUvarintSeq(bytes: Uint8Array, count?: number): number[]
```

### Signed zigzag LEB128

```typescript
encodeVarint(value: number): Uint8Array
decodeVarint(bytes: Uint8Array, offset?: number): { value: number; bytesRead: number }
encodeBigVarint(value: bigint): Uint8Array
decodeBigVarint(bytes: Uint8Array, offset?: number): { value: bigint; bytesRead: number }
encodeVarintSeq(values: number[]): Uint8Array
decodeVarintSeq(bytes: Uint8Array, count?: number): number[]
zigzagEncode(n: number): number
zigzagDecode(n: number): number
```

### ByteWriter (growable buffer)

```typescript
new ByteWriter(initialCapacity?: number)
.writeByte(v) .writeBytes(buf) .writeUint8 .writeInt8
.writeUint16LE .writeUint16BE .writeInt16LE .writeInt16BE
.writeUint32LE .writeUint32BE .writeInt32LE .writeInt32BE
.writeFloat32LE .writeFloat32BE .writeFloat64LE .writeFloat64BE
.writeBigUint64LE .writeBigUint64BE .writeBigInt64LE .writeBigInt64BE
.writeUvarint(n) .writeVarint(n) .writeBigUvarint(n) .writeBigVarint(n)
.writeString(s, encoding?) .writeLengthPrefixedString(s)
.toBytes(): Uint8Array
.bytesWritten: number
.reset(): this
```

### ByteReader (cursor-based reader)

```typescript
new ByteReader(bytes: Uint8Array, offset?: number)
.readByte() .readBytes(n) .readUint8 .readInt8
.readUint16LE .readUint16BE .readInt16LE .readInt16BE
.readUint32LE .readUint32BE .readInt32LE .readInt32BE
.readFloat32LE .readFloat32BE .readFloat64LE .readFloat64BE
.readBigUint64LE .readBigUint64BE .readBigInt64LE .readBigInt64BE
.readUvarint() .readVarint() .readBigUvarint() .readBigVarint()
.readString(n, encoding?) .readLengthPrefixedString()
.skip(n): this
.offset: number
.remaining: number
.isEOF: boolean
```

## Why LEB128?

| Value | Fixed uint32 | LEB128 |
|---|---|---|
| 0–127 | 4 bytes | **1 byte** |
| 128–16383 | 4 bytes | **2 bytes** |
| 16384–2097151 | 4 bytes | **3 bytes** |
| 2097152–268435455 | 4 bytes | **4 bytes** |
| > 268435455 | 4 bytes | 5 bytes |

For data where most integers are small (IDs, lengths, offsets), LEB128 typically reduces size by 50–75%.

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/varintkit/commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

MIT © [trananhtung](https://github.com/trananhtung)
