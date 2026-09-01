import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { HTTPResponseData, TLSData } from '../types';
import { validateTargetDestination } from '../validation/ssrfGuard';

export interface ControlledFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseSizeBytes?: number;
  userAgent?: string;
  method?: string;
  headers?: Record<string, string>;
  requestCounter?: { count: number; max: number };
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_USER_AGENT = 'WebShieldSecurityScanner/1.0 (+https://webshield.local)';

export interface FetchResult {
  response: HTTPResponseData;
  tlsInfo?: TLSData;
}

/**
 * Performs a controlled, SSRF-safe HTTP or HTTPS request.
 * Re-validates every redirect destination against SSRF rules before following.
 */
export async function controlledFetch(
  targetUrl: string,
  options: ControlledFetchOptions = {}
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxResponseSizeBytes = options.maxResponseSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const method = options.method ?? 'GET';
  const requestCounter = options.requestCounter;

  let currentUrl = targetUrl;
  const redirects: string[] = [];

  for (let redirectHop = 0; redirectHop <= maxRedirects; redirectHop++) {
    // 1. Check request budget
    if (requestCounter) {
      if (requestCounter.count >= requestCounter.max) {
        throw new Error(
          `Request budget exceeded (maximum ${requestCounter.max} requests per scan).`
        );
      }
      requestCounter.count++;
    }

    // 2. Parse & validate URL
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error(`Invalid URL '${currentUrl}' in request chain.`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol '${parsed.protocol}' in request.`);
    }

    // 3. SSRF destination validation
    const ssrfCheck = await validateTargetDestination(parsed.hostname);
    if (!ssrfCheck.isSafe) {
      throw new Error(
        `SSRF Protection: ${ssrfCheck.reason ?? 'Destination is not allowed.'}`
      );
    }

    // 4. Perform the HTTP/HTTPS request
    const isHttps = parsed.protocol === 'https:';
    const isLastHop = redirectHop === maxRedirects;

    const hopResult = await executeSingleRequest({
      url: parsed,
      isHttps,
      method,
      timeoutMs,
      maxResponseSizeBytes,
      userAgent,
      customHeaders: options.headers,
    });

    // 5. Handle redirects (301, 302, 303, 307, 308)
    const statusCode = hopResult.status;
    const isRedirect = [301, 302, 303, 307, 308].includes(statusCode);
    const locationHeader = hopResult.headers['location'];

    if (isRedirect && locationHeader) {
      if (isLastHop) {
        throw new Error(`Maximum redirect limit (${maxRedirects}) reached.`);
      }

      const rawLocation = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      const nextUrl = new URL(rawLocation, currentUrl).toString();

      redirects.push(currentUrl);
      currentUrl = nextUrl;
      continue;
    }

    // Final destination reached
    return {
      response: {
        url: currentUrl,
        status: hopResult.status,
        statusText: hopResult.statusText,
        headers: hopResult.headers,
        rawHeaders: hopResult.rawHeaders,
        body: hopResult.body,
        redirects,
        timing: hopResult.timing,
      },
      tlsInfo: hopResult.tlsInfo,
    };
  }

  throw new Error(`Maximum redirect limit (${maxRedirects}) reached.`);
}

interface SingleRequestOptions {
  url: URL;
  isHttps: boolean;
  method: string;
  timeoutMs: number;
  maxResponseSizeBytes: number;
  userAgent: string;
  customHeaders?: Record<string, string>;
}

interface SingleRequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  rawHeaders: string[];
  body: string;
  timing: {
    dnsLookupMs: number;
    tcpConnectMs: number;
    tlsHandshakeMs?: number;
    totalMs: number;
  };
  tlsInfo?: TLSData;
}

function executeSingleRequest(options: SingleRequestOptions): Promise<SingleRequestResult> {
  return new Promise((resolve, reject) => {
    const { url, isHttps, method, timeoutMs, maxResponseSizeBytes, userAgent, customHeaders } =
      options;

    const startTime = Date.now();
    let dnsLookupTime = 0;
    let tcpConnectTime = 0;
    let tlsHandshakeTime = 0;

    let tlsInfo: TLSData | undefined;

    const reqOptions: https.RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname || '/'}${url.search || ''}`,
      method,
      timeout: timeoutMs,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity', // Plain text to simplify parsing
        Connection: 'close',
        ...customHeaders,
      },
      // Do not reject unauthorized at connection level so we can inspect invalid certificates safely
      rejectUnauthorized: false,
    };

    const requestModule = isHttps ? https : http;

    const req = requestModule.request(reqOptions, res => {
      let body = '';
      let bytesReceived = 0;
      let isTruncated = false;

      res.setEncoding('utf8');

      res.on('data', chunk => {
        if (isTruncated) return;

        bytesReceived += Buffer.byteLength(chunk, 'utf8');
        if (bytesReceived > maxResponseSizeBytes) {
          isTruncated = true;
          body += chunk.slice(0, maxResponseSizeBytes - (bytesReceived - chunk.length));
          req.destroy(); // Stop receiving large responses
          return;
        }

        body += chunk;
      });

      res.on('end', () => {
        const totalMs = Date.now() - startTime;

        const normalizedHeaders: Record<string, string | string[] | undefined> = {};
        for (const [key, val] of Object.entries(res.headers)) {
          normalizedHeaders[key.toLowerCase()] = val;
        }

        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: normalizedHeaders,
          rawHeaders: res.rawHeaders ?? [],
          body,
          timing: {
            dnsLookupMs: dnsLookupTime,
            tcpConnectMs: tcpConnectTime,
            tlsHandshakeMs: isHttps ? tlsHandshakeTime : undefined,
            totalMs,
          },
          tlsInfo,
        });
      });
    });

    req.on('socket', socket => {
      const dnsStart = Date.now();

      socket.on('lookup', () => {
        dnsLookupTime = Date.now() - dnsStart;
      });

      socket.on('connect', () => {
        tcpConnectTime = Date.now() - dnsStart - dnsLookupTime;
      });

      if (isHttps) {
        socket.on('secureConnect', () => {
          tlsHandshakeTime = Date.now() - dnsStart - dnsLookupTime - tcpConnectTime;

          const tlsSocket = socket as tls.TLSSocket;
          if (tlsSocket.getPeerCertificate) {
            try {
              const cert = tlsSocket.getPeerCertificate(true);
              const cipher = tlsSocket.getCipher();
              const protocol = tlsSocket.getProtocol();
              const authorized = tlsSocket.authorized;
              const authorizationError = tlsSocket.authorizationError
                ? String(tlsSocket.authorizationError)
                : undefined;

              if (cert && Object.keys(cert).length > 0) {
                const validTo = cert.valid_to;
                const validFrom = cert.valid_from;
                let daysRemaining: number | undefined;

                if (validTo) {
                  const expiryDate = new Date(validTo);
                  daysRemaining = Math.round(
                    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                }

                const strVal = (v: string | string[] | undefined): string | undefined =>
                  Array.isArray(v) ? v[0] : v;

                tlsInfo = {
                  authorized,
                  authorizationError,
                  protocol: protocol || undefined,
                  cipherName: cipher?.name,
                  cipherVersion: cipher?.version,
                  validFrom,
                  validTo,
                  daysRemaining,
                  issuer: cert.issuer
                    ? {
                        C: strVal(cert.issuer.C),
                        O: strVal(cert.issuer.O),
                        CN: strVal(cert.issuer.CN),
                      }
                    : undefined,
                  subject: cert.subject ? { CN: strVal(cert.subject.CN) } : undefined,
                  subjectAltNames: cert.subjectaltname
                    ? cert.subjectaltname.split(', ').map(s => s.replace(/^DNS:/, ''))
                    : undefined,
                  fingerprint: cert.fingerprint,
                };
              }
            } catch {
              // Non-critical TLS inspection failure
            }
          }
        });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms.`));
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}
