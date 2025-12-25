/**
 * Excel Generator using xlsx library
 * Creates professional Excel files with multiple sheets
 */

import * as XLSX from 'xlsx';
import type {
    ExportableEstimation,
    ExportOptions,
    ExportResult
} from '@/types/export';
import { format } from 'date-fns';

interface ExcelGeneratorOptions extends ExportOptions {
    estimations: ExportableEstimation[];
}

/**
 * Generate an Excel file for one or more estimations
 */
export function generateExcel(options: ExcelGeneratorOptions): ExportResult {
    try {
        const { estimations } = options;
        const workbook = XLSX.utils.book_new();

        if (estimations.length === 1) {
            // Single estimation - detailed sheets
            const estimation = estimations[0];
            addSingleEstimationSheets(workbook, estimation, options);
        } else {
            // Multiple estimations - summary + individual sheets
            addSummarySheet(workbook, estimations);
            addDetailedSheet(workbook, estimations, options);
        }

        // Generate filename
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const filename = estimations.length === 1
            ? `Stima_${estimations[0].requirement.reqId || 'export'}_${dateStr}.xlsx`
            : `Progetto_Stime_${dateStr}.xlsx`;

        // Write to blob
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        return {
            success: true,
            filename,
            blob,
        };
    } catch (error) {
        console.error('Error generating Excel:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Unknown error generating Excel',
        };
    }
}

function addSingleEstimationSheets(
    workbook: XLSX.WorkBook,
    estimation: ExportableEstimation,
    options: ExportOptions
): void {
    // Sheet 1: Summary
    const summaryData = [
        ['STIMA REQUISITO'],
        [''],
        ['Titolo', estimation.requirement.title],
        ['ID', estimation.requirement.reqId || estimation.requirement.id],
        ['Priorità', getPriorityLabel(estimation.requirement.priority)],
        ['Stato', getStateLabel(estimation.requirement.state)],
        ['Owner', estimation.requirement.businessOwner || '-'],
        ['Tecnologia', estimation.technology?.name || '-'],
        [''],
        ['RISULTATO STIMA'],
        [''],
        ['Giorni Totali', estimation.estimation.totalDays],
        ['Giorni Base', estimation.estimation.baseDays],
        ['Moltiplicatore Driver', estimation.estimation.driverMultiplier],
        ['Subtotale', estimation.estimation.subtotal],
        ['Risk Score', estimation.estimation.riskScore],
        ['Contingency %', estimation.estimation.contingencyPercent],
        ['Giorni Contingency', estimation.estimation.contingencyDays],
    ];

    if (options.includeDescription && estimation.requirement.description) {
        summaryData.splice(4, 0, ['Descrizione', estimation.requirement.description]);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths
    summarySheet['!cols'] = [
        { wch: 20 },
        { wch: 60 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');

    // Sheet 2: Activities
    if (options.includeActivities && estimation.activities.length > 0) {
        const activitiesData = [
            ['Codice', 'Attività', 'Fase', 'Ore', 'Suggerito AI'],
            ...estimation.activities.map(act => [
                act.code,
                act.name,
                getGroupLabel(act.group),
                act.hours,
                act.isAiSuggested ? 'Sì' : 'No',
            ]),
            ['', '', '', '', ''],
            ['TOTALE', '', '', estimation.activities.reduce((sum, a) => sum + a.hours, 0), ''],
        ];

        const activitiesSheet = XLSX.utils.aoa_to_sheet(activitiesData);
        activitiesSheet['!cols'] = [
            { wch: 15 },
            { wch: 45 },
            { wch: 15 },
            { wch: 10 },
            { wch: 12 },
        ];

        XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Attività');
    }

    // Sheet 3: Drivers
    if (options.includeDrivers && estimation.drivers.length > 0) {
        const driversData = [
            ['Driver', 'Valore Selezionato', 'Moltiplicatore'],
            ...estimation.drivers.map(d => [
                d.name,
                d.label,
                d.multiplier,
            ]),
        ];

        const driversSheet = XLSX.utils.aoa_to_sheet(driversData);
        driversSheet['!cols'] = [
            { wch: 30 },
            { wch: 25 },
            { wch: 15 },
        ];

        XLSX.utils.book_append_sheet(workbook, driversSheet, 'Driver');
    }

    // Sheet 4: Risks
    if (options.includeRisks && estimation.risks.length > 0) {
        const risksData = [
            ['Rischio', 'Peso'],
            ...estimation.risks.map(r => [
                r.name,
                r.weight,
            ]),
            ['', ''],
            ['TOTALE PESO', estimation.risks.reduce((sum, r) => sum + r.weight, 0)],
        ];

        const risksSheet = XLSX.utils.aoa_to_sheet(risksData);
        risksSheet['!cols'] = [
            { wch: 40 },
            { wch: 10 },
        ];

        XLSX.utils.book_append_sheet(workbook, risksSheet, 'Rischi');
    }
}

function addSummarySheet(
    workbook: XLSX.WorkBook,
    estimations: ExportableEstimation[]
): void {
    const summaryData = [
        ['RIEPILOGO PROGETTO'],
        [''],
        ['Numero Requisiti', estimations.length],
        ['Giorni Totali Stimati', estimations.reduce((sum, e) => sum + e.estimation.totalDays, 0).toFixed(2)],
        ['Media Giorni/Requisito', (estimations.reduce((sum, e) => sum + e.estimation.totalDays, 0) / estimations.length).toFixed(2)],
        [''],
        ['DETTAGLIO REQUISITI'],
        [''],
        ['ID', 'Titolo', 'Priorità', 'Stato', 'Giorni Base', 'Moltiplicatore', 'Giorni Totali'],
        ...estimations.map(e => [
            e.requirement.reqId || e.requirement.id.substring(0, 8),
            e.requirement.title,
            getPriorityLabel(e.requirement.priority),
            getStateLabel(e.requirement.state),
            e.estimation.baseDays,
            e.estimation.driverMultiplier,
            e.estimation.totalDays,
        ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');
}

function addDetailedSheet(
    workbook: XLSX.WorkBook,
    estimations: ExportableEstimation[],
    options: ExportOptions
): void {
    // All activities from all requirements
    if (options.includeActivities) {
        const allActivities: any[][] = [
            ['Requisito', 'Codice Attività', 'Nome Attività', 'Fase', 'Ore', 'AI Suggerito'],
        ];

        estimations.forEach(est => {
            est.activities.forEach(act => {
                allActivities.push([
                    est.requirement.reqId || est.requirement.id.substring(0, 8),
                    act.code,
                    act.name,
                    getGroupLabel(act.group),
                    act.hours,
                    act.isAiSuggested ? 'Sì' : 'No',
                ]);
            });
        });

        const activitiesSheet = XLSX.utils.aoa_to_sheet(allActivities);
        activitiesSheet['!cols'] = [
            { wch: 12 },
            { wch: 15 },
            { wch: 40 },
            { wch: 15 },
            { wch: 8 },
            { wch: 12 },
        ];

        XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Tutte le Attività');
    }
}

// Helper functions
function getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
        HIGH: 'Alta',
        MEDIUM: 'Media',
        LOW: 'Bassa',
    };
    return labels[priority] || priority;
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
        ANALYSIS: 'Analisi',
        DEV: 'Sviluppo',
        TEST: 'Testing',
        OPS: 'Operations',
        GOVERNANCE: 'Governance',
    };
    return labels[group] || group;
}
