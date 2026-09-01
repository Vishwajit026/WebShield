import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class TlsScanner implements Scanner {
  id = 'tls';
  name = 'TLS Protocol & Certificate Security Scanner';
  version = '2.0.0';
  description =
    'Inspects certificate validity, expiration, hostname verification, negotiated TLS versions, and cipher suites.';
  category: StandardCategory = 'TLS';
  riskLevel: Severity = 'HIGH';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const tlsInfo = context.tlsInfo;

    if (!tlsInfo || !context.isHttps) return findings;

    // ── 1. Certificate Validity & Authorization ─────────────────────────────
    if (!tlsInfo.authorized) {
      findings.push({
        scanner: this.id,
        title: 'Untrusted or Invalid SSL/TLS Certificate',
        category: 'TLS',
        severity: 'HIGH',
        confidence: 'HIGH',
        description: `The SSL/TLS certificate presented by the server failed validation: ${tlsInfo.authorizationError ?? 'Unknown authorization error'}.`,
        evidence: `Authorization Error: ${tlsInfo.authorizationError ?? 'SELF_SIGNED_OR_UNTRUSTED'}`,
        impact:
          'Users will see browser security warnings, and connections are exposed to Man-in-the-Middle (MitM) interception.',
        remediation:
          'Install a valid, publicly trusted certificate issued by a recognized Certificate Authority (e.g. Let\'s Encrypt, DigiCert).',
        reference: 'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html',
        affectedComponent: 'SSL/TLS Certificate',
      });
    }

    // ── 2. Certificate Expiration ───────────────────────────────────────────
    if (typeof tlsInfo.daysRemaining === 'number') {
      if (tlsInfo.daysRemaining <= 0) {
        findings.push({
          scanner: this.id,
          title: 'SSL/TLS Certificate Has Expired',
          category: 'TLS',
          severity: 'HIGH',
          confidence: 'HIGH',
          description: `The SSL/TLS certificate expired ${Math.abs(tlsInfo.daysRemaining)} day(s) ago (Valid To: ${tlsInfo.validTo ?? 'Unknown'}).`,
          evidence: `Valid To: ${tlsInfo.validTo}, Days Remaining: ${tlsInfo.daysRemaining}`,
          impact:
            'Browsers reject connections to sites with expired certificates, preventing user access.',
          remediation: 'Renew and deploy a fresh SSL/TLS certificate immediately.',
          reference: 'https://developer.mozilla.org/en-US/docs/Glossary/SSL_certificate',
          affectedComponent: 'SSL/TLS Certificate',
        });
      } else if (tlsInfo.daysRemaining <= 30) {
        findings.push({
          scanner: this.id,
          title: 'SSL/TLS Certificate Expiring Soon (< 30 Days)',
          category: 'TLS',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The SSL/TLS certificate expires in ${tlsInfo.daysRemaining} days (Valid To: ${tlsInfo.validTo ?? 'Unknown'}).`,
          evidence: `Valid To: ${tlsInfo.validTo}, Days Remaining: ${tlsInfo.daysRemaining}`,
          impact:
            'If not renewed promptly, visitors will encounter browser warning screens upon certificate expiry.',
          remediation:
            'Schedule automatic or manual renewal of the SSL/TLS certificate prior to expiration.',
          reference: 'https://letsencrypt.org/docs/faq/',
          affectedComponent: 'SSL/TLS Certificate',
        });
      }
    }

    // ── 3. Hostname SAN Validation ──────────────────────────────────────────
    if (tlsInfo.subjectAltNames && tlsInfo.subjectAltNames.length > 0) {
      const hostname = context.hostname.toLowerCase();
      const matches = tlsInfo.subjectAltNames.some(san => {
        const cleanSan = san.replace(/^DNS:/i, '').trim().toLowerCase();
        if (cleanSan.startsWith('*.')) {
          const rootDomain = cleanSan.slice(2);
          return hostname.endsWith(rootDomain) && hostname.split('.').length === cleanSan.split('.').length;
        }
        return cleanSan === hostname;
      });

      if (!matches && tlsInfo.authorized) {
        findings.push({
          scanner: this.id,
          title: 'Certificate Subject Alternative Name (SAN) Mismatch',
          category: 'TLS',
          severity: 'HIGH',
          confidence: 'MEDIUM',
          description: `The hostname '${context.hostname}' does not match any of the Subject Alternative Names in the certificate.`,
          evidence: `Target: ${context.hostname}, SANs: ${tlsInfo.subjectAltNames.slice(0, 5).join(', ')}`,
          impact:
            'Browsers will flag this connection as a hostname mismatch error (ERR_CERT_COMMON_NAME_INVALID).',
          remediation:
            'Ensure the target domain is included in the certificate\'s Subject Alternative Names (SANs).',
          reference: 'https://datatracker.ietf.org/doc/html/rfc6125',
          affectedComponent: 'SSL/TLS Certificate SAN',
        });
      }
    }

    // ── 4. Deprecated Protocol Version ──────────────────────────────────────
    if (tlsInfo.protocol) {
      const protocol = tlsInfo.protocol.toUpperCase();
      if (['TLSV1', 'TLSV1.0', 'TLSV1.1', 'SSLV3', 'SSLV2'].includes(protocol)) {
        findings.push({
          scanner: this.id,
          title: `Deprecated TLS Protocol Version Negotiated (${tlsInfo.protocol})`,
          category: 'TLS',
          severity: 'HIGH',
          confidence: 'HIGH',
          description: `The server negotiated an outdated and deprecated TLS protocol version: ${tlsInfo.protocol}. Modern security standards (PCI-DSS, NIST) require disabling TLS 1.0 and 1.1.`,
          evidence: `Negotiated Protocol: ${tlsInfo.protocol}`,
          impact:
            'Older protocols suffer from cryptographic flaws (BEAST, POODLE, Lucky13) and lack modern forward secrecy.',
          remediation:
            'Disable TLS 1.0 and TLS 1.1 on your server. Only enable TLS 1.2 and TLS 1.3.',
          reference: 'https://datatracker.ietf.org/doc/rfc8996/',
          affectedComponent: 'TLS Protocol Configuration',
        });
      }
    }

    // ── 5. Cipher Suite Weakness ────────────────────────────────────────────
    if (tlsInfo.cipherName) {
      const cipher = tlsInfo.cipherName.toUpperCase();
      const isWeak =
        cipher.includes('RC4') ||
        cipher.includes('DES') ||
        cipher.includes('3DES') ||
        cipher.includes('MD5') ||
        cipher.includes('NULL') ||
        cipher.includes('EXPORT');

      if (isWeak) {
        findings.push({
          scanner: this.id,
          title: `Weak or Insecure TLS Cipher Suite (${tlsInfo.cipherName})`,
          category: 'TLS',
          severity: 'HIGH',
          confidence: 'HIGH',
          description: `The negotiated cipher suite '${tlsInfo.cipherName}' relies on obsolete or weak cryptographic primitives.`,
          evidence: `Negotiated Cipher: ${tlsInfo.cipherName}`,
          impact:
            'Weak ciphers are susceptible to cryptanalysis, plaintext recovery, and traffic decryption.',
          remediation:
            'Configure your web server to prioritize modern AEAD cipher suites (e.g. ECDHE-ECDSA-AES128-GCM-SHA256, ECDHE-RSA-AES128-GCM-SHA256).',
          reference:
            'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html#cipher-suites',
          affectedComponent: 'TLS Cipher Configuration',
        });
      }
    }

    return findings;
  }
}
