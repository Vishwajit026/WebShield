import {
  EngineOptions,
  EngineResult,
  FindingInput,
  HTTPResponseData,
  ScanContext,
  Scanner,
  TLSData,
} from '../types';
import { validateAndNormalizeUrl } from '../validation/urlValidator';
import { validateTargetDestination } from '../validation/ssrfGuard';
import { controlledFetch } from '../network/httpClient';
import { calculateSecurityScore, deduplicateFindings } from '../scoring/scoringEngine';

// Import all scanners
import { HttpsScanner } from '../scanners/httpsScanner';
import { HeadersScanner } from '../scanners/headersScanner';
import { CookieScanner } from '../scanners/cookieScanner';
import { CorsScanner } from '../scanners/corsScanner';
import { InformationDisclosureScanner } from '../scanners/informationDisclosureScanner';
import { TechnologyScanner } from '../scanners/technologyScanner';
import { TlsScanner } from '../scanners/tlsScanner';
import { WellKnownScanner } from '../scanners/wellKnownScanner';

export class ScannerEngine {
  private scanners: Scanner[] = [];

  constructor() {
    this.registerDefaultScanners();
  }

  private registerDefaultScanners(): void {
    this.scanners = [
      new HttpsScanner(),
      new HeadersScanner(),
      new CookieScanner(),
      new CorsScanner(),
      new InformationDisclosureScanner(),
      new TechnologyScanner(),
      new TlsScanner(),
      new WellKnownScanner(),
    ];
  }

  public registerScanner(scanner: Scanner): void {
    this.scanners.push(scanner);
  }

  public getScanners(): Scanner[] {
    return [...this.scanners];
  }

  /**
   * Executes a full passive security scan on the provided target URL.
   */
  async runScan(rawUrl: string, options: EngineOptions = {}): Promise<EngineResult> {
    const startedAt = new Date();

    // 1. Validate & normalize target URL
    const normalized = validateAndNormalizeUrl(rawUrl);

    // 2. SSRF Destination Safety Check
    const ssrfCheck = await validateTargetDestination(normalized.hostname);
    if (!ssrfCheck.isSafe) {
      throw new Error(`SSRF Blocked: ${ssrfCheck.reason ?? 'Target destination is not allowed.'}`);
    }

    const isHttps = normalized.protocol === 'https:';
    const requestCounter = { count: 0, max: options.maxRequests ?? 20 };

    let primaryResponse: HTTPResponseData | undefined;
    let httpResponse: HTTPResponseData | undefined;
    let httpsResponse: HTTPResponseData | undefined;
    let securityTxtResponse: HTTPResponseData | undefined;
    let robotsTxtResponse: HTTPResponseData | undefined;
    let tlsInfo: TLSData | undefined;

    // 3. Perform primary request
    try {
      const primaryResult = await controlledFetch(normalized.normalizedUrl, {
        timeoutMs: options.timeoutMs,
        maxRedirects: options.maxRedirects,
        maxResponseSizeBytes: options.maxResponseSizeBytes,
        userAgent: options.userAgent,
        requestCounter,
      });

      primaryResponse = primaryResult.response;
      if (primaryResult.tlsInfo) {
        tlsInfo = primaryResult.tlsInfo;
      }

      if (isHttps) {
        httpsResponse = primaryResponse;
      } else {
        httpResponse = primaryResponse;
      }
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`Target connection failed: ${error.message}`);
    }

    // 4. Secondary Probes (HTTPS upgrade check or HTTP downgrade check)
    if (!isHttps && requestCounter.count < requestCounter.max) {
      try {
        const httpsUrl = `https://${normalized.hostname}${normalized.port !== 80 ? `:${normalized.port}` : ''}${normalized.pathname}`;
        const probeResult = await controlledFetch(httpsUrl, {
          timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000),
          maxRedirects: 1,
          userAgent: options.userAgent,
          requestCounter,
        });
        httpsResponse = probeResult.response;
        if (probeResult.tlsInfo) {
          tlsInfo = probeResult.tlsInfo;
        }
      } catch {
        // HTTPS probe failed, which is expected for HTTP-only targets
      }
    } else if (isHttps && requestCounter.count < requestCounter.max) {
      // Test plain HTTP to see if it redirects to HTTPS
      try {
        const httpUrl = `http://${normalized.hostname}${normalized.port !== 443 ? `:${normalized.port}` : ''}${normalized.pathname}`;
        const probeResult = await controlledFetch(httpUrl, {
          timeoutMs: Math.min(options.timeoutMs ?? 5000, 5000),
          maxRedirects: 0, // We want to inspect the initial redirect on port 80
          userAgent: options.userAgent,
          requestCounter,
        });
        httpResponse = probeResult.response;
      } catch {
        // HTTP probe may fail if port 80 is closed
      }
    }

    // 5. Passive well-known policy probes (security.txt and robots.txt)
    const baseOrigin = `${isHttps ? 'https' : 'http'}://${normalized.hostname}${
      (isHttps && normalized.port !== 443) || (!isHttps && normalized.port !== 80)
        ? `:${normalized.port}`
        : ''
    }`;

    if (requestCounter.count < requestCounter.max) {
      try {
        const secTxtUrl = `${baseOrigin}/.well-known/security.txt`;
        const res = await controlledFetch(secTxtUrl, {
          timeoutMs: 3000,
          maxRedirects: 1,
          maxResponseSizeBytes: 32768, // 32 KB max
          userAgent: options.userAgent,
          requestCounter,
        });
        securityTxtResponse = res.response;
      } catch {
        // security.txt probe failed or 404
      }
    }

    if (requestCounter.count < requestCounter.max) {
      try {
        const robotsUrl = `${baseOrigin}/robots.txt`;
        const res = await controlledFetch(robotsUrl, {
          timeoutMs: 3000,
          maxRedirects: 1,
          maxResponseSizeBytes: 32768, // 32 KB max
          userAgent: options.userAgent,
          requestCounter,
        });
        robotsTxtResponse = res.response;
      } catch {
        // robots.txt probe failed or 404
      }
    }

    // 6. Build ScanContext
    const context: ScanContext = {
      targetUrl: rawUrl,
      normalizedUrl: normalized.normalizedUrl,
      hostname: normalized.hostname,
      port: normalized.port,
      isHttps,
      httpResponse,
      httpsResponse,
      securityTxtResponse,
      robotsTxtResponse,
      tlsInfo,
      options,
      executedScanners: [],
      scannerErrors: {},
    };

    // 7. Execute all scanners sequentially
    const rawFindings: FindingInput[] = [];

    for (const scanner of this.scanners) {
      try {
        const scannerFindings = await scanner.scan(context);
        rawFindings.push(...scannerFindings);
        context.executedScanners.push(scanner.id);
      } catch (err: unknown) {
        const error = err as Error;
        context.scannerErrors[scanner.id] = error.message;
      }
    }

    // 8. Deduplicate findings
    const findings = deduplicateFindings(rawFindings);

    // 9. Calculate score & summary metrics
    const score = calculateSecurityScore(findings);
    const completedAt = new Date();

    return {
      targetUrl: rawUrl,
      normalizedUrl: normalized.normalizedUrl,
      hostname: normalized.hostname,
      startedAt,
      completedAt,
      findings,
      score,
      executedScanners: context.executedScanners,
      scannerErrors: context.scannerErrors,
    };
  }
}
