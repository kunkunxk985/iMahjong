/**
 * Password hashing now lives in `@pizhou/shared`.
 *
 * It was previously implemented here *and* inside `worker/src/db.ts`, and the
 * two copies had already drifted:
 *
 *   | | server-core | worker |
 *   |---|---|---|
 *   | iterations for new hashes | 120,000 | 100,000 |
 *   | verify upper bound | 1,000,000 | 100,000 |
 *   | digest comparison | base64 strings | raw bytes |
 *
 * One shared algorithm now retains both platform policies: Node writes 120k and
 * accepts its existing 120k hashes; Workers writes/accepts at most 100k. This is
 * a code deduplication, not an account migration or a reduction in Node's cost.
 *
 * Kept as a re-export so existing `from './password.ts'` imports keep working;
 * prefer importing from `@pizhou/shared`.
 */
export {
  constantTimeStringEqual,
  decodeBase64Url,
  encodeBase64Url,
  generateId,
  generateToken,
  hashPassword,
  LEGACY_PASSWORD_SALT,
  legacyHashPassword,
  PASSWORD_HASH_ITERATIONS,
  PASSWORD_HASH_PREFIX,
  PASSWORD_SALT_BYTES,
  verifyPassword,
} from '@pizhou/shared';
