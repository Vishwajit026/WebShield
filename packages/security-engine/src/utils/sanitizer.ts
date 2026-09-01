/**
 * Redacts sensitive tokens, credentials, and full cookie values from finding evidence strings.
 */

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'api-key',
  'cookie',
  'set-cookie',
]);

/**
 * Redacts sensitive values in Set-Cookie headers while preserving security flags and attributes.
 * Example:
 * Input:  "session_id=abc123xyz; Path=/; Secure; HttpOnly; SameSite=Lax"
 * Output: "session_id=[REDACTED]; Path=/; Secure; HttpOnly; SameSite=Lax"
 */
export function sanitizeSetCookieHeader(setCookieStr: string): string {
  if (!setCookieStr) return '';

  const parts = setCookieStr.split(';');
  if (parts.length === 0) return '';

  const firstPart = parts[0].trim();
  const eqIdx = firstPart.indexOf('=');

  if (eqIdx === -1) {
    return '[REDACTED_COOKIE]';
  }

  const cookieName = firstPart.slice(0, eqIdx);
  const attributes = parts.slice(1).map(p => p.trim()).join('; ');

  return attributes
    ? `${cookieName}=[REDACTED]; ${attributes}`
    : `${cookieName}=[REDACTED]`;
}

/**
 * Redacts Authorization and other sensitive headers in raw header arrays or maps.
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  const sanitized: Record<string, string | string[] | undefined> = {};

  for (const [key, val] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (val === undefined) {
      sanitized[key] = undefined;
      continue;
    }

    if (lowerKey === 'set-cookie') {
      if (Array.isArray(val)) {
        sanitized[key] = val.map(sanitizeSetCookieHeader);
      } else {
        sanitized[key] = sanitizeSetCookieHeader(val);
      }
    } else if (SENSITIVE_HEADERS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Sanitizes arbitrary text evidence strings to ensure secrets and auth cookies are not leaked.
 */
export function sanitizeEvidence(evidence: string): string {
  if (!evidence) return '';

  let sanitized = evidence;

  // Redact bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]');

  // Redact basic auth
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]');

  // Redact Set-Cookie lines in multi-line headers
  sanitized = sanitized.replace(
    /^(set-cookie:\s*)([^=;]+)=([^;]+)(.*)$/gim,
    '$1$2=[REDACTED]$4'
  );

  return sanitized;
}
