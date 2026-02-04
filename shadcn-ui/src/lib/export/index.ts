/**
 * Export Service
 * Central orchestration layer for all export functionality
 */

import { generatePDF } from './pdfGenerator';
import { generateExcel } from './excelGenerator';
import { generateCSV } from './csvGenerator';
import type {
    ExportableEstimation,
    ExportOptions,
    ExportResult,
    ExportFormat,
    DEFAULT_EXPORT_OPTIONS
} from '@/types/export';

export interface ExportServiceOptions extends ExportOptions {
    estimations: ExportableEstimation[];
}

/**
 * Main export function - routes to appropriate generator
 */
export async function exportEstimations(options: ExportServiceOptions): Promise<ExportResult> {
    const { format, estimations } = options;

    if (!estimations || estimations.length === 0) {
        return {
            success: false,
            filename: '',
            error: 'No estimations to export',
        };
    }

    switch (format) {
        case 'pdf':
            // PDF only supports single estimation
            if (estimations.length > 1) {
                return {
                    success: false,
                    filename: '',
                    error: 'PDF export only supports single estimations. Use Excel for bulk export.',
                };
            }
            return generatePDF({ ...options, estimation: estimations[0] });

        case 'excel':
            return generateExcel({ ...options, estimations });

        case 'csv':
            return generateCSV({ ...options, estimations });

        default:
            return {
                success: false,
                filename: '',
                error: `Unsupported export format: ${format}`,
            };
    }
}

/**
 * Trigger download of exported file
 */
export function downloadFile(result: ExportResult): void {
    if (!result.success || !result.blob) {
        console.error('Cannot download: Export failed or no blob available');
        return;
    }

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export and download in one step
 */
export async function exportAndDownload(options: ExportServiceOptions): Promise<ExportResult> {
    const result = await exportEstimations(options);

    if (result.success) {
        downloadFile(result);
    }

    return result;
}

/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
        pdf: '.pdf',
        excel: '.xlsx',
        csv: '.csv',
    };
    return extensions[format];
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
        pdf: 'application/pdf',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
    };
    return mimeTypes[format];
}

// Re-export types and generators
export { generatePDF } from './pdfGenerator';
export { generateExcel } from './excelGenerator';
export { generateCSV } from './csvGenerator';
export type { ExportableEstimation, ExportOptions, ExportResult, ExportFormat };
