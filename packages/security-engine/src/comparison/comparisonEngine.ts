import {
  ComparisonFinding,
  FindingInput,
  ScanComparisonResult,
} from '../types';
import { generateFindingFingerprint } from '../scoring/scoringEngine';

export interface CompareScansInput {
  previousScanId: string;
  currentScanId: string;
  previousScore: number | null;
  currentScore: number | null;
  previousFindings: FindingInput[];
  currentFindings: FindingInput[];
}

/**
 * Compares two security scans using deterministic finding fingerprints.
 * Identifies NEW, RESOLVED, PERSISTENT, and CHANGED security findings.
 */
export function compareScans(input: CompareScansInput): ScanComparisonResult {
  const previousMap = new Map<string, FindingInput>();
  for (const f of input.previousFindings) {
    const fp = generateFindingFingerprint(f);
    previousMap.set(fp, f);
  }

  const currentMap = new Map<string, FindingInput>();
  for (const f of input.currentFindings) {
    const fp = generateFindingFingerprint(f);
    currentMap.set(fp, f);
  }

  const comparisonFindings: ComparisonFinding[] = [];
  let newCount = 0;
  let resolvedCount = 0;
  let persistentCount = 0;
  let changedCount = 0;

  // 1. Process current findings (NEW, PERSISTENT, or CHANGED)
  for (const [fp, currentFinding] of currentMap.entries()) {
    const prevFinding = previousMap.get(fp);

    if (!prevFinding) {
      // Finding is NEW
      newCount++;
      comparisonFindings.push({
        ...currentFinding,
        fingerprint: fp,
        status: 'NEW',
      });
    } else {
      // Finding was in previous scan
      const severityChanged = prevFinding.severity !== currentFinding.severity;
      const confidenceChanged = prevFinding.confidence !== currentFinding.confidence;

      if (severityChanged || confidenceChanged) {
        changedCount++;
        comparisonFindings.push({
          ...currentFinding,
          fingerprint: fp,
          status: 'CHANGED',
          previousSeverity: prevFinding.severity,
          previousConfidence: prevFinding.confidence,
        });
      } else {
        persistentCount++;
        comparisonFindings.push({
          ...currentFinding,
          fingerprint: fp,
          status: 'PERSISTENT',
        });
      }
    }
  }

  // 2. Process previous findings to find RESOLVED issues
  for (const [fp, prevFinding] of previousMap.entries()) {
    if (!currentMap.has(fp)) {
      resolvedCount++;
      comparisonFindings.push({
        ...prevFinding,
        fingerprint: fp,
        status: 'RESOLVED',
      });
    }
  }

  const prevScoreVal = input.previousScore ?? 0;
  const currScoreVal = input.currentScore ?? 0;
  const scoreDifference = currScoreVal - prevScoreVal;

  return {
    previousScanId: input.previousScanId,
    currentScanId: input.currentScanId,
    previousScore: input.previousScore,
    currentScore: input.currentScore,
    scoreDifference,
    previousTotalFindings: input.previousFindings.length,
    currentTotalFindings: input.currentFindings.length,
    newCount,
    resolvedCount,
    persistentCount,
    changedCount,
    findings: comparisonFindings,
  };
}
