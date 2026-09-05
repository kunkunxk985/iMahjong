export const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
export const PASSWORD_HASH_ITERATIONS = 120_000;
export const PASSWORD_SALT_BYTES = 16;
export const LEGACY_PASSWORD_SALT = 'pizhou_salt_v1';

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function constantTimeStringEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}

export async function legacyHashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(`${password}:${LEGACY_PASSWORD_SALT}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  if (!storedHash || typeof storedHash !== 'string') {
    return { valid: false, needsUpgrade: false };
  }

  if (!storedHash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const legacyHash = await legacyHashPassword(password);
    return {
      valid: constantTimeStringEqual(legacyHash, storedHash),
      needsUpgrade: true,
    };
  }

  const parts = storedHash.split('$');
  if (parts.length !== 4) return { valid: false, needsUpgrade: false };
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) {
    return { valid: false, needsUpgrade: false };
  }

  try {
    const salt = decodeBase64Url(parts[2]!);
    const expected = decodeBase64Url(parts[3]!);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as any, iterations, hash: 'SHA-256' },
      key,
      expected.length * 8,
    );
    const actual = new Uint8Array(bits);
    let difference = actual.length ^ expected.length;
    for (let i = 0; i < Math.max(actual.length, expected.length); i += 1) {
      difference |= (actual[i] || 0) ^ (expected[i] || 0);
    }
    return { valid: difference === 0, needsUpgrade: iterations < PASSWORD_HASH_ITERATIONS };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

export function generateToken(userId: string): string {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  return `tk_${userId}_${suffix}`;
}

export function generateId(prefix = 'u'): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}_${rand}`;
}
