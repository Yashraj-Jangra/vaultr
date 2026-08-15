const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export function uint8ArrayToBase64(uint8: Uint8Array): string {
  let tmp;
  const len = uint8.length;
  const extraBytes = len % 3;
  const parts = [];
  const maxChunkLength = 16383; // must be multiple of 3

  for (let i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    const start = i;
    const end = (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength);
    const output = [];
    for (let j = start; j < end; j += 3) {
      tmp = ((uint8[j] << 16) & 0xFF0000) + ((uint8[j + 1] << 8) & 0xFF00) + (uint8[j + 2] & 0xFF);
      output.push(chars[(tmp >> 18) & 0x3F] + chars[(tmp >> 12) & 0x3F] + chars[(tmp >> 6) & 0x3F] + chars[tmp & 0x3F]);
    }
    parts.push(output.join(''));
  }

  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    parts.push(chars[tmp >> 2] + chars[(tmp << 4) & 0x3F] + '==');
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    parts.push(chars[tmp >> 10] + chars[(tmp >> 4) & 0x3F] + chars[(tmp << 2) & 0x3F] + '=');
  }

  return parts.join('');
}

export function base64ToUint8Array(base64Raw: string): Uint8Array {
  const base64 = base64Raw.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  const len = base64.length;
  let bufferLength = base64.length * 0.75;
  
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arraybuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arraybuffer);

  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}
