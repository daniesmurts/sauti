/**
 * Tbank token generation/verification for Deno edge runtime.
 * Mirrors src/modules/subscription/api/tbank/token.ts but uses
 * the Web Crypto API available in Deno instead of the pure-JS SHA-256.
 */

export async function generateTbankTokenAsync(
  params: Record<string, unknown>,
  password: string,
): Promise<string> {
  const entries: Array<{key: string; value: string}> = [];

  for (const [key, value] of Object.entries(params)) {
    if (
      key === 'Token' ||
      value === null ||
      value === undefined ||
      (typeof value === 'object') ||
      Array.isArray(value)
    ) continue;
    entries.push({key, value: String(value)});
  }

  entries.push({key: 'Password', value: password});
  entries.sort((a, b) => a.key.localeCompare(b.key));

  const concatenated = entries.map(e => e.value).join('');
  const encoded = new TextEncoder().encode(concatenated);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function verifyTbankToken(
  params: Record<string, unknown>,
  password: string,
): boolean {
  // Deno edge functions are async-capable; for synchronous webhook handler use
  // we run token generation synchronously using the same pure-JS approach.
  const received = typeof params.Token === 'string' ? params.Token : null;
  if (!received) return false;

  // Build sorted scalar pairs
  const entries: Array<{key: string; value: string}> = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === 'Token' || value === null || value === undefined ||
        typeof value === 'object' || Array.isArray(value)) continue;
    entries.push({key, value: String(value)});
  }
  entries.push({key: 'Password', value: password});
  entries.sort((a, b) => a.key.localeCompare(b.key));
  const concatenated = entries.map(e => e.value).join('');

  // SHA-256 (pure-JS, synchronous)
  const expected = sha256Hex(concatenated);
  return expected === received;
}

// ── Minimal synchronous SHA-256 for Deno ─────────────────────────────────────

function sha256Hex(message: string): string {
  const bytes = encodeUtf8(message);
  return bytesToHex(sha256Bytes(new Uint8Array(bytes)));
}

function encodeUtf8(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];

function sha256Bytes(data: Uint8Array): Uint8Array {
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = data.length;
  const padLen = ((len + 9 + 63) & ~63) - len;
  const padded = new Uint8Array(len + padLen);
  padded.set(data); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, (len * 8) >>> 0, false);
  for (let i = 0; i < padded.length; i += 64) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15],7)^rotr(w[j-15],18)^(w[j-15]>>>3);
      const s1 = rotr(w[j-2],17)^rotr(w[j-2],19)^(w[j-2]>>>10);
      w[j] = (w[j-16]+s0+w[j-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch = (e&f)^(~e&g);
      const t1 = (h+S1+ch+K[j]+w[j])>>>0;
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj = (a&b)^(a&c)^(b&c);
      const t2 = (S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  const r = new Uint8Array(32); const rv = new DataView(r.buffer);
  H.forEach((v,i) => rv.setUint32(i*4,v,false));
  return r;
}

function rotr(x: number, n: number): number { return ((x>>>n)|(x<<(32-n)))>>>0; }
