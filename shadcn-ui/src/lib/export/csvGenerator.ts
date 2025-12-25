/**
 * CSV Generator
 * Creates CSV files for data export
 */

import type {
    ExportableEstimation,
    ExportOptions,
    ExportResult
} from '@/types/export';
import { format } from 'date-fns';

interface CSVGeneratorOptions extends ExportOptions {
    estimations: ExportableEstimation[];
}

/**
 * Generate a CSV file for estimations
 */
export function generateCSV(options: CSVGeneratorOptions): ExportResult {
    try {
        const { estimations } = options;

        let csvContent: string;

        if (estimations.length === 1) {
            csvContent = generateSingleEstimationCSV(estimations[0], options);
        } else {
            csvContent = generateMultipleEstimationsCSV(estimations, options);
        }

        // Generate filename
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const filename = estimations.length === 1
            ? `Stima_${estimations[0].requirement.reqId || 'export'}_${dateStr}.csv`
            : `Progetto_Stime_${dateStr}.csv`;

        // Create blob with BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], {
            type: 'text/csv;charset=utf-8;'
        });

        return {
            success: true,
            filename,
            blob,
        };
    } catch (error) {
        console.error('Error generating CSV:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Unknown error generating CSV',
        };
    }
}

function generateSingleEstimationCSV(
    estimation: ExportableEstimation,
    options: ExportOptions
): string {
    const lines: string[] = [];

    // Header section
    lines.push('STIMA REQUISITO');
    lines.push('');
    lines.push(`Titolo;${escapeCSV(estimation.requirement.title)}`);
    lines.push(`ID;${estimation.requirement.reqId || estimation.requirement.id}`);
    lines.push(`Priorità;${getPriorityLabel(estimation.requirement.priority)}`);
    lines.push(`Stato;${getStateLabel(estimation.requirement.state)}`);

    if (options.includeDescription && estimation.requirement.description) {
        lines.push(`Descrizione;${escapeCSV(estimation.requirement.description)}`);
    }

    lines.push('');
    lines.push('RISULTATO STIMA');
    lines.push('');
    lines.push(`Giorni Totali;${estimation.estimation.totalDays.toFixed(2)}`);
    lines.push(`Giorni Base;${estimation.estimation.baseDays.toFixed(2)}`);
    lines.push(`Moltiplicatore Driver;${estimation.estimation.driverMultiplier.toFixed(3)}`);
    lines.push(`Subtotale;${estimation.estimation.subtotal.toFixed(2)}`);
    lines.push(`Risk Score;${estimation.estimation.riskScore}`);
    lines.push(`Contingency %;${estimation.estimation.contingencyPercent}`);
    lines.push(`Giorni Contingency;${estimation.estimation.contingencyDays.toFixed(2)}`);

    // Activities section
    if (options.includeActivities && estimation.activities.length > 0) {
        lines.push('');
        lines.push('ATTIVITÀ');
        lines.push('Codice;Nome;Fase;Ore;AI Suggerito');

        estimation.activities.forEach(act => {
            lines.push([
                act.code,
                escapeCSV(act.name),
                getGroupLabel(act.group),
                act.hours.toFixed(1),
                act.isAiSuggested ? 'Sì' : 'No',
            ].join(';'));
        });

        const totalHours = estimation.activities.reduce((sum, a) => sum + a.hours, 0);
        lines.push(`TOTALE;;;${totalHours.toFixed(1)};`);
    }

    // Drivers section
    if (options.includeDrivers && estimation.drivers.length > 0) {
        lines.push('');
        lines.push('DRIVER');
        lines.push('Nome;Valore;Moltiplicatore');

        estimation.drivers.forEach(d => {
            lines.push([
                escapeCSV(d.name),
                d.label,
                d.multiplier.toFixed(2),
            ].join(';'));
        });
    }

    // Risks section
    if (options.includeRisks && estimation.risks.length > 0) {
        lines.push('');
        lines.push('RISCHI');
        lines.push('Nome;Peso');

        estimation.risks.forEach(r => {
            lines.push([
                escapeCSV(r.name),
                r.weight.toString(),
            ].join(';'));
        });
    }

    return lines.join('\n');
}

function generateMultipleEstimationsCSV(
    estimations: ExportableEstimation[],
    options: ExportOptions
): string {
    const lines: string[] = [];

    // Header
    lines.push('RIEPILOGO PROGETTO');
    lines.push('');
    lines.push(`Numero Requisiti;${estimations.length}`);
    lines.push(`Giorni Totali;${estimations.reduce((sum, e) => sum + e.estimation.totalDays, 0).toFixed(2)}`);
    lines.push('');

    // Requirements table
    lines.push('ID;Titolo;Priorità;Stato;Giorni Base;Moltiplicatore;Giorni Totali');

    estimations.forEach(e => {
        lines.push([
            e.requirement.reqId || e.requirement.id.substring(0, 8),
            escapeCSV(e.requirement.title),
            getPriorityLabel(e.requirement.priority),
            getStateLabel(e.requirement.state),
            e.estimation.baseDays.toFixed(2),
            e.estimation.driverMultiplier.toFixed(2),
            e.estimation.totalDays.toFixed(2),
        ].join(';'));
    });

    return lines.join('\n');
}

// Helper functions
function escapeCSV(value: string): string {
    if (!value) return '';
    // Escape quotes and wrap in quotes if contains special characters
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

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
