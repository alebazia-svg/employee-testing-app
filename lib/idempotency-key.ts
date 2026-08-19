function uuidFromBytes(bytes: Uint8Array) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fallbackBytes() {
  const bytes = new Uint8Array(16);
  let time = Date.now();
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (time + Math.floor(Math.random() * 256)) & 0xff;
    time = Math.floor(time / 256) || Date.now();
  }
  return bytes;
}

export function createIdempotencyKey(cryptoSource: Pick<Crypto, 'randomUUID' | 'getRandomValues'> | undefined = globalThis.crypto) {
  const nativeUuid = cryptoSource?.randomUUID?.();
  if (nativeUuid) return nativeUuid;

  const bytes = new Uint8Array(16);
  if (cryptoSource?.getRandomValues) cryptoSource.getRandomValues(bytes);
  else bytes.set(fallbackBytes());
  return uuidFromBytes(bytes);
}
