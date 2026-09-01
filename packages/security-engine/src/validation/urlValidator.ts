export interface NormalizedUrlResult {
  originalUrl: string;
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
  hostname: string;
  port: number;
  pathname: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates and safely normalizes a target URL.
 * Only HTTP and HTTPS schemes are supported.
 */
export function validateAndNormalizeUrl(rawUrl: string): NormalizedUrlResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Target URL must be a non-empty string.');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Target URL cannot be empty.');
  }

  // Prepend https:// ONLY if no scheme is present at all
  let urlToParse = trimmed;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/i.test(urlToParse)) {
    urlToParse = `https://${urlToParse}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlToParse);
  } catch {
    throw new Error('Invalid URL format. Please provide a valid web address.');
  }

  // Validate protocol
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `Unsupported protocol '${parsed.protocol}'. Only http:// and https:// URLs are allowed.`
    );
  }

  // Validate hostname
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname.includes(' ') || hostname.includes('..')) {
    throw new Error('Invalid hostname in target URL.');
  }

  // Check for credentials in URL (disallowed for safety)
  if (parsed.username || parsed.password) {
    throw new Error('URLs containing credentials (user:pass@) are not allowed.');
  }

  const protocol = parsed.protocol as 'http:' | 'https:';
  const defaultPort = protocol === 'https:' ? 443 : 80;
  const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number in target URL.');
  }

  // Normalize path
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Construct standard normalized URL
  const portPart = parsed.port && parseInt(parsed.port, 10) !== defaultPort ? `:${parsed.port}` : '';
  const searchPart = parsed.search || '';
  const normalizedUrl = `${protocol}//${hostname}${portPart}${pathname}${searchPart}`;

  return {
    originalUrl: trimmed,
    normalizedUrl,
    protocol,
    hostname,
    port,
    pathname,
  };
}
