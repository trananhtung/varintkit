/**
 * Unsigned LEB128 (Little-Endian Base-128).
 *
 * Each output byte carries 7 bits of the value in its low bits.
 * The high bit (0x80) is set on every byte except the last.
 *
 * This is "uvarint" in Go, and the unsigned varint encoding in Protocol Buffers
 * (wire type 0 fields: int32/int64/uint32/uint64/bool/enum).
 *
 * Supports BigInt for values > Number.MAX_SAFE_INTEGER.
 */

export interface EncodeResult {
  bytes: Uint8Array;
  bytesWritten: number;
}

export interface DecodeResult {
  value: number;
  bytesRead: number;
}

export interface DecodeBigResult {
  value: bigint;
  bytesRead: number;
}

/** Maximum bytes for a 64-bit uvarint (ceil(64/7) = 10). */
export const MAX_UVARINT64_BYTES = 10;

/**
 * Encode a non-negative number as unsigned LEB128.
 * Input must be a safe non-negative integer (0 ≤ n ≤ 2^53-1).
 * For larger values use encodeBigUvarint().
 */
export function encodeUvarint(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`encodeUvarint: value must be a non-negative safe integer, got ${value}`);
  }
  const buf = new Uint8Array(8); // max 8 bytes for values up to 2^53
  let i = 0;
  while (value > 0x7f) {
    buf[i++] = (value & 0x7f) | 0x80;
    value = Math.floor(value / 128); // arithmetic right-shift without BigInt
  }
  buf[i++] = value & 0x7f;
  return buf.slice(0, i);
}

/**
 * Encode a non-negative BigInt as unsigned LEB128 (up to 64-bit values).
 */
export function encodeBigUvarint(value: bigint): Uint8Array {
  if (value < 0n) throw new RangeError(`encodeBigUvarint: value must be non-negative, got ${value}`);
  const buf = new Uint8Array(MAX_UVARINT64_BYTES);
  let i = 0;
  while (value > 0x7fn) {
    buf[i++] = Number(value & 0x7fn) | 0x80;
    value >>= 7n;
  }
  buf[i++] = Number(value & 0x7fn);
  return buf.slice(0, i);
}

/**
 * Decode unsigned LEB128 from bytes starting at offset.
 * Returns { value: number, bytesRead: number }.
 * Throws if the encoding is truncated or exceeds safe integer range.
 */
export function decodeUvarint(bytes: Uint8Array, offset = 0): DecodeResult {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  while (true) {
    if (offset + bytesRead >= bytes.length) {
      throw new RangeError(`decodeUvarint: truncated encoding at offset ${offset + bytesRead}`);
    }
    const byte = bytes[offset + bytesRead]!;
    bytesRead++;
    if (shift === 49) {
      // At 7*7=49 bits we must check overflow (safe int = 53 bits)
      if (byte > 0x0f) throw new RangeError("decodeUvarint: value exceeds Number.MAX_SAFE_INTEGER; use decodeBigUvarint");
    }
    value += (byte & 0x7f) * Math.pow(2, shift);
    shift += 7;
    if ((byte & 0x80) === 0) break;
    if (shift > 63) throw new RangeError("decodeUvarint: encoding too long (> 64 bits)");
  }
  return { value, bytesRead };
}

/**
 * Decode unsigned LEB128 as a BigInt. Handles up to 64-bit values.
 */
export function decodeBigUvarint(bytes: Uint8Array, offset = 0): DecodeBigResult {
  let value = 0n;
  let shift = 0n;
  let bytesRead = 0;
  while (true) {
    if (offset + bytesRead >= bytes.length) {
      throw new RangeError(`decodeBigUvarint: truncated encoding at offset ${offset + bytesRead}`);
    }
    const byte = bytes[offset + bytesRead]!;
    bytesRead++;
    value |= BigInt(byte & 0x7f) << shift;
    shift += 7n;
    if ((byte & 0x80) === 0) break;
    if (shift > 63n) throw new RangeError("decodeBigUvarint: encoding exceeds 64 bits");
  }
  return { value, bytesRead };
}

/**
 * Encode multiple values into a single Uint8Array.
 */
export function encodeUvarintSeq(values: number[]): Uint8Array {
  const parts = values.map(encodeUvarint);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

/**
 * Decode a sequence of unsigned varints from bytes.
 * Reads until end of buffer or `count` values decoded (if specified).
 */
export function decodeUvarintSeq(bytes: Uint8Array, count?: number): number[] {
  const results: number[] = [];
  let offset = 0;
  while (offset < bytes.length && (count === undefined || results.length < count)) {
    const { value, bytesRead } = decodeUvarint(bytes, offset);
    results.push(value);
    offset += bytesRead;
  }
  return results;
}
