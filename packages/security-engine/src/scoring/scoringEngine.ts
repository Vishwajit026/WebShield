import {
  FindingInput,
  ScoreDetails,
  ScoreDeduction,
  ScoreExplanation,
  Severity,
} from '../types';

export const DEDUCTIONS: Record<Severity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
  INFO: 0,
};

/**
 * Generates a deterministic composite fingerprint for a finding.
 * Format: `${scanner}::${category}::${title}::${affectedComponent ?? ''}`
 */
export function generateFindingFingerprint(finding: FindingInput): string {
  const normScanner = (finding.scanner || '').trim().toLowerCase();
  const normCategory = (finding.category || '').trim().toUpperCase();
  const normTitle = (finding.title || '').trim().toLowerCase();
  const normComponent = (finding.affectedComponent || '').trim().toLowerCase();

  return `${normScanner}::${normCategory}::${normTitle}::${normComponent}`;
}

/**
 * Calculates the security score and detailed deduction explanations from findings.
 * Score is deterministic and clamped between 0 and 100.
 */
export function calculateSecurityScore(findings: FindingInput[]): ScoreDetails {
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let infoCount = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL':
        criticalCount++;
        break;
      case 'HIGH':
        highCount++;
        break;
      case 'MEDIUM':
        mediumCount++;
        break;
      case 'LOW':
        lowCount++;
        break;
      case 'INFO':
        infoCount++;
        break;
    }
  }

  const deductions: ScoreDeduction[] = [];

  if (criticalCount > 0) {
    deductions.push({
      severity: 'CRITICAL',
      count: criticalCount,
      deductionPerFinding: DEDUCTIONS.CRITICAL,
      totalPoints: criticalCount * DEDUCTIONS.CRITICAL,
      description: `${criticalCount} Critical issue(s) (-${criticalCount * DEDUCTIONS.CRITICAL} pts)`,
    });
  }

  if (highCount > 0) {
    deductions.push({
      severity: 'HIGH',
      count: highCount,
      deductionPerFinding: DEDUCTIONS.HIGH,
      totalPoints: highCount * DEDUCTIONS.HIGH,
      description: `${highCount} High severity issue(s) (-${highCount * DEDUCTIONS.HIGH} pts)`,
    });
  }

  if (mediumCount > 0) {
    deductions.push({
      severity: 'MEDIUM',
      count: mediumCount,
      deductionPerFinding: DEDUCTIONS.MEDIUM,
      totalPoints: mediumCount * DEDUCTIONS.MEDIUM,
      description: `${mediumCount} Medium severity issue(s) (-${mediumCount * DEDUCTIONS.MEDIUM} pts)`,
    });
  }

  if (lowCount > 0) {
    deductions.push({
      severity: 'LOW',
      count: lowCount,
      deductionPerFinding: DEDUCTIONS.LOW,
      totalPoints: lowCount * DEDUCTIONS.LOW,
      description: `${lowCount} Low severity issue(s) (-${lowCount * DEDUCTIONS.LOW} pts)`,
    });
  }

  const totalDeductions = deductions.reduce((sum, d) => sum + d.totalPoints, 0);
  const rawScore = 100 - totalDeductions;
  const score = Math.max(0, Math.min(100, rawScore));

  let grade: ScoreDetails['grade'];
  if (score >= 90) {
    grade = 'Excellent';
  } else if (score >= 75) {
    grade = 'Good';
  } else if (score >= 50) {
    grade = 'Moderate';
  } else if (score >= 25) {
    grade = 'Poor';
  } else {
    grade = 'Critical';
  }

  const summary =
    deductions.length === 0
      ? 'No security deductions applied. All evaluated controls met standard requirements.'
      : `Score reduced by ${totalDeductions} point(s) based on ${findings.length} finding(s).`;

  const explanation: ScoreExplanation = {
    baseScore: 100,
    totalDeductions,
    deductions,
    summary,
  };

  return {
    score,
    grade,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    totalFindings: findings.length,
    explanation,
  };
}

/**
 * Deduplicates findings based on deterministic composite fingerprint.
 */
export function deduplicateFindings(findings: FindingInput[]): FindingInput[] {
  const seen = new Set<string>();
  const unique: FindingInput[] = [];

  for (const f of findings) {
    const fingerprint = generateFindingFingerprint(f);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(f);
    }
  }

  return unique;
}
