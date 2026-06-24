/**
 * Signed LEB128 using zigzag encoding.
 *
 * Zigzag maps signed integers to unsigned integers:
 *   0 → 0, -1 → 1, 1 → 2, -2 → 3, 2 → 4, ...
 *   n → (n << 1) ^ (n >> 63)   (for 64-bit)
 *
 * This is "varint" in Go (encoding/binary) and the sint32/sint64 type
 * in Protocol Buffers. Standard int32/int64 in protobuf use uvarint with
 * sign-extension (10-byte encoding for negative numbers) — zigzag is more
 * compact for mixed-sign data.
 */

import { encodeUvarint, decodeUvarint, encodeBigUvarint, decodeBigUvarint } from "./uvarint.js";
import type { DecodeResult, DecodeBigResult } from "./uvarint.js";

/** Zigzag encode: maps signed int → non-negative int for efficient LEB128. */
export function zigzagEncode(value: number): number {
  // Works for values in [-2^52, 2^52)
  return value >= 0 ? value * 2 : (-value - 1) * 2 + 1;
}

/** Zigzag decode: inverse of zigzagEncode. */
export function zigzagDecode(value: number): number {
  return (value & 1) === 0 ? value / 2 : -(value + 1) / 2;
}

export function zigzagEncodeBig(value: bigint): bigint {
  return value >= 0n ? value * 2n : (-value - 1n) * 2n + 1n;
}

export function zigzagDecodeBig(value: bigint): bigint {
  return (value & 1n) === 0n ? value / 2n : -(value + 1n) / 2n;
}

/**
 * Encode a signed integer using zigzag + unsigned LEB128.
 * Handles values in [-Number.MAX_SAFE_INTEGER/2, Number.MAX_SAFE_INTEGER/2].
 */
export function encodeVarint(value: number): Uint8Array {
  if (!Number.isInteger(value)) throw new RangeError(`encodeVarint: value must be an integer, got ${value}`);
  return encodeUvarint(zigzagEncode(value));
}

/**
 * Decode a zigzag-encoded signed LEB128 integer.
 */
export function decodeVarint(bytes: Uint8Array, offset = 0): DecodeResult {
  const { value, bytesRead } = decodeUvarint(bytes, offset);
  return { value: zigzagDecode(value), bytesRead };
}

export function encodeBigVarint(value: bigint): Uint8Array {
  return encodeBigUvarint(zigzagEncodeBig(value));
}

export function decodeBigVarint(bytes: Uint8Array, offset = 0): DecodeBigResult {
  const { value, bytesRead } = decodeBigUvarint(bytes, offset);
  return { value: zigzagDecodeBig(value), bytesRead };
}

/**
 * Encode multiple signed values.
 */
export function encodeVarintSeq(values: number[]): Uint8Array {
  const parts = values.map(encodeVarint);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

export function decodeVarintSeq(bytes: Uint8Array, count?: number): number[] {
  const results: number[] = [];
  let offset = 0;
  while (offset < bytes.length && (count === undefined || results.length < count)) {
    const { value, bytesRead } = decodeVarint(bytes, offset);
    results.push(value);
    offset += bytesRead;
  }
  return results;
}
