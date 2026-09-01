import { describe, it, expect } from 'vitest';
import {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIP,
  isDangerousHostname,
  validateTargetDestination,
} from '../validation/ssrfGuard';

describe('SSRF Guard - IPv4 Range Checks', () => {
  it('identifies loopback addresses as private (127.0.0.0/8)', () => {
    expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    expect(isPrivateIPv4('127.0.0.2')).toBe(true);
    expect(isPrivateIPv4('127.255.255.255')).toBe(true);
  });

  it('identifies RFC 1918 Class A as private (10.0.0.0/8)', () => {
    expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateIPv4('10.255.255.254')).toBe(true);
  });

  it('identifies RFC 1918 Class B as private (172.16.0.0/12)', () => {
    expect(isPrivateIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateIPv4('172.20.10.5')).toBe(true);
    expect(isPrivateIPv4('172.31.255.255')).toBe(true);
    // 172.32.x.x is public
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
  });

  it('identifies RFC 1918 Class C as private (192.168.0.0/16)', () => {
    expect(isPrivateIPv4('192.168.0.1')).toBe(true);
    expect(isPrivateIPv4('192.168.1.254')).toBe(true);
  });

  it('identifies Link-Local / Cloud Metadata (169.254.0.0/16)', () => {
    expect(isPrivateIPv4('169.254.169.254')).toBe(true);
    expect(isPrivateIPv4('169.254.1.1')).toBe(true);
  });

  it('identifies 0.0.0.0/8, Broadcast, and Multicast', () => {
    expect(isPrivateIPv4('0.0.0.0')).toBe(true);
    expect(isPrivateIPv4('255.255.255.255')).toBe(true);
    expect(isPrivateIPv4('224.0.0.1')).toBe(true);
  });

  it('allows legitimate public IPv4 addresses', () => {
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateIPv4('1.1.1.1')).toBe(false);
    expect(isPrivateIPv4('93.184.216.34')).toBe(false);
    expect(isPrivateIPv4('142.250.190.46')).toBe(false);
  });
});

describe('SSRF Guard - IPv6 Range Checks', () => {
  it('identifies loopback and unspecified IPv6 as private (::1, ::)', () => {
    expect(isPrivateIPv6('::1')).toBe(true);
    expect(isPrivateIPv6('::')).toBe(true);
  });

  it('identifies Unique Local Addresses (fc00::/7)', () => {
    expect(isPrivateIPv6('fc00::1')).toBe(true);
    expect(isPrivateIPv6('fd12:3456:789a:1::1')).toBe(true);
  });

  it('identifies Link-Local (fe80::/10)', () => {
    expect(isPrivateIPv6('fe80::1')).toBe(true);
    expect(isPrivateIPv6('fe80::1ff:fe00:3a60')).toBe(true);
  });

  it('identifies IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)', () => {
    expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIPv6('::ffff:192.168.1.1')).toBe(true);
  });

  it('allows legitimate public IPv6 addresses', () => {
    expect(isPrivateIPv6('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
    expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
  });
});

describe('SSRF Guard - Dangerous Hostnames & Formats', () => {
  it('identifies localhost and subdomains', () => {
    expect(isDangerousHostname('localhost')).toBe(true);
    expect(isDangerousHostname('sub.localhost')).toBe(true);
    expect(isDangerousHostname('app.local')).toBe(true);
    expect(isDangerousHostname('service.internal')).toBe(true);
    expect(isDangerousHostname('db.corp')).toBe(true);
    expect(isDangerousHostname('metadata.google.internal')).toBe(true);
  });

  it('identifies decimal and hex IP representations', () => {
    expect(isDangerousHostname('2130706433')).toBe(true); // 127.0.0.1 in decimal
    expect(isDangerousHostname('0x7f000001')).toBe(true); // 127.0.0.1 in hex
  });

  it('allows legitimate public hostnames', () => {
    expect(isDangerousHostname('example.com')).toBe(false);
    expect(isDangerousHostname('api.github.com')).toBe(false);
    expect(isDangerousHostname('google.com')).toBe(false);
  });
});

describe('SSRF Guard - validateTargetDestination', () => {
  it('blocks dangerous hostnames immediately without DNS resolution', async () => {
    const res = await validateTargetDestination('localhost');
    expect(res.isSafe).toBe(false);
    expect(res.reason).toMatch(/prohibited|local|internal/);
  });

  it('blocks direct private IP target', async () => {
    const res = await validateTargetDestination('127.0.0.1');
    expect(res.isSafe).toBe(false);
    expect(res.reason).toMatch(/prohibited|private|local|internal/i);
  });

  it('blocks target when DNS resolves to a private IP (DNS Rebinding protection)', async () => {
    // Mock resolver simulating a domain resolving to an internal IP
    const mockResolver = async () => ['10.0.0.5'];
    const res = await validateTargetDestination('internal-service.example.org', mockResolver);
    expect(res.isSafe).toBe(false);
    expect(res.reason).toMatch(/resolved to a private or reserved IP/);
  });

  it('blocks target when DNS resolves to multiple IPs and one is private', async () => {
    const mockResolver = async () => ['93.184.216.34', '192.168.1.100'];
    const res = await validateTargetDestination('dual-homed.example.org', mockResolver);
    expect(res.isSafe).toBe(false);
    expect(res.reason).toMatch(/resolved to a private/);
  });

  it('approves targets that resolve only to public IPs', async () => {
    const mockResolver = async () => ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'];
    const res = await validateTargetDestination('example.com', mockResolver);
    expect(res.isSafe).toBe(true);
    expect(res.resolvedIps).toHaveLength(2);
  });
});
