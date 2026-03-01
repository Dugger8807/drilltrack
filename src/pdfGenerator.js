// ─── PDF Generation using jsPDF ──────────────────────────────────────
// Generates branded PDFs for daily reports and work orders

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { TE_LOGO } from './logo.js';

// ─── Color palette ───────────────────────────────────────────────────
const C = {
  accent: [244, 165, 58],
  dark: [15, 17, 23],
  text: [30, 30, 30],
  muted: [120, 120, 130],
  light: [245, 245, 248],
  white: [255, 255, 255],
  success: [74, 222, 128],
  danger: [239, 68, 68],
  info: [96, 165, 250],
  headerBg: [25, 28, 38],
};

// ─── Helper: draw header on each page ────────────────────────────────
function drawHeader(doc, title, subtitle) {
  const w = doc.internal.pageSize.getWidth();
  // Header bar
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, w, 30, 'F');
  // Accent stripe
  doc.setFillColor(...C.accent);
  doc.rect(0, 30, w, 2, 'F');
  // TE Logo
  try { doc.addImage(TE_LOGO, 'PNG', 10, 4, 42, 22); } catch(e) {}
  // DrillTrack text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text('DRILLTRACK', 56, 13);
  doc.setFontSize(5.5);
  doc.setTextColor(...C.accent);
  doc.text('GEOTECHNICAL FIELD OPERATIONS', 56, 19);
  // Title
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(title, w - 14, 13, { align: 'right' });
  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 190);
    doc.text(subtitle, w - 14, 19, { align: 'right' });
  }
  // Date generated
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 160);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, w - 14, 25, { align: 'right' });
}

// ─── Helper: draw footer on each page ────────────────────────────────
function drawFooter(doc, pageNum, totalPages) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 210);
  doc.line(14, h - 14, w - 14, h - 14);
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('DrillTrack — Geotechnical Operations Management', 14, h - 8);
  doc.text(`Page ${pageNum} of ${totalPages}`, w - 14, h - 8, { align: 'right' });
}

// ─── Helper: section title ───────────────────────────────────────────
function sectionTitle(doc, y, title) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.light);
  doc.rect(14, y - 4, w - 28, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.accent);
  doc.text(title.toUpperCase(), 16, y + 3);
  return y + 12;
}

// ─── Helper: info row ────────────────────────────────────────────────
function infoRow(doc, y, label, value) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(label + ':', 16, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text(String(value || '—'), 60, y);
  return y + 6;
}

// ─── Helper: two-column info ─────────────────────────────────────────
function infoRow2(doc, y, label1, val1, label2, val2) {
  const mid = doc.internal.pageSize.getWidth() / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(label1 + ':', 16, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text(String(val1 || '—'), 60, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text(label2 + ':', mid + 6, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.text);
  doc.text(String(val2 || '—'), mid + 50, y);
  return y + 6;
}

// ─── Check if we need a new page ─────────────────────────────────────
function checkPage(doc, y, needed = 30) {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 20) {
    doc.addPage();
    drawHeader(doc, '', '');
    return 40;
  }
  return y;
}

// =====================================================================
// DAILY REPORT PDF
// =====================================================================
export async function generateDailyReportPDF(report) {
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const w = doc.internal.pageSize.getWidth();

  drawHeader(doc, 'DAILY DRILLER REPORT', report.reportNumber);

  let y = 40;

  // ── Report info ──
  y = sectionTitle(doc, y, 'Report Information');
  y = infoRow2(doc, y, 'Report #', report.reportNumber, 'Date', report.date);
  y = infoRow2(doc, y, 'Work Order', report.workOrderName, 'Project', report.projectName);
  y = infoRow2(doc, y, 'Rig', `${report.rigName} ${report.rigType ? `(${report.rigType})` : ''}`, 'Crew', report.crewName);
  y = infoRow2(doc, y, 'Driller', report.driller, 'Hours', `${report.startTime || ''} – ${report.endTime || ''}`);
  y = infoRow2(doc, y, 'Weather', report.weatherConditions, 'Status', (report.status || '').toUpperCase());
  y += 4;

  // ── Production ──
  if (report.production?.length > 0) {
    y = checkPage(doc, y, 20 + report.production.length * 8);
    y = sectionTitle(doc, y, `Production (${report.production.length} entries)`);

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: C.headerBg, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columns: [
        { header: 'Boring', dataKey: 'boring' },
        { header: 'Type', dataKey: 'type' },
        { header: 'From (ft)', dataKey: 'from' },
        { header: 'To (ft)', dataKey: 'to' },
        { header: 'Footage', dataKey: 'footage' },
        { header: 'Notes', dataKey: 'notes' },
      ],
      body: report.production.map(p => ({
        boring: p.boringLabel || '—',
        type: p.typeName || '',
        from: p.startDepth || 0,
        to: p.endDepth || 0,
        footage: p.footage || 0,
        notes: p.description || '',
      })),
    });

    y = doc.lastAutoTable.finalY + 4;
    const totalFt = report.production.reduce((s, p) => s + (p.footage || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(`Total Footage: ${totalFt} ft`, w - 14, y, { align: 'right' });
    y += 8;
  }

  // ── Billing ──
  if (report.billing?.length > 0) {
    y = checkPage(doc, y, 20 + report.billing.length * 8);
    y = sectionTitle(doc, y, 'Billing');

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: C.headerBg, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        rate: { halign: 'right' },
        total: { halign: 'right', fontStyle: 'bold' },
      },
      columns: [
        { header: 'Item', dataKey: 'item' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Rate', dataKey: 'rate' },
        { header: 'Total', dataKey: 'total' },
        { header: 'Notes', dataKey: 'notes' },
      ],
      body: report.billing.map(b => ({
        item: b.unitName || '—',
        qty: b.quantity,
        rate: `$${Number(b.rate).toFixed(2)}`,
        total: `$${(b.total || b.quantity * b.rate || 0).toFixed(2)}`,
        notes: b.notes || '',
      })),
    });

    y = doc.lastAutoTable.finalY + 4;
    const totalBill = report.billing.reduce((s, b) => s + (b.total || b.quantity * b.rate || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.accent);
    doc.text(`Total: $${totalBill.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, w - 14, y, { align: 'right' });
    y += 8;
  }

  // ── Other Activities ──
  if (report.activities?.length > 0) {
    y = checkPage(doc, y, 20 + report.activities.length * 8);
    y = sectionTitle(doc, y, 'Other Activities');
    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: C.accent, textColor: [15, 17, 23], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [200, 200, 200], fillColor: [24, 27, 36] },
      alternateRowStyles: { fillColor: [30, 34, 44] },
      columns: [
        { header: 'Activity', dataKey: 'type' },
        { header: 'Hours', dataKey: 'hours' },
        { header: 'Details', dataKey: 'desc' },
      ],
      body: report.activities.map(a => ({
        type: a.activity_type || a.activityType || '',
        hours: a.hours || 0,
        desc: a.description || '',
      })),
    });
    y = doc.lastAutoTable.finalY + 4;
    const totalHrs = report.activities.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.accent);
    doc.text(`Total Hours: ${totalHrs}`, w - 14, y, { align: 'right' });
    y += 8;
  }

  // ── Equipment / Safety / Notes ──
  y = checkPage(doc, y, 30);
  y = sectionTitle(doc, y, 'Additional Information');
  y = infoRow(doc, y, 'Equipment Issues', report.equipmentIssues || 'None');
  y = infoRow(doc, y, 'Safety Incidents', report.safetyIncidents || 'None');
  if (report.notes) y = infoRow(doc, y, 'Notes', report.notes);
  y += 4;

  // ── Approval status ──
  if (report.status === 'approved' || report.status === 'rejected') {
    y = checkPage(doc, y, 20);
    y = sectionTitle(doc, y, 'Review');
    const statusColor = report.status === 'approved' ? C.success : C.danger;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...statusColor);
    doc.text(report.status.toUpperCase(), 16, y + 1);
    if (report.reviewNotes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(report.reviewNotes, 50, y + 1);
    }
  }

  // ── Add footers ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  return doc;
}

// =====================================================================
// WORK ORDER PDF
// =====================================================================
export async function generateWorkOrderPDF(wo) {
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const w = doc.internal.pageSize.getWidth();

  drawHeader(doc, 'WORK ORDER', wo.woNumber);

  let y = 40;

  // ── WO info ──
  y = sectionTitle(doc, y, 'Work Order Details');
  y = infoRow2(doc, y, 'WO Number', wo.woNumber, 'Status', (wo.status || '').replace('_', ' ').toUpperCase());
  y = infoRow2(doc, y, 'Project', wo.projectName, 'Project #', wo.projectNumber);
  y = infoRow2(doc, y, 'Client', wo.client, 'Priority', (wo.priority || '').toUpperCase());
  y = infoRow2(doc, y, 'Name', wo.name, 'Location', wo.siteAddress || wo.location || '—');
  y = infoRow2(doc, y, 'Requested By', wo.requestedBy || '—', 'Engineer / Rep', wo.engineerRep || '—');
  y = infoRow2(doc, y, 'Rig', wo.rigName || '—', 'Crew', wo.crewName || '—');
  y = infoRow2(doc, y, 'Requested Dates', wo.requestedStart ? `${wo.requestedStart} → ${wo.requestedEnd || 'TBD'}` : '—', 'Scheduled Dates', wo.startDate ? `${wo.startDate} → ${wo.endDate || 'TBD'}` : 'TBD');
  y = infoRow2(doc, y, 'Actual Dates', wo.actualStart ? `${wo.actualStart} → ${wo.actualEnd || 'ongoing'}` : '—', 'Estimated Cost', wo.estimatedCost ? `$${Number(wo.estimatedCost).toLocaleString()}` : '—');
  if (wo.onecallNumber) y = infoRow2(doc, y, 'One-Call #', wo.onecallNumber, 'One-Call Date', wo.onecallDate || '—');
  y += 2;

  // ── Scope ──
  if (wo.scope) {
    y = checkPage(doc, y, 20);
    y = sectionTitle(doc, y, 'Scope of Work');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(wo.scope, w - 32);
    doc.text(lines, 16, y);
    y += lines.length * 4 + 6;
  }

  // ── Boring Schedule ──
  if (wo.borings?.length > 0) {
    y = checkPage(doc, y, 20 + wo.borings.length * 8);
    y = sectionTitle(doc, y, `Boring Schedule (${wo.borings.length} borings)`);

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: C.headerBg, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columns: [
        { header: 'Boring ID', dataKey: 'id' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Planned Depth (ft)', dataKey: 'depth' },
        { header: 'Status', dataKey: 'status' },
      ],
      body: wo.borings.map(b => ({
        id: b.boringLabel,
        type: b.type,
        depth: b.plannedDepth,
        status: (b.status || '').replace('_', ' ').toUpperCase(),
      })),
    });

    y = doc.lastAutoTable.finalY + 4;
    const totalDepth = wo.borings.reduce((s, b) => s + (Number(b.plannedDepth) || 0), 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(`Total Planned Footage: ${totalDepth} ft`, w - 14, y, { align: 'right' });
    y += 8;
  }

  // ── Rate Schedule ──
  if (wo.rateSchedule?.length > 0) {
    y = checkPage(doc, y, 20 + wo.rateSchedule.length * 8);
    y = sectionTitle(doc, y, 'Rate Schedule');

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: C.headerBg, textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        rate: { halign: 'right', fontStyle: 'bold' },
        estTotal: { halign: 'right' },
      },
      columns: [
        { header: 'Billing Item', dataKey: 'item' },
        { header: 'Rate', dataKey: 'rate' },
        { header: 'Unit', dataKey: 'unit' },
        { header: 'Est. Qty', dataKey: 'qty' },
        { header: 'Est. Total', dataKey: 'estTotal' },
      ],
      body: wo.rateSchedule.map(r => ({
        item: r.unitName,
        rate: `$${Number(r.rate).toFixed(2)}`,
        unit: r.unitLabel,
        qty: r.estimatedQty || '—',
        estTotal: r.estimatedQty ? `$${(r.rate * r.estimatedQty).toFixed(2)}` : '—',
      })),
    });

    y = doc.lastAutoTable.finalY + 4;
  }

  // ── Other Field Activities ──
  if (wo.woActivities?.length > 0) {
    y = checkPage(doc, y, 20 + wo.woActivities.length * 8);
    y = sectionTitle(doc, y, `Other Field Activities (${wo.woActivities.length})`);

    doc.autoTable({
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [107, 78, 191], textColor: C.white, fontSize: 8, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: C.text, cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columns: [
        { header: 'Activity', dataKey: 'type' },
        { header: 'Qty', dataKey: 'qty' },
        { header: 'Depth', dataKey: 'depth' },
        { header: 'Size', dataKey: 'size' },
        { header: 'Method', dataKey: 'method' },
        { header: 'Notes', dataKey: 'notes' },
      ],
      body: wo.woActivities.map(a => ({
        type: a.activity_type || '',
        qty: a.quantity || 1,
        depth: a.depth ? `${a.depth} ft` : '—',
        size: a.size || '—',
        method: a.method ? a.method.replace(/_/g, ' ') : '—',
        notes: a.notes || '',
      })),
    });

    y = doc.lastAutoTable.finalY + 4;
  }

  // ── Footers ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  return doc;
}

// ─── Download helper ─────────────────────────────────────────────────
export async function downloadDailyReportPDF(report) {
  const doc = await generateDailyReportPDF(report);
  const filename = `DR-${report.reportNumber || report.date}-${(report.projectName || 'report').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}

export async function downloadWorkOrderPDF(wo) {
  const doc = await generateWorkOrderPDF(wo);
  const filename = `WO-${wo.woNumber || 'order'}-${(wo.projectName || wo.name || '').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
}
