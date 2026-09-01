import * as argon2 from 'argon2';

/**
 * Argon2id configuration for password hashing.
 * These settings meet OWASP recommendations.
 *
 * - type: argon2id (hybrid, recommended)
 * - memoryCost: 64 MiB
 * - timeCost: 3 iterations
 * - parallelism: 1
 */
const ARGON2_OPTIONS: argon2.HashOptions & { raw: false } = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024, // 64 MiB
  timeCost: 3,
  parallelism: 1,
  raw: false,
};

/**
 * Hash a plaintext password using Argon2id.
 * Never log the returned hash.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored Argon2 hash.
 * Returns true if they match, false otherwise.
 * Never throws on mismatch.
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // argon2.verify throws on malformed hash input — treat as mismatch
    return false;
  }
}
