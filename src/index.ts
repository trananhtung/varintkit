export {
  encodeUvarint,
  encodeBigUvarint,
  decodeUvarint,
  decodeBigUvarint,
  encodeUvarintSeq,
  decodeUvarintSeq,
  MAX_UVARINT64_BYTES,
} from "./uvarint.js";

export type { EncodeResult, DecodeResult, DecodeBigResult } from "./uvarint.js";

export {
  zigzagEncode,
  zigzagDecode,
  zigzagEncodeBig,
  zigzagDecodeBig,
  encodeVarint,
  decodeVarint,
  encodeBigVarint,
  decodeBigVarint,
  encodeVarintSeq,
  decodeVarintSeq,
} from "./varint.js";

export { ByteWriter } from "./ByteWriter.js";
export { ByteReader } from "./ByteReader.js";
