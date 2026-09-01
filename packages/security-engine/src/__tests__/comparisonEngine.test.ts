import { describe, it, expect } from 'vitest';
import { compareScans } from '../comparison/comparisonEngine';
import { FindingInput } from '../types';

describe('Comparison Engine', () => {
  it('correctly calculates score improvement and categorizes findings', () => {
    const findingA: FindingInput = {
      scanner: 'headers',
      category: 'HEADERS',
      title: 'Missing Content-Security-Policy Header',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      description: 'CSP missing',
      affectedComponent: 'HTTP Response Headers',
    };

    const findingB: FindingInput = {
      scanner: 'headers',
      category: 'HEADERS',
      title: 'Missing Strict-Transport-Security (HSTS) Header',
      severity: 'MEDIUM',
      confidence: 'HIGH',
      description: 'HSTS missing',
      affectedComponent: 'HTTP Response Headers',
    };

    const findingC: FindingInput = {
      scanner: 'cors',
      category: 'CORS',
      title: 'Wildcard CORS Origin With Credentials Allowed',
      severity: 'HIGH',
      confidence: 'HIGH',
      description: 'Wildcard CORS',
      affectedComponent: 'CORS Configuration',
    };

    // Scan 1 had findingA (CSP) and findingB (HSTS) - Score 84
    // Scan 2 resolved findingA (CSP), kept findingB (HSTS), and introduced findingC (CORS) - Score 77
    const result = compareScans({
      previousScanId: 'scan-1',
      currentScanId: 'scan-2',
      previousScore: 84,
      currentScore: 77,
      previousFindings: [findingA, findingB],
      currentFindings: [findingB, findingC],
    });

    expect(result.previousScore).toBe(84);
    expect(result.currentScore).toBe(77);
    expect(result.scoreDifference).toBe(-7); // -7 regression

    expect(result.resolvedCount).toBe(1);
    expect(result.persistentCount).toBe(1);
    expect(result.newCount).toBe(1);
    expect(result.changedCount).toBe(0);

    const resolved = result.findings.filter(f => f.status === 'RESOLVED');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].title).toBe('Missing Content-Security-Policy Header');

    const persistent = result.findings.filter(f => f.status === 'PERSISTENT');
    expect(persistent).toHaveLength(1);
    expect(persistent[0].title).toBe('Missing Strict-Transport-Security (HSTS) Header');

    const newFindings = result.findings.filter(f => f.status === 'NEW');
    expect(newFindings).toHaveLength(1);
    expect(newFindings[0].title).toBe('Wildcard CORS Origin With Credentials Allowed');
  });

  it('detects CHANGED findings when severity or confidence changes', () => {
    const prevFinding: FindingInput = {
      scanner: 'headers',
      category: 'HEADERS',
      title: 'Strict-Transport-Security (HSTS) max-age is Too Short',
      severity: 'LOW',
      confidence: 'MEDIUM',
      description: '',
      affectedComponent: 'Strict-Transport-Security',
    };

    const currFinding: FindingInput = {
      scanner: 'headers',
      category: 'HEADERS',
      title: 'Strict-Transport-Security (HSTS) max-age is Too Short',
      severity: 'MEDIUM', // Severity changed
      confidence: 'HIGH', // Confidence changed
      description: '',
      affectedComponent: 'Strict-Transport-Security',
    };

    const result = compareScans({
      previousScanId: 'scan-1',
      currentScanId: 'scan-2',
      previousScore: 90,
      currentScore: 80,
      previousFindings: [prevFinding],
      currentFindings: [currFinding],
    });

    expect(result.changedCount).toBe(1);
    expect(result.newCount).toBe(0);
    expect(result.resolvedCount).toBe(0);
    expect(result.persistentCount).toBe(0);

    const changed = result.findings.find(f => f.status === 'CHANGED');
    expect(changed).toBeDefined();
    expect(changed?.previousSeverity).toBe('LOW');
    expect(changed?.severity).toBe('MEDIUM');
  });
});
