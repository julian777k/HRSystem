/**
 * Password hashing using Web Crypto API PBKDF2
 * Replaces bcryptjs for Cloudflare Workers Edge Runtime compatibility
 */

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_PASSWORD_LENGTH = 128;

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password exceeds maximum length');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return `pbkdf2:${ITERATIONS}:${bufferToHex(salt.buffer)}:${bufferToHex(derivedBits)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;

  // Support legacy bcrypt hashes (start with $2a$ or $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    // Legacy bcrypt hashes — only verifiable in Node.js (self-hosted)
    if (process.env.DEPLOY_TARGET === 'cloudflare') return false;
    try {
      const _require = new Function('m', 'return require(m)') as NodeRequire;
      const bcryptjs = _require('bcryptjs');
      return await bcryptjs.compare(password, storedHash);
    } catch {
      return false;
    }
  }

  // PBKDF2 hash format: pbkdf2:iterations:salt:hash
  if (!storedHash.startsWith('pbkdf2:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 4) return false;

  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuffer(parts[2]);
  const expectedHash = parts[3];

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH * 8
  );

  const computedHex = bufferToHex(derivedBits);
  const a = new TextEncoder().encode(computedHex);
  const b = new TextEncoder().encode(expectedHash);
  if (a.byteLength !== b.byteLength) return false;
  return constantTimeEqual(a, b);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (password.length > 128) return '비밀번호는 128자 이하여야 합니다.';
  if (!/\d/.test(password)) return '비밀번호에 숫자가 1개 이상 포함되어야 합니다.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return '비밀번호에 특수문자가 1개 이상 포함되어야 합니다.';
  return null;
}
