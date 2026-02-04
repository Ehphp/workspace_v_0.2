/**
 * PDF Generator using jsPDF and jspdf-autotable
 * Creates professional PDF documents for estimations
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
    ExportableEstimation,
    ExportOptions,
    ExportResult,
    ACTIVITY_GROUP_LABELS,
    PRIORITY_LABELS,
    STATE_LABELS
} from '@/types/export';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Syntero brand colors
const COLORS = {
    primary: [59, 130, 246] as [number, number, number],      // blue-500
    primaryDark: [37, 99, 235] as [number, number, number],   // blue-600
    secondary: [99, 102, 241] as [number, number, number],    // indigo-500
    success: [16, 185, 129] as [number, number, number],      // emerald-500
    text: [15, 23, 42] as [number, number, number],           // slate-900
    textMuted: [100, 116, 139] as [number, number, number],   // slate-500
    border: [226, 232, 240] as [number, number, number],      // slate-200
    background: [248, 250, 252] as [number, number, number],  // slate-50
    white: [255, 255, 255] as [number, number, number],
};

const FONTS = {
    normal: 'helvetica',
    bold: 'helvetica',
};

interface PDFGeneratorOptions extends ExportOptions {
    estimation: ExportableEstimation;
}

/**
 * Generate a professional PDF document for an estimation
 */
export async function generatePDF(options: PDFGeneratorOptions): Promise<ExportResult> {
    try {
        const { estimation } = options;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // === HEADER ===
        yPosition = drawHeader(doc, estimation, pageWidth, margin, yPosition);

        // === REQUIREMENT SUMMARY ===
        if (options.includeDescription) {
            yPosition = drawRequirementSummary(doc, estimation, pageWidth, margin, yPosition);
        }

        // === ESTIMATION BREAKDOWN ===
        yPosition = drawEstimationBreakdown(doc, estimation, pageWidth, margin, yPosition);

        // === ACTIVITIES TABLE ===
        if (options.includeActivities && estimation.activities.length > 0) {
            yPosition = drawActivitiesTable(doc, estimation, pageWidth, margin, yPosition);
        }

        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = margin;
        }

        // === DRIVERS ===
        if (options.includeDrivers && estimation.drivers.length > 0) {
            yPosition = drawDriversSection(doc, estimation, pageWidth, margin, yPosition);
        }

        // === RISKS ===
        if (options.includeRisks && estimation.risks.length > 0) {
            yPosition = drawRisksSection(doc, estimation, pageWidth, margin, yPosition);
        }

        // === AI REASONING ===
        if (options.includeAiReasoning && estimation.aiReasoning) {
            yPosition = drawAiReasoningSection(doc, estimation, pageWidth, margin, yPosition);
        }

        // === FOOTER ===
        drawFooter(doc, pageWidth, pageHeight, margin);

        // Generate filename
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const reqId = estimation.requirement.reqId || estimation.requirement.id.substring(0, 8);
        const filename = `Stima_${reqId}_${dateStr}.pdf`;

        // Get blob
        const blob = doc.output('blob');

        return {
            success: true,
            filename,
            blob,
        };
    } catch (error) {
        console.error('Error generating PDF:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Unknown error generating PDF',
        };
    }
}

function drawHeader(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    const headerHeight = 25;

    // Blue gradient header background
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, headerHeight + 10, 'F');

    // Syntero logo text (since we don't have the actual logo file)
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text('SYNTERO', margin, 15);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont(FONTS.normal, 'normal');
    doc.text('Estimation Report', margin, 22);

    // Right side - project info
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    const dateGenerated = format(new Date(), "d MMMM yyyy", { locale: it });
    doc.text(`Generato il ${dateGenerated}`, pageWidth - margin, 15, { align: 'right' });

    if (estimation.technology?.name) {
        doc.text(`Tecnologia: ${estimation.technology.name}`, pageWidth - margin, 22, { align: 'right' });
    }

    return headerHeight + 20;
}

function drawRequirementSummary(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    const boxWidth = pageWidth - (margin * 2);

    // Section title
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text('REQUISITO', margin, yPosition);
    yPosition += 6;

    // Box background
    const boxHeight = estimation.requirement.description ? 35 : 20;
    doc.setFillColor(...COLORS.background);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, yPosition, boxWidth, boxHeight, 2, 2, 'FD');

    // Title
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    const title = estimation.requirement.title || 'Senza titolo';
    const titleLines = doc.splitTextToSize(title, boxWidth - 10);
    doc.text(titleLines[0], margin + 5, yPosition + 7);

    // Badges row
    yPosition += 12;
    let xPos = margin + 5;

    // Priority badge
    const priorityLabel = getPriorityLabel(estimation.requirement.priority);
    const priorityColor = getPriorityColor(estimation.requirement.priority);
    drawBadge(doc, priorityLabel, xPos, yPosition, priorityColor);
    xPos += 25;

    // State badge
    const stateLabel = getStateLabel(estimation.requirement.state);
    drawBadge(doc, stateLabel, xPos, yPosition, COLORS.secondary);
    xPos += 30;

    // REQ ID
    if (estimation.requirement.reqId) {
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(`ID: ${estimation.requirement.reqId}`, xPos, yPosition + 3);
    }

    // Description (if included and present)
    if (estimation.requirement.description) {
        yPosition += 10;
        doc.setFont(FONTS.normal, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.textMuted);
        const desc = doc.splitTextToSize(estimation.requirement.description, boxWidth - 10);
        doc.text(desc.slice(0, 2), margin + 5, yPosition + 3); // Max 2 lines
    }

    return yPosition + boxHeight - 5;
}

function drawEstimationBreakdown(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    const boxWidth = pageWidth - (margin * 2);

    // Section title
    yPosition += 10;
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text('STIMA', margin, yPosition);
    yPosition += 6;

    // Main result box with gradient-like effect
    const mainBoxHeight = 45;
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-300
    doc.roundedRect(margin, yPosition, boxWidth, mainBoxHeight, 3, 3, 'FD');

    // Total days - big number
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(32);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text(`${estimation.estimation.totalDays.toFixed(1)}`, margin + 10, yPosition + 22);

    doc.setFontSize(14);
    doc.text('giorni', margin + 45, yPosition + 22);

    // Subtitle
    doc.setFont(FONTS.normal, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61); // green-700
    doc.text('Giorni lavorativi inclusa contingency', margin + 10, yPosition + 30);

    // Visual progress bar
    const barX = margin + 80;
    const barWidth = boxWidth - 90;
    const barY = yPosition + 15;
    const barHeight = 8;

    // Background bar
    doc.setFillColor(...COLORS.border);
    doc.roundedRect(barX, barY, barWidth, barHeight, 2, 2, 'F');

    // Filled bar (proportional to base vs total)
    const baseRatio = estimation.estimation.baseDays / estimation.estimation.totalDays;
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(barX, barY, barWidth * baseRatio, barHeight, 2, 2, 'F');

    // Driver multiplier effect
    const subtotalRatio = estimation.estimation.subtotal / estimation.estimation.totalDays;
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(barX + (barWidth * baseRatio), barY, barWidth * (subtotalRatio - baseRatio), barHeight, 0, 0, 'F');

    // Metrics row below
    yPosition += mainBoxHeight + 5;

    const metrics = [
        { label: 'Base', value: `${estimation.estimation.baseDays.toFixed(2)} gg`, color: COLORS.success },
        { label: 'Moltiplicatore', value: `${estimation.estimation.driverMultiplier.toFixed(2)}x`, color: COLORS.primary },
        { label: 'Subtotale', value: `${estimation.estimation.subtotal.toFixed(2)} gg`, color: COLORS.textMuted },
        { label: 'Risk Score', value: `${estimation.estimation.riskScore}`, color: COLORS.secondary },
        { label: 'Contingency', value: `${estimation.estimation.contingencyPercent}%`, color: COLORS.textMuted },
    ];

    const metricWidth = boxWidth / metrics.length;
    metrics.forEach((metric, index) => {
        const x = margin + (metricWidth * index) + (metricWidth / 2);

        doc.setFont(FONTS.normal, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.textMuted);
        doc.text(metric.label, x, yPosition + 3, { align: 'center' });

        doc.setFont(FONTS.bold, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...metric.color);
        doc.text(metric.value, x, yPosition + 10, { align: 'center' });
    });

    return yPosition + 18;
}

function drawActivitiesTable(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    // Section title
    yPosition += 8;
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text(`ATTIVITÀ (${estimation.activities.length})`, margin, yPosition);
    yPosition += 4;

    // Group activities by phase
    const grouped = estimation.activities.reduce((acc, act) => {
        const group = act.group || 'OTHER';
        if (!acc[group]) acc[group] = [];
        acc[group].push(act);
        return acc;
    }, {} as Record<string, typeof estimation.activities>);

    // Prepare table data
    const tableData: (string | number)[][] = [];
    let totalHours = 0;

    Object.entries(grouped).forEach(([group, activities]) => {
        // Group header row
        const groupLabel = getGroupLabel(group);
        tableData.push([{ content: groupLabel, colSpan: 3, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', fontSize: 8 } } as any]);

        activities.forEach(act => {
            totalHours += act.hours;
            const aiMarker = act.isAiSuggested ? ' 🤖' : '';
            tableData.push([act.code, act.name + aiMarker, `${act.hours.toFixed(1)}h`]);
        });
    });

    // Total row
    tableData.push([
        { content: 'TOTALE ORE BASE', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [236, 253, 245] } } as any,
        { content: `${totalHours.toFixed(1)}h`, styles: { fontStyle: 'bold', fillColor: [236, 253, 245] } } as any
    ]);

    autoTable(doc, {
        startY: yPosition,
        margin: { left: margin, right: margin },
        head: [['Codice', 'Attività', 'Ore']],
        body: tableData,
        headStyles: {
            fillColor: COLORS.primary,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 8,
        },
        bodyStyles: {
            fontSize: 8,
            textColor: COLORS.text,
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'right' },
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250],
        },
        theme: 'grid',
    });

    return (doc as any).lastAutoTable.finalY + 5;
}

function drawDriversSection(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    // Section title
    yPosition += 5;
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text('DRIVER DI COMPLESSITÀ', margin, yPosition);
    yPosition += 5;

    const tableData = estimation.drivers.map(driver => [
        driver.name,
        driver.label,
        `${driver.multiplier.toFixed(2)}x`
    ]);

    autoTable(doc, {
        startY: yPosition,
        margin: { left: margin, right: margin },
        head: [['Driver', 'Valore', 'Moltiplicatore']],
        body: tableData,
        headStyles: {
            fillColor: COLORS.secondary,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 8,
        },
        bodyStyles: {
            fontSize: 8,
            textColor: COLORS.text,
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40 },
            2: { cellWidth: 30, halign: 'right' },
        },
        theme: 'grid',
    });

    return (doc as any).lastAutoTable.finalY + 3;
}

function drawRisksSection(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    // Section title
    yPosition += 5;
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text('RISCHI IDENTIFICATI', margin, yPosition);
    yPosition += 5;

    const tableData = estimation.risks.map(risk => [
        risk.name,
        `Peso: ${risk.weight}`
    ]);

    autoTable(doc, {
        startY: yPosition,
        margin: { left: margin, right: margin },
        head: [['Rischio', 'Peso']],
        body: tableData,
        headStyles: {
            fillColor: [239, 68, 68], // red-500
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 8,
        },
        bodyStyles: {
            fontSize: 8,
            textColor: COLORS.text,
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30, halign: 'right' },
        },
        theme: 'grid',
    });

    return (doc as any).lastAutoTable.finalY + 3;
}

function drawAiReasoningSection(
    doc: jsPDF,
    estimation: ExportableEstimation,
    pageWidth: number,
    margin: number,
    yPosition: number
): number {
    const boxWidth = pageWidth - (margin * 2);

    yPosition += 5;
    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text('🤖 REASONING AI', margin, yPosition);
    yPosition += 5;

    // Box for AI reasoning
    doc.setFillColor(245, 243, 255); // purple-50
    doc.setDrawColor(196, 181, 253); // purple-300

    const reasoningText = doc.splitTextToSize(estimation.aiReasoning || '', boxWidth - 10);
    const textHeight = reasoningText.length * 4 + 6;

    doc.roundedRect(margin, yPosition, boxWidth, textHeight, 2, 2, 'FD');

    doc.setFont(FONTS.normal, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(88, 28, 135); // purple-800
    doc.text(reasoningText, margin + 5, yPosition + 5);

    return yPosition + textHeight + 3;
}

function drawFooter(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number,
    margin: number
): void {
    const footerY = pageHeight - 10;

    // Line
    doc.setDrawColor(...COLORS.border);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    // Footer text
    doc.setFont(FONTS.normal, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);

    const timestamp = format(new Date(), "d MMM yyyy 'alle' HH:mm", { locale: it });
    doc.text(`Generato da Syntero | ${timestamp}`, margin, footerY);
    doc.text('www.syntero.io', pageWidth - margin, footerY, { align: 'right' });
}

// Helper functions
function drawBadge(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    color: [number, number, number]
): void {
    const padding = 2;
    const textWidth = doc.getTextWidth(text) + (padding * 2);

    doc.setFillColor(...color);
    doc.roundedRect(x, y - 3, textWidth + 4, 6, 1, 1, 'F');

    doc.setFont(FONTS.bold, 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.white);
    doc.text(text.toUpperCase(), x + padding + 2, y + 1);
}

function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
        HIGH: 'Alta',
        MEDIUM: 'Media',
        LOW: 'Bassa',
    };
    return labels[priority] || priority;
}

function getPriorityColor(priority: string): [number, number, number] {
    const colors: Record<string, [number, number, number]> = {
        HIGH: [239, 68, 68],    // red-500
        MEDIUM: [245, 158, 11], // amber-500
        LOW: [34, 197, 94],     // green-500
    };
    return colors[priority] || COLORS.textMuted;
}

function getStateLabel(state: string): string {
    const labels: Record<string, string> = {
        PROPOSED: 'Proposto',
        SELECTED: 'Selezionato',
        SCHEDULED: 'Pianificato',
        DONE: 'Completato',
    };
    return labels[state] || state;
}

function getGroupLabel(group: string): string {
    const labels: Record<string, string> = {
        ANALYSIS: '📋 Analisi',
        DEV: '💻 Sviluppo',
        TEST: '🧪 Testing',
        OPS: '🚀 Operations',
        GOVERNANCE: '📊 Governance',
    };
    return labels[group] || group;
}
