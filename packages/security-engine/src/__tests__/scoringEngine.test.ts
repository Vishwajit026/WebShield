import { describe, it, expect } from 'vitest';
import { calculateSecurityScore, deduplicateFindings } from '../scoring/scoringEngine';
import { FindingInput } from '../types';

describe('Scoring Engine', () => {
  it('returns 100 and Excellent grade when there are no findings', () => {
    const res = calculateSecurityScore([]);
    expect(res.score).toBe(100);
    expect(res.grade).toBe('Excellent');
    expect(res.totalFindings).toBe(0);
  });

  it('deducts 25 for CRITICAL findings', () => {
    const findings: FindingInput[] = [
      {
        scanner: 'cors',
        title: 'Critical Issue',
        category: 'Access Control',
        severity: 'CRITICAL',
        confidence: 'HIGH',
        description: 'Test',
      },
    ];
    const res = calculateSecurityScore(findings);
    expect(res.score).toBe(75);
    expect(res.criticalCount).toBe(1);
    expect(res.grade).toBe('Good');
  });

  it('deducts 15 for HIGH, 8 for MEDIUM, 3 for LOW, and 0 for INFO', () => {
    const findings: FindingInput[] = [
      { scanner: 's1', title: 'H', category: 'C', severity: 'HIGH', confidence: 'HIGH', description: '' },
      { scanner: 's2', title: 'M', category: 'C', severity: 'MEDIUM', confidence: 'HIGH', description: '' },
      { scanner: 's3', title: 'L', category: 'C', severity: 'LOW', confidence: 'HIGH', description: '' },
      { scanner: 's4', title: 'I', category: 'C', severity: 'INFO', confidence: 'HIGH', description: '' },
    ];
    // 100 - (15 + 8 + 3 + 0) = 74 -> Moderate
    const res = calculateSecurityScore(findings);
    expect(res.score).toBe(74);
    expect(res.grade).toBe('Moderate');
    expect(res.highCount).toBe(1);
    expect(res.mediumCount).toBe(1);
    expect(res.lowCount).toBe(1);
    expect(res.infoCount).toBe(1);
  });

  it('clamps minimum score at 0 (never negative)', () => {
    const findings: FindingInput[] = Array.from({ length: 10 }, (_, i) => ({
      scanner: `s${i}`,
      title: `Crit ${i}`,
      category: 'C',
      severity: 'CRITICAL',
      confidence: 'HIGH',
      description: '',
    }));
    // 10 * 25 = 250 deduction -> score 0
    const res = calculateSecurityScore(findings);
    expect(res.score).toBe(0);
    expect(res.grade).toBe('Critical');
  });

  it('deduplicates identical findings', () => {
    const duplicateList: FindingInput[] = [
      {
        scanner: 'headers',
        title: 'Missing CSP',
        category: 'HTTP Headers',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        description: 'First',
        affectedComponent: 'HTTP Headers',
      },
      {
        scanner: 'headers',
        title: 'Missing CSP',
        category: 'HTTP Headers',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        description: 'Second duplicate',
        affectedComponent: 'HTTP Headers',
      },
    ];

    const unique = deduplicateFindings(duplicateList);
    expect(unique).toHaveLength(1);
    expect(unique[0].description).toBe('First');
  });
});
