/**
 * ByteReader — cursor-based binary data reader.
 * Inspired by Go's bytes.Reader and Java's DataInputStream.
 */

import { decodeUvarint, decodeBigUvarint } from "./uvarint.js";
import { decodeVarint, decodeBigVarint } from "./varint.js";

export class ByteReader {
  private readonly _buf: Uint8Array;
  private readonly _view: DataView;
  private _pos: number;

  constructor(bytes: Uint8Array, offset = 0) {
    this._buf = bytes;
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this._pos = offset;
  }

  get offset(): number { return this._pos; }
  get remaining(): number { return this._buf.length - this._pos; }
  get isEOF(): boolean { return this._pos >= this._buf.length; }

  private _need(n: number): void {
    if (this._pos + n > this._buf.length) {
      throw new RangeError(`ByteReader: need ${n} bytes at offset ${this._pos} but only ${this.remaining} remain`);
    }
  }

  skip(n: number): this { this._need(n); this._pos += n; return this; }

  readByte(): number { this._need(1); return this._buf[this._pos++]!; }

  readBytes(n: number): Uint8Array {
    this._need(n);
    const slice = this._buf.slice(this._pos, this._pos + n);
    this._pos += n;
    return slice;
  }

  readUint8(): number  { return this.readByte(); }
  readInt8(): number   { const v = this.readByte(); return v >= 128 ? v - 256 : v; }

  readUint16LE(): number { this._need(2); const v = this._view.getUint16(this._pos, true);  this._pos += 2; return v; }
  readUint16BE(): number { this._need(2); const v = this._view.getUint16(this._pos, false); this._pos += 2; return v; }
  readInt16LE(): number  { this._need(2); const v = this._view.getInt16(this._pos, true);   this._pos += 2; return v; }
  readInt16BE(): number  { this._need(2); const v = this._view.getInt16(this._pos, false);  this._pos += 2; return v; }

  readUint32LE(): number { this._need(4); const v = this._view.getUint32(this._pos, true);  this._pos += 4; return v; }
  readUint32BE(): number { this._need(4); const v = this._view.getUint32(this._pos, false); this._pos += 4; return v; }
  readInt32LE(): number  { this._need(4); const v = this._view.getInt32(this._pos, true);   this._pos += 4; return v; }
  readInt32BE(): number  { this._need(4); const v = this._view.getInt32(this._pos, false);  this._pos += 4; return v; }

  readFloat32LE(): number { this._need(4); const v = this._view.getFloat32(this._pos, true);  this._pos += 4; return v; }
  readFloat32BE(): number { this._need(4); const v = this._view.getFloat32(this._pos, false); this._pos += 4; return v; }
  readFloat64LE(): number { this._need(8); const v = this._view.getFloat64(this._pos, true);  this._pos += 8; return v; }
  readFloat64BE(): number { this._need(8); const v = this._view.getFloat64(this._pos, false); this._pos += 8; return v; }

  readBigUint64LE(): bigint { this._need(8); const v = this._view.getBigUint64(this._pos, true);  this._pos += 8; return v; }
  readBigUint64BE(): bigint { this._need(8); const v = this._view.getBigUint64(this._pos, false); this._pos += 8; return v; }
  readBigInt64LE(): bigint  { this._need(8); const v = this._view.getBigInt64(this._pos, true);   this._pos += 8; return v; }
  readBigInt64BE(): bigint  { this._need(8); const v = this._view.getBigInt64(this._pos, false);  this._pos += 8; return v; }

  readUvarint(): number {
    const { value, bytesRead } = decodeUvarint(this._buf, this._pos);
    this._pos += bytesRead;
    return value;
  }

  readVarint(): number {
    const { value, bytesRead } = decodeVarint(this._buf, this._pos);
    this._pos += bytesRead;
    return value;
  }

  readBigUvarint(): bigint {
    const { value, bytesRead } = decodeBigUvarint(this._buf, this._pos);
    this._pos += bytesRead;
    return value;
  }

  readBigVarint(): bigint {
    const { value, bytesRead } = decodeBigVarint(this._buf, this._pos);
    this._pos += bytesRead;
    return value;
  }

  readString(n: number, encoding: "utf8" | "ascii" = "utf8"): string {
    const bytes = this.readBytes(n);
    if (encoding === "ascii") return String.fromCharCode(...bytes);
    return new TextDecoder().decode(bytes);
  }

  /** Read a length-prefixed UTF-8 string (uvarint length + bytes). */
  readLengthPrefixedString(): string {
    const len = this.readUvarint();
    return this.readString(len);
  }
}
