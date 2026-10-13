/** Portable Web Crypto implementation; each runtime retains its own policy. */
export const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
export const PASSWORD_SALT_BYTES = 16;
export const LEGACY_PASSWORD_SALT = 'pizhou_salt_v1';
export const PASSWORD_HASH_ITERATIONS = 120_000;

export interface PasswordPolicy {
  iterations: number;
  maxVerifyIterations: number;
}
export const NODE_PASSWORD_POLICY: Readonly<PasswordPolicy> = Object.freeze({ iterations: 120_000, maxVerifyIterations: 1_000_000 });
// Workers' Web Crypto PBKDF2 ceiling; do not infer Node compatibility from Node tests.
export const WORKER_PASSWORD_POLICY: Readonly<PasswordPolicy> = Object.freeze({ iterations: 100_000, maxVerifyIterations: 100_000 });

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}
/** No early mismatch return; JavaScript/JIT cannot guarantee constant-time execution. */
export function constantTimeStringEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    difference |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return difference === 0;
}
export async function legacyHashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${password}:${LEGACY_PASSWORD_SALT}`));
  return Array.from(new Uint8Array(buf), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: Uint8Array.from(salt), iterations, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bytes);
}
export function createPasswordHasher(policy: Readonly<PasswordPolicy>) {
  const { iterations: current, maxVerifyIterations: maximum } = policy;
  if (!Number.isInteger(current) || current < 10_000 || !Number.isInteger(maximum) || maximum < current) {
    throw new Error('Invalid password hashing policy');
  }
  return {
    async hashPassword(password: string): Promise<string> {
      const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
      return `${PASSWORD_HASH_PREFIX}$${current}$${encodeBase64Url(salt)}$${encodeBase64Url(await derive(password, salt, current))}`;
    },
    async verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
      const invalid = { valid: false, needsUpgrade: false };
      if (typeof storedHash !== 'string' || !storedHash) return invalid;
      if (!storedHash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
        const valid = /^[a-f0-9]{64}$/.test(storedHash) && constantTimeStringEqual(await legacyHashPassword(password), storedHash);
        return { valid, needsUpgrade: valid };
      }
      const parts = storedHash.split('$');
      if (parts.length !== 4 || !/^\d+$/.test(parts[1]!)) return invalid;
      const iterations = Number(parts[1]);
      if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > maximum) return invalid;
      try {
        const salt = decodeBase64Url(parts[2]!);
        const expected = decodeBase64Url(parts[3]!);
        if (salt.length !== PASSWORD_SALT_BYTES || expected.length !== 32) return invalid;
        if (encodeBase64Url(salt) !== parts[2] || encodeBase64Url(expected) !== parts[3]) return invalid;
        const actual = await derive(password, salt, iterations);
        const valid = constantTimeStringEqual(encodeBase64Url(actual), encodeBase64Url(expected));
        return { valid, needsUpgrade: valid && iterations < current };
      } catch { return invalid; }
    },
  };
}
const nodeHasher = createPasswordHasher(NODE_PASSWORD_POLICY);
export const hashPassword = nodeHasher.hashPassword;
export const verifyPassword = nodeHasher.verifyPassword;

// Preserve existing public ID/token format. IDs are not authentication credentials.
export function generateToken(userId: string): string {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(2)).join('_')}`;
  return `tk_${userId}_${suffix}`;
}
export function generateId(prefix = 'u'): string {
  return `${prefix}_${crypto.getRandomValues(new Uint32Array(1))[0]! % 900_000 + 100_000}`;
}
