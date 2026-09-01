import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Result of SSRF safety validation.
 */
export interface SSRFCheckResult {
  isSafe: boolean;
  resolvedIps: string[];
  reason?: string;
}

// ── Dangerous hostname patterns ──────────────────────────────────────────────

const DANGEROUS_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'instance-data',
  'metadata',
]);

const DANGEROUS_DOMAINS = [
  '.localhost',
  '.local',
  '.internal',
  '.corp',
  '.lan',
  '.home.arpa',
];

// Explicit cloud metadata and control addresses
const CLOUD_METADATA_IPS = new Set([
  '169.254.169.254', // AWS, GCP, Azure, OpenStack, DigitalOcean
  '100.100.100.200', // Alibaba Cloud
  '192.0.0.170',     // Oracle Cloud
  '192.0.0.171',
]);

/**
 * Checks whether an IPv4 address string falls into a private, loopback,
 * link-local, or reserved network range.
 */
export function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;

  if (CLOUD_METADATA_IPS.has(ip)) return true;

  const parts = ip.split('.').map(Number);
  const [b0, b1, b2, b3] = parts;

  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) {
    return true; // Treat malformed as unsafe
  }

  // 0.0.0.0/8 (Broadcast/source)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-Local / APIPA / Cloud Metadata)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT: 100.64.0.0 - 100.127.255.255)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 198.18.0.0/15 (Benchmarking: 198.18.0.0 - 198.19.255.255)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (b0 >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Checks whether an IPv6 address string falls into a private, loopback,
 * link-local, or reserved network range.
 */
export function isPrivateIPv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;

  const normalized = ip.toLowerCase();

  // Loopback (::1) and Unspecified (::)
  if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:') || normalized.startsWith('0:0:0:0:0:ffff:')) {
    const ipv4Part = normalized.split(':').pop();
    if (ipv4Part && net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
    return true; // Treat unknown mapped as unsafe
  }

  // Unique Local Address (fc00::/7 - fc00:... and fd00:...)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized) || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  // Link-Local (fe80::/10 - fe80:..., fe90:..., fea0:..., feb0:...)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized) || normalized.startsWith('fe80:')) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }

  return false;
}

/**
 * Checks whether an IP address (IPv4 or IPv6) is private or reserved.
 */
export function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

/**
 * Checks whether a hostname is prohibited without requiring DNS resolution.
 */
export function isDangerousHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();

  if (DANGEROUS_HOSTNAMES.has(lower)) return true;

  for (const suffix of DANGEROUS_DOMAINS) {
    if (lower.endsWith(suffix)) return true;
  }

  // Check if hostname is an octal, decimal, or hex IP representation
  // e.g., 2130706433 (127.0.0.1 in decimal) or 0x7f000001
  if (/^0x[0-9a-f]+$/i.test(lower) || /^\d+$/.test(lower) || /^0[0-7]+$/.test(lower)) {
    return true;
  }

  // Check if hostname is directly an IP address
  if (net.isIP(lower)) {
    return isPrivateIP(lower);
  }

  return false;
}

/**
 * Performs comprehensive SSRF safety validation for a given hostname.
 * Resolves all DNS records (A and AAAA) and verifies that every destination IP is public.
 */
export async function validateTargetDestination(
  hostname: string,
  resolver?: (host: string) => Promise<string[]>
): Promise<SSRFCheckResult> {
  const cleanHostname = hostname.toLowerCase().trim();

  // 1. Static hostname / direct IP validation
  if (isDangerousHostname(cleanHostname)) {
    return {
      isSafe: false,
      resolvedIps: [],
      reason: `Target '${hostname}' resolves to a local, internal, or prohibited address.`,
    };
  }

  // If directly a public IP, return safe
  if (net.isIP(cleanHostname)) {
    if (isPrivateIP(cleanHostname)) {
      return {
        isSafe: false,
        resolvedIps: [cleanHostname],
        reason: `IP '${cleanHostname}' is within a private, loopback, or reserved network range.`,
      };
    }
    return {
      isSafe: true,
      resolvedIps: [cleanHostname],
    };
  }

  // 2. DNS Resolution
  const resolvedIps: string[] = [];

  try {
    if (resolver) {
      const ips = await resolver(cleanHostname);
      resolvedIps.push(...ips);
    } else {
      // Resolve both IPv4 and IPv6 records
      const [ipv4Records, ipv6Records] = await Promise.allSettled([
        dns.resolve4(cleanHostname),
        dns.resolve6(cleanHostname),
      ]);

      if (ipv4Records.status === 'fulfilled') {
        resolvedIps.push(...ipv4Records.value);
      }
      if (ipv6Records.status === 'fulfilled') {
        resolvedIps.push(...ipv6Records.value);
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    return {
      isSafe: false,
      resolvedIps: [],
      reason: `DNS resolution failed for '${hostname}': ${error.message}`,
    };
  }

  if (resolvedIps.length === 0) {
    return {
      isSafe: false,
      resolvedIps: [],
      reason: `No DNS records (A/AAAA) found for '${hostname}'.`,
    };
  }

  // 3. Check every resolved IP address
  for (const ip of resolvedIps) {
    if (isPrivateIP(ip)) {
      return {
        isSafe: false,
        resolvedIps,
        reason: `Target hostname '${hostname}' resolved to a private or reserved IP address (${ip}). Request blocked for SSRF protection.`,
      };
    }
  }

  return {
    isSafe: true,
    resolvedIps,
  };
}
