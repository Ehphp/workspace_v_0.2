import * as XLSX from 'xlsx';

export interface ParsedRequirement {
    req_id: string;
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    state: 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE';
    business_owner: string;
}

export interface ColumnMapping {
    req_id?: string;
    title?: string;
    description?: string | string[]; // Can be single column or multiple columns to merge (with column labels)
    priority?: string;
    state?: string;
    business_owner?: string;
}

export interface ValidationError {
    row: number;
    field: string;
    message: string;
}

export interface ParseResult {
    headers: string[];
    data: unknown[][];
    suggestedMapping: ColumnMapping;
    rowCount: number;
    sheetNames: string[];
    selectedSheet: string;
}

// Pattern comuni per identificare colonne automaticamente
const COLUMN_PATTERNS = {
    req_id: [
        'id',
        'req_id',
        'requirement id',
        'req id',
        'codice',
        'code',
        'requisito',
        'requirement code',
    ],
    description: [
        'description',
        'descrizione',
        'desc',
        'details',
        'dettagli',
        'note',
        'notes',
        'long description',
        'esigenza',
        'richiesta',
        'request',
        'requirement',
    ],
    priority: [
        'priority',
        'priorità',
        'prio',
        'priorita',
        'importance',
        'importanza',
    ],
    state: [
        'state',
        'status',
        'stato',
        'phase',
        'fase',
        'stage',
    ],
    business_owner: [
        'owner',
        'business owner',
        'responsabile',
        'assegnatario',
        'assigned to',
        'proprietario',
        'contact',
    ],
};

const PRIORITY_MAPPING: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    'low': 'LOW',
    'bassa': 'LOW',
    'l': 'LOW',
    '1': 'LOW',
    'medium': 'MEDIUM',
    'media': 'MEDIUM',
    'm': 'MEDIUM',
    '2': 'MEDIUM',
    'high': 'HIGH',
    'alta': 'HIGH',
    'h': 'HIGH',
    '3': 'HIGH',
};

const STATE_MAPPING: Record<string, 'PROPOSED' | 'SELECTED' | 'SCHEDULED' | 'DONE'> = {
    'proposed': 'PROPOSED',
    'proposto': 'PROPOSED',
    'nuovo': 'PROPOSED',
    'new': 'PROPOSED',
    'selected': 'SELECTED',
    'selezionato': 'SELECTED',
    'approved': 'SELECTED',
    'approvato': 'SELECTED',
    'scheduled': 'SCHEDULED',
    'pianificato': 'SCHEDULED',
    'planned': 'SCHEDULED',
    'in progress': 'SCHEDULED',
    'done': 'DONE',
    'completato': 'DONE',
    'completed': 'DONE',
    'finished': 'DONE',
};

/**
 * Parse Excel or CSV file and extract data
 */
export async function parseExcelFile(file: File, sheetName?: string): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                console.log('=== EXCEL PARSER START ===');
                console.log('File size:', file.size);
                console.log('File name:', file.name);

                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });

                console.log('Sheet names:', workbook.SheetNames);

                // Use specified sheet or first sheet
                const selectedSheetName = sheetName || workbook.SheetNames[0];
                console.log('Using sheet:', selectedSheetName);

                const worksheet = workbook.Sheets[selectedSheetName];

                // Converti in array 2D
                const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '',
                    blankrows: false
                });

                console.log('Raw data rows:', rawData.length);
                console.log('First 5 raw rows:', rawData.slice(0, 5));

                if (rawData.length === 0) {
                    reject(new Error('Il file è vuoto'));
                    return;
                }

                // Prima riga = headers
                const headers = rawData[0].map((h: unknown) => String(h).trim());
                const dataRows = rawData.slice(1).filter(row =>
                    row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
                );

                // Suggerisci mapping automatico
                const suggestedMapping = detectColumnMapping(headers);

                resolve({
                    headers,
                    data: dataRows,
                    suggestedMapping,
                    rowCount: dataRows.length,
                    sheetNames: workbook.SheetNames,
                    selectedSheet: selectedSheetName,
                });
            } catch (error) {
                reject(new Error('Errore nel parsing del file: ' + (error as Error).message));
            }
        };

        reader.onerror = () => reject(new Error('Errore nella lettura del file'));
        reader.readAsBinaryString(file);
    });
}

/**
 * Detect column mapping automatically based on header names
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};

    headers.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase().trim();

        // Cerca match per ogni campo
        for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
            if (patterns.some(pattern => normalizedHeader.includes(pattern))) {
                mapping[field as keyof ColumnMapping] = header;
                break;
            }
        }
    });

    return mapping;
}

/**
 * Convert raw data to ParsedRequirement objects using column mapping
 */
export function mapDataToRequirements(
    headers: string[],
    data: unknown[][],
    mapping: ColumnMapping
): ParsedRequirement[] {
    const headerIndexMap: Record<string, number> = {};

    // Crea mappa header -> indice
    headers.forEach((header, index) => {
        headerIndexMap[header] = index;
    });

    return data.map((row, rowIndex) => {
        const readCell = (headerName?: string): string => {
            if (!headerName) return '';
            const index = headerIndexMap[headerName];
            if (index === undefined) return '';
            const value = row[index];
            return value !== null && value !== undefined ? String(value).trim() : '';
        };

        const getDescription = (): string => {
            const descriptionMapping = mapping.description;
            if (!descriptionMapping) return '';

            if (Array.isArray(descriptionMapping)) {
                console.log(`[ROW ${rowIndex + 1}] Description uses multiple columns:`, descriptionMapping);
                const labeledChunks = descriptionMapping
                    .map((header) => {
                        const index = headerIndexMap[header];
                        if (index === undefined) {
                            console.log(`  - Column "${header}" not found in headers`);
                            return null;
                        }
                        const value = row[index];
                        const stringValue = value !== null && value !== undefined ? String(value).trim() : '';
                        if (stringValue === '') return null;

                        console.log(`  - Column "${header}" [index ${index}] = "${stringValue}"`);
                        return { header, value: stringValue };
                    })
                    .filter((chunk): chunk is { header: string; value: string } => chunk !== null);

                if (labeledChunks.length === 0) return '';

                const structured = labeledChunks
                    .map(({ header, value }) => `**${header}**\n${value}`)
                    .join('\n\n');

                console.log('  -> Structured description with column labels:', structured);
                return structured;
            }

            return readCell(descriptionMapping);
        };

        const getCell = (field: keyof ColumnMapping): string => {
            if (field === 'description') {
                return getDescription();
            }

            const headerName = mapping[field];
            if (!headerName || Array.isArray(headerName)) return '';
            return readCell(headerName);
        };

        const req_id = getCell('req_id');
        const description = getCell('description');
        const priorityRaw = getCell('priority').toLowerCase();
        const stateRaw = getCell('state').toLowerCase();
        const business_owner = getCell('business_owner');
        const title = getCell('title');

        console.log(`[ROW ${rowIndex + 1}] Mapped requirement:`, {
            req_id,
            title: title ? (title.substring(0, 50) + (title.length > 50 ? '...' : '')) : '(EMPTY)',
            description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
            priority: PRIORITY_MAPPING[priorityRaw] || 'MEDIUM',
            state: STATE_MAPPING[stateRaw] || 'PROPOSED',
        });

        return {
            req_id,
            title,
            description,
            priority: PRIORITY_MAPPING[priorityRaw] || 'MEDIUM',
            state: STATE_MAPPING[stateRaw] || 'PROPOSED',
            business_owner,
        };
    });
}/**
 * Validate parsed requirements
 */
export function validateRequirements(
    requirements: ParsedRequirement[]
): ValidationError[] {
    const errors: ValidationError[] = [];

    requirements.forEach((req, index) => {
        const rowNum = index + 2; // +2 perché riga 1 = header, index parte da 0

        // Validazione ID obbligatorio
        if (!req.req_id || req.req_id.trim() === '') {
            errors.push({
                row: rowNum,
                field: 'req_id',
                message: 'ID requisito obbligatorio',
            });
        }

        // Title non è più obbligatorio - verrà generato da GPT se mancante

        // Validazione lunghezza title
        if (req.title && req.title.length > 200) {
            errors.push({
                row: rowNum,
                field: 'title',
                message: 'Titolo troppo lungo (max 200 caratteri)',
            });
        }

        // Check duplicati ID nello stesso file
        const duplicates = requirements.filter(r => r.req_id === req.req_id);
        if (duplicates.length > 1 && duplicates[0] === req) {
            errors.push({
                row: rowNum,
                field: 'req_id',
                message: `ID duplicato nel file`,
            });
        }
    });

    return errors;
}

/**
 * Generate sample Excel template for download
 */
export function generateSampleTemplate(): void {
    const sampleData = [
        ['REQ-001', 'User Authentication', 'Implement login and registration system with email verification', 'HIGH', 'SELECTED', 'John Doe'],
        ['REQ-002', 'Dashboard UI', 'Create responsive dashboard with charts and metrics', 'MEDIUM', 'PROPOSED', 'Jane Smith'],
        ['REQ-003', 'Export to PDF', 'Allow users to export reports in PDF format', 'LOW', 'PROPOSED', 'Bob Johnson'],
    ];

    const headers = ['ID', 'Title', 'Description', 'Priority', 'State', 'Business Owner'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requirements');

    // Auto-width colonne
    const maxWidth = 50;
    const colWidths = headers.map((h, i) => {
        const maxLen = Math.max(
            h.length,
            ...sampleData.map(row => String(row[i] || '').length)
        );
        return { wch: Math.min(maxLen + 2, maxWidth) };
    });
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'requirements_template.xlsx');
}
