import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { ReportData, ReportFinding } from './reportDataBuilder';

const SEVERITY_COLORS: Record<ReportFinding['severity'], { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
  HIGH: { bg: '#FFEDD5', text: '#9A3412', border: '#EA580C' },
  MEDIUM: { bg: '#FEF9C3', text: '#854D0E', border: '#CA8A04' },
  LOW: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  INFO: { bg: '#F1F5F9', text: '#475569', border: '#94A3B8' },
};

/**
 * Generates a streamable PDF report from structured ReportData.
 */
export function generatePdfReport(reportData: ReportData, outputStream: Writable): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `WebShield Security Report — ${reportData.target.hostname}`,
          Author: 'WebShield Security Platform',
          Subject: 'Automated Web Security Assessment',
          Keywords: 'security, assessment, headers, tls, ssrf, vulnerability, report',
        },
      });

      doc.on('error', err => reject(err));
      outputStream.on('finish', () => resolve());
      outputStream.on('error', err => reject(err));

      doc.pipe(outputStream);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // ─────────────────────────────────────────────────────────────
      // 1. COVER PAGE
      // ─────────────────────────────────────────────────────────────

      // Top Header Accent Bar
      doc.rect(0, 0, pageWidth, 12).fill('#0F172A');
      doc.rect(0, 12, pageWidth, 4).fill('#10B981');

      doc.y = 80;

      // Brand Logo / Header
      doc.rect(margin, doc.y, 42, 42).fill('#0F172A');
      doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-Bold').text('W', margin + 11, doc.y - 34);

      doc.fontSize(26).fillColor('#0F172A').font('Helvetica-Bold').text('WebShield', margin + 52, doc.y - 37);
      doc.fontSize(10).fillColor('#10B981').font('Helvetica-Bold').text('SECURITY ASSESSMENT PLATFORM', margin + 54, doc.y + 4);

      doc.moveDown(4);

      // Report Title
      doc.fontSize(28).fillColor('#0F172A').font('Helvetica-Bold').text('Security Assessment', { align: 'left' });
      doc.fontSize(28).fillColor('#0369A1').font('Helvetica-Bold').text('Executive Report', { align: 'left' });

      doc.moveDown(1);
      doc.rect(margin, doc.y, 60, 3).fill('#10B981');
      doc.moveDown(1.5);

      // Target Information Card
      const targetCardY = doc.y;
      doc.roundedRect(margin, targetCardY, contentWidth, 120, 8).fillAndStroke('#F8FAFC', '#E2E8F0');

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748B').text('ASSESSED TARGET', margin + 18, targetCardY + 16);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text(reportData.target.hostname, margin + 18, targetCardY + 32);
      doc.fontSize(10).font('Helvetica').fillColor('#475569').text(reportData.target.url, margin + 18, targetCardY + 54);

      doc.fontSize(9).font('Helvetica').fillColor('#64748B').text(`Assessment Date: ${reportData.generatedAt}`, margin + 18, targetCardY + 76);
      doc.fontSize(9).font('Helvetica').fillColor('#64748B').text(`Scan ID: ${reportData.scan.id}`, margin + 18, targetCardY + 92);

      doc.y = targetCardY + 140;

      // Overall Score Box
      const scoreBoxY = doc.y;
      doc.roundedRect(margin, scoreBoxY, contentWidth, 110, 8).fillAndStroke('#0F172A', '#1E293B');

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#94A3B8').text('OVERALL SECURITY POSTURE SCORE', margin + 20, scoreBoxY + 18);
      
      const scoreColor = reportData.executiveSummary.securityScore >= 75 ? '#10B981' : reportData.executiveSummary.securityScore >= 50 ? '#F59E0B' : '#EF4444';
      doc.fontSize(38).font('Helvetica-Bold').fillColor(scoreColor).text(`${reportData.executiveSummary.securityScore}`, margin + 20, scoreBoxY + 36);
      doc.fontSize(16).font('Helvetica').fillColor('#94A3B8').text('/ 100', margin + 95, scoreBoxY + 52);

      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF').text(reportData.executiveSummary.grade, margin + 220, scoreBoxY + 40);
      doc.fontSize(10).font('Helvetica').fillColor('#94A3B8').text(`${reportData.executiveSummary.totalFindings} total findings evaluated`, margin + 220, scoreBoxY + 60);

      doc.y = scoreBoxY + 140;

      // Classification Notice
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748B').text('CLASSIFICATION:', margin, pageHeight - 90);
      doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(reportData.classification, margin + 100, pageHeight - 90);

      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text('Prepared by WebShield Automated Security Engine. Non-destructive assessment.', margin, pageHeight - 65);

      // ─────────────────────────────────────────────────────────────
      // 2. EXECUTIVE SUMMARY & POSTURE
      // ─────────────────────────────────────────────────────────────
      doc.addPage();
      renderSectionHeader(doc, margin, '1. Executive Summary', contentWidth);

      doc.fontSize(10).font('Helvetica').fillColor('#334155').text(reportData.executiveSummary.overview, {
        lineGap: 4,
        align: 'justify',
      });
      doc.moveDown(1);

      // Findings Summary Counter Cards
      const countsY = doc.y;
      const cardWidth = (contentWidth - 24) / 5;

      const countsList: Array<{ label: string; count: number; sev: ReportFinding['severity'] }> = [
        { label: 'Critical', count: reportData.executiveSummary.criticalCount, sev: 'CRITICAL' },
        { label: 'High', count: reportData.executiveSummary.highCount, sev: 'HIGH' },
        { label: 'Medium', count: reportData.executiveSummary.mediumCount, sev: 'MEDIUM' },
        { label: 'Low', count: reportData.executiveSummary.lowCount, sev: 'LOW' },
        { label: 'Info', count: reportData.executiveSummary.infoCount, sev: 'INFO' },
      ];

      countsList.forEach((item, i) => {
        const x = margin + i * (cardWidth + 6);
        const style = SEVERITY_COLORS[item.sev];
        doc.roundedRect(x, countsY, cardWidth, 54, 6).fillAndStroke(style.bg, style.border);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(style.text).text(item.label.toUpperCase(), x, countsY + 10, { width: cardWidth, align: 'center' });
        doc.fontSize(18).font('Helvetica-Bold').fillColor(style.text).text(String(item.count), x, countsY + 24, { width: cardWidth, align: 'center' });
      });

      doc.y = countsY + 70;

      // Key Observations
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Key Assessment Observations:');
      doc.moveDown(0.5);

      reportData.executiveSummary.postureObservations.forEach(obs => {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0369A1').text('• ', margin + 8, doc.y, { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(obs, { lineGap: 3 });
      });

      doc.moveDown(1.5);

      // ─────────────────────────────────────────────────────────────
      // 3. SECURITY SCORE BREAKDOWN & METRICS
      // ─────────────────────────────────────────────────────────────
      renderSectionHeader(doc, margin, '2. Security Score Breakdown', contentWidth);

      doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(
        'WebShield scores targets on a scale from 0 to 100 starting from a base baseline of 100 points, subtracting bounded deductions weighted by severity and confidence.',
        { lineGap: 3 }
      );
      doc.moveDown(1);

      // Score Metrics Table
      const tableY = doc.y;
      const colWidths = [180, 100, 100, 135];

      // Table Header
      doc.rect(margin, tableY, contentWidth, 22).fill('#0F172A');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('Severity Level', margin + 10, tableY + 6);
      doc.text('Point Deduction', margin + colWidths[0], tableY + 6);
      doc.text('Detected Count', margin + colWidths[0] + colWidths[1], tableY + 6);
      doc.text('Category Cap', margin + colWidths[0] + colWidths[1] + colWidths[2], tableY + 6);

      let rowY = tableY + 22;
      const deductionRows = [
        { label: 'Critical Severity', deduction: '-25 pts / finding', count: reportData.executiveSummary.criticalCount, cap: 'No limit (Uncapped)' },
        { label: 'High Severity', deduction: '-15 pts / finding', count: reportData.executiveSummary.highCount, cap: 'Max -60 pts' },
        { label: 'Medium Severity', deduction: '-8 pts / finding', count: reportData.executiveSummary.mediumCount, cap: 'Max -35 pts' },
        { label: 'Low Severity', deduction: '-3 pts / finding', count: reportData.executiveSummary.lowCount, cap: 'Max -15 pts' },
        { label: 'Informational', deduction: '0 pts', count: reportData.executiveSummary.infoCount, cap: 'N/A' },
      ];

      deductionRows.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(margin, rowY, contentWidth, 20).fillAndStroke(bg, '#E2E8F0');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(r.label, margin + 10, rowY + 5);
        doc.font('Helvetica').fillColor('#475569').text(r.deduction, margin + colWidths[0], rowY + 5);
        doc.font('Helvetica-Bold').fillColor('#0F172A').text(String(r.count), margin + colWidths[0] + colWidths[1], rowY + 5);
        doc.font('Helvetica').fillColor('#64748B').text(r.cap, margin + colWidths[0] + colWidths[1] + colWidths[2], rowY + 5);
        rowY += 20;
      });

      doc.y = rowY + 20;

      // ─────────────────────────────────────────────────────────────
      // 4. DETAILED FINDINGS
      // ─────────────────────────────────────────────────────────────
      doc.addPage();
      renderSectionHeader(doc, margin, '3. Detailed Findings & Remediation', contentWidth);

      if (reportData.findings.length === 0) {
        doc.roundedRect(margin, doc.y, contentWidth, 60, 6).fillAndStroke('#F0FDF4', '#86EFAC');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#166534').text('No Security Deficiencies Identified', margin + 20, doc.y + 16);
        doc.fontSize(9).font('Helvetica').fillColor('#15803D').text('All automated checks completed without discovering misconfigurations or missing defensive headers.', margin + 20, doc.y + 34);
        doc.moveDown(3);
      } else {
        reportData.findings.forEach(finding => {
          checkPageSpace(doc, 160);

          const findingBoxY = doc.y;
          const sevStyle = SEVERITY_COLORS[finding.severity];

          // Finding Header Bar
          doc.roundedRect(margin, findingBoxY, contentWidth, 26, 4).fillAndStroke(sevStyle.bg, sevStyle.border);
          doc.fontSize(9).font('Helvetica-Bold').fillColor(sevStyle.text).text(`[${finding.severity}]`, margin + 10, findingBoxY + 8);
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(finding.title, margin + 80, findingBoxY + 8, { width: contentWidth - 190, ellipsis: true });
          doc.fontSize(8.5).font('Helvetica').fillColor('#64748B').text(`Category: ${finding.category}`, margin + contentWidth - 100, findingBoxY + 8, { align: 'right' });

          doc.y = findingBoxY + 34;

          // Finding Metadata Row
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569').text('Confidence: ', margin, doc.y, { continued: true });
          doc.font('Helvetica').fillColor('#0F172A').text(finding.confidence, { continued: true });

          if (finding.affectedComponent) {
            doc.font('Helvetica-Bold').fillColor('#475569').text('    Component: ', { continued: true });
            doc.font('Courier').fillColor('#0369A1').text(finding.affectedComponent);
          } else {
            doc.text('');
          }

          doc.moveDown(0.5);

          // Description
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Description:');
          doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(finding.description, { lineGap: 2 });
          doc.moveDown(0.5);

          // Evidence Box (if present)
          if (finding.evidence) {
            checkPageSpace(doc, 60);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Observed Evidence:');
            const evY = doc.y + 2;
            doc.roundedRect(margin, evY, contentWidth, 34, 4).fillAndStroke('#F1F5F9', '#CBD5E1');
            doc.fontSize(8).font('Courier').fillColor('#0F172A').text(finding.evidence, margin + 8, evY + 6, { width: contentWidth - 16, lineBreak: true });
            doc.y = evY + 40;
          }

          // Remediation Box
          if (finding.remediation) {
            checkPageSpace(doc, 60);
            const remY = doc.y;
            doc.roundedRect(margin, remY, contentWidth, 38, 4).fillAndStroke('#ECFDF5', '#A7F3D0');
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#065F46').text('RECOMMENDED REMEDIATION:', margin + 8, remY + 6);
            doc.fontSize(8).font('Helvetica').fillColor('#047857').text(finding.remediation, margin + 8, remY + 18, { width: contentWidth - 16 });
            doc.y = remY + 46;
          }

          // Reference link (if present)
          if (finding.reference) {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('Reference: ', margin, doc.y, { continued: true });
            doc.font('Helvetica').fillColor('#0284C7').text(finding.reference, {
              link: finding.reference.startsWith('http') ? finding.reference : undefined,
              underline: true,
            });
            doc.moveDown(0.5);
          }

          doc.moveDown(1);
        });
      }

      // ─────────────────────────────────────────────────────────────
      // 5. SECURITY IMPROVEMENT / COMPARISON
      // ─────────────────────────────────────────────────────────────
      if (reportData.comparison) {
        checkPageSpace(doc, 140);
        renderSectionHeader(doc, margin, '4. Security Improvement & Posture Evolution', contentWidth);

        const comp = reportData.comparison;
        const compBoxY = doc.y;
        doc.roundedRect(margin, compBoxY, contentWidth, 75, 6).fillAndStroke('#F8FAFC', '#E2E8F0');

        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0F172A').text('Comparative Posture Analysis:', margin + 14, compBoxY + 12);
        
        const deltaStr = comp.scoreDifference > 0 ? `+${comp.scoreDifference}` : String(comp.scoreDifference);
        const deltaColor = comp.scoreDifference > 0 ? '#10B981' : comp.scoreDifference < 0 ? '#EF4444' : '#64748B';

        doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`Baseline Score: ${comp.previousScore ?? 0}    →    Current Score: ${comp.currentScore ?? 0}    (Delta: `, margin + 14, compBoxY + 30, { continued: true });
        doc.font('Helvetica-Bold').fillColor(deltaColor).text(deltaStr, { continued: true });
        doc.font('Helvetica').fillColor('#475569').text(')');

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#10B981').text(`✓ Resolved: ${comp.resolvedCount}`, margin + 14, compBoxY + 50);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#EF4444').text(`+ New: ${comp.newCount}`, margin + 140, compBoxY + 50);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#64748B').text(`= Persistent: ${comp.persistentCount}`, margin + 240, compBoxY + 50);
        if (comp.changedCount > 0) {
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#3B82F6').text(`~ Changed: ${comp.changedCount}`, margin + 360, compBoxY + 50);
        }

        doc.y = compBoxY + 90;
      }

      // ─────────────────────────────────────────────────────────────
      // 6. METHODOLOGY & SAFETY CONTROLS
      // ─────────────────────────────────────────────────────────────
      checkPageSpace(doc, 200);
      renderSectionHeader(doc, margin, `${reportData.comparison ? '5' : '4'}. Assessment Methodology & Safety`, contentWidth);

      doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
        'WebShield executes controlled, non-destructive automated checks against target endpoints. The following active scanner modules were evaluated during this assessment session:',
        { lineGap: 3 }
      );
      doc.moveDown(0.8);

      reportData.methodology.scanners.forEach(s => {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0F172A').text(`• ${s.name} [${s.category}]: `, margin + 8, doc.y, { continued: true });
        doc.font('Helvetica').fillColor('#475569').text(s.description, { lineGap: 2 });
      });

      doc.moveDown(0.8);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text('Safety & SSRF Controls:');
      reportData.methodology.safetyControls.forEach(ctrl => {
        doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`- ${ctrl}`, margin + 8, doc.y, { lineGap: 2 });
      });

      doc.moveDown(1.5);

      // ─────────────────────────────────────────────────────────────
      // 7. LIMITATIONS & SCOPE NOTICE
      // ─────────────────────────────────────────────────────────────
      checkPageSpace(doc, 140);
      renderSectionHeader(doc, margin, `${reportData.comparison ? '6' : '5'}. Limitations & Legal Scope`, contentWidth);

      reportData.limitations.forEach(lim => {
        doc.fontSize(8.5).font('Helvetica').fillColor('#475569').text(`• ${lim}`, margin + 8, doc.y, { lineGap: 3 });
      });

      doc.moveDown(1);

      // ─────────────────────────────────────────────────────────────
      // 8. CONCLUSION
      // ─────────────────────────────────────────────────────────────
      checkPageSpace(doc, 120);
      renderSectionHeader(doc, margin, `${reportData.comparison ? '7' : '6'}. Conclusion & Recommendations`, contentWidth);

      doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(reportData.conclusion, {
        lineGap: 3,
        align: 'justify',
      });

      // ─────────────────────────────────────────────────────────────
      // 9. HEADERS & FOOTERS (Apply to all pages after Cover Page)
      // ─────────────────────────────────────────────────────────────
      const totalPages = doc.bufferedPageRange().count;

      for (let i = 1; i < totalPages; i++) {
        doc.switchToPage(i);

        // Header
        doc.rect(margin, 20, contentWidth, 0.5).fill('#CBD5E1');
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text('WebShield Security Assessment Report', margin, 10);
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(reportData.target.hostname, margin, 10, { align: 'right' });

        // Footer
        doc.rect(margin, pageHeight - 30, contentWidth, 0.5).fill('#CBD5E1');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#DC2626').text('CONFIDENTIAL', margin, pageHeight - 22);
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748B').text(`Page ${i + 1} of ${totalPages}`, margin, pageHeight - 22, { align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderSectionHeader(doc: InstanceType<typeof PDFDocument>, margin: number, title: string, contentWidth: number) {
  doc.rect(margin, doc.y, contentWidth, 20).fill('#0F172A');
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF').text(title, margin + 8, doc.y - 15);
  doc.moveDown(1);
}

function checkPageSpace(doc: InstanceType<typeof PDFDocument>, requiredHeight: number) {
  if (doc.y + requiredHeight > 780) {
    doc.addPage();
  }
}
