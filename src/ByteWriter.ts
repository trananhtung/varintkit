/**
 * ByteWriter — a growable buffer for writing binary data.
 * Inspired by Go's bytes.Buffer and Java's ByteArrayOutputStream.
 */

import { encodeUvarint, encodeBigUvarint } from "./uvarint.js";
import { encodeVarint, encodeBigVarint } from "./varint.js";

const INITIAL_CAPACITY = 64;

export class ByteWriter {
  private _buf: Uint8Array;
  private _pos = 0;
  private _view: DataView;

  constructor(initialCapacity = INITIAL_CAPACITY) {
    this._buf = new Uint8Array(initialCapacity);
    this._view = new DataView(this._buf.buffer);
  }

  private _ensureCapacity(additional: number): void {
    const needed = this._pos + additional;
    if (needed <= this._buf.length) return;
    const next = new Uint8Array(Math.max(needed, this._buf.length * 2));
    next.set(this._buf.subarray(0, this._pos));
    this._buf = next;
    this._view = new DataView(this._buf.buffer);
  }

  get bytesWritten(): number { return this._pos; }

  toBytes(): Uint8Array { return this._buf.slice(0, this._pos); }

  reset(): this { this._pos = 0; return this; }

  writeByte(value: number): this {
    this._ensureCapacity(1);
    this._buf[this._pos++] = value & 0xff;
    return this;
  }

  writeBytes(bytes: Uint8Array): this {
    this._ensureCapacity(bytes.length);
    this._buf.set(bytes, this._pos);
    this._pos += bytes.length;
    return this;
  }

  writeUint8(value: number): this  { return this.writeByte(value); }
  writeInt8(value: number): this   { return this.writeByte(value < 0 ? value + 256 : value); }

  writeUint16LE(value: number): this { this._ensureCapacity(2); this._view.setUint16(this._pos, value, true);  this._pos += 2; return this; }
  writeUint16BE(value: number): this { this._ensureCapacity(2); this._view.setUint16(this._pos, value, false); this._pos += 2; return this; }
  writeInt16LE(value: number): this  { this._ensureCapacity(2); this._view.setInt16(this._pos, value, true);   this._pos += 2; return this; }
  writeInt16BE(value: number): this  { this._ensureCapacity(2); this._view.setInt16(this._pos, value, false);  this._pos += 2; return this; }

  writeUint32LE(value: number): this { this._ensureCapacity(4); this._view.setUint32(this._pos, value, true);  this._pos += 4; return this; }
  writeUint32BE(value: number): this { this._ensureCapacity(4); this._view.setUint32(this._pos, value, false); this._pos += 4; return this; }
  writeInt32LE(value: number): this  { this._ensureCapacity(4); this._view.setInt32(this._pos, value, true);   this._pos += 4; return this; }
  writeInt32BE(value: number): this  { this._ensureCapacity(4); this._view.setInt32(this._pos, value, false);  this._pos += 4; return this; }

  writeFloat32LE(value: number): this { this._ensureCapacity(4); this._view.setFloat32(this._pos, value, true);  this._pos += 4; return this; }
  writeFloat32BE(value: number): this { this._ensureCapacity(4); this._view.setFloat32(this._pos, value, false); this._pos += 4; return this; }
  writeFloat64LE(value: number): this { this._ensureCapacity(8); this._view.setFloat64(this._pos, value, true);  this._pos += 8; return this; }
  writeFloat64BE(value: number): this { this._ensureCapacity(8); this._view.setFloat64(this._pos, value, false); this._pos += 8; return this; }

  writeBigUint64LE(value: bigint): this { this._ensureCapacity(8); this._view.setBigUint64(this._pos, value, true);  this._pos += 8; return this; }
  writeBigUint64BE(value: bigint): this { this._ensureCapacity(8); this._view.setBigUint64(this._pos, value, false); this._pos += 8; return this; }
  writeBigInt64LE(value: bigint): this  { this._ensureCapacity(8); this._view.setBigInt64(this._pos, value, true);   this._pos += 8; return this; }
  writeBigInt64BE(value: bigint): this  { this._ensureCapacity(8); this._view.setBigInt64(this._pos, value, false);  this._pos += 8; return this; }

  writeUvarint(value: number): this  { return this.writeBytes(encodeUvarint(value)); }
  writeVarint(value: number): this   { return this.writeBytes(encodeVarint(value)); }
  writeBigUvarint(value: bigint): this { return this.writeBytes(encodeBigUvarint(value)); }
  writeBigVarint(value: bigint): this  { return this.writeBytes(encodeBigVarint(value)); }

  writeString(str: string, encoding: "utf8" | "ascii" = "utf8"): this {
    if (encoding === "ascii") {
      for (let i = 0; i < str.length; i++) this.writeByte(str.charCodeAt(i) & 0x7f);
    } else {
      this.writeBytes(new TextEncoder().encode(str));
    }
    return this;
  }

  /** Write a length-prefixed UTF-8 string (uvarint length + bytes). */
  writeLengthPrefixedString(str: string): this {
    const encoded = new TextEncoder().encode(str);
    this.writeUvarint(encoded.length);
    return this.writeBytes(encoded);
  }
}
