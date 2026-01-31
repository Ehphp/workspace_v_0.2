import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    Download,
    AlertTriangle,
    Loader2,
} from 'lucide-react';
import {
    parseExcelFile,
    mapDataToRequirements,
    validateRequirements,
    generateSampleTemplate,
    type ParseResult,
    type ColumnMapping,
    type ParsedRequirement,
    type ValidationError,
} from '@/lib/excelParser';
import { generateTitleFromDescription } from '@/lib/openai';

interface ImportRequirementsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listId: string;
    onImport: (requirements: ParsedRequirement[]) => void;
}

type Step = 'upload' | 'mapping' | 'preview';

export function ImportRequirementsDialog({
    open,
    onOpenChange,
    listId,
    onImport,
}: ImportRequirementsDialogProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<Step>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string>('');
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
    const [requirements, setRequirements] = useState<ParsedRequirement[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [error, setError] = useState<string>('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        console.log('=== FILE UPLOAD ===');
        console.log('Selected file:', selectedFile.name, selectedFile.size, 'bytes', 'last modified:', new Date(selectedFile.lastModified).toISOString());

        setError('');
        setFile(selectedFile);

        try {
            const result = await parseExcelFile(selectedFile, selectedSheet || undefined);

            console.log('=== PARSE RESULT ===');
            console.log('Headers found:', result.headers);
            console.log('Number of data rows:', result.data.length);
            console.log('First 3 data rows:', result.data.slice(0, 3));
            console.log('Suggested mapping:', result.suggestedMapping);
            console.log('Available sheets:', result.sheetNames);
            console.log('Selected sheet:', result.selectedSheet);

            setParseResult(result);
            setSelectedSheet(result.selectedSheet);
            setColumnMapping(result.suggestedMapping);

            // If multiple sheets, let user choose
            if (result.sheetNames.length > 1) {
                // Stay in upload step to show sheet selection
                console.log('Multiple sheets detected, staying in upload step');
            } else {
                setStep('mapping');
            }
        } catch (err) {
            console.error('Parse error:', err);
            setError((err as Error).message);
        }
    };

    const handleMappingComplete = () => {
        if (!parseResult) return;

        console.log('=== MAPPING STEP ===');
        console.log('Headers:', parseResult.headers);
        console.log('Column Mapping:', columnMapping);
        console.log('Description mapping:', columnMapping.description);
        console.log('Is description an array?', Array.isArray(columnMapping.description));

        const mapped = mapDataToRequirements(
            parseResult.headers,
            parseResult.data,
            columnMapping
        );
        const errors = validateRequirements(mapped);

        console.log('=== MAPPED REQUIREMENTS ===');
        mapped.forEach((req, i) => {
            console.log(`Requirement ${i + 1}:`, {
                req_id: req.req_id,
                title: req.title || '(EMPTY)',
                description_length: req.description?.length || 0,
                description_preview: req.description?.substring(0, 100)
            });
        });

        setRequirements(mapped);
        setValidationErrors(errors);
        setStep('preview');
    };

    const handleImport = async () => {
        if (!user || requirements.length === 0) return;

        console.log('=== IMPORT START ===');
        console.log('Total requirements:', requirements.length);

        const validRequirements = requirements.filter((req, index) => {
            const rowNum = index + 2;
            return !validationErrors.some(err => err.row === rowNum);
        });

        console.log('Valid requirements after filtering errors:', validRequirements.length);

        // Pass valid requirements to parent for background processing
        onImport(validRequirements);
        handleClose();
    };

    const handleClose = () => {
        setStep('upload');
        setFile(null);
        setParseResult(null);
        setColumnMapping({});
        setRequirements([]);
        setValidationErrors([]);
        setError('');
        onOpenChange(false);

    };

    const renderUploadStep = () => (
        <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload Excel File</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Upload an Excel (.xlsx, .xls) or CSV file with requirements
                </p>
                <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload">
                    <Button asChild>
                        <span>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Choose File
                        </span>
                    </Button>
                </label>
                {file && (
                    <p className="text-sm text-muted-foreground mt-2">
                        Selected: {file.name}
                    </p>
                )}
            </div>

            {/* Sheet selection - show if multiple sheets detected */}
            {parseResult && parseResult.sheetNames.length > 1 && (
                <div className="space-y-2">
                    <Label>Select Sheet to Import</Label>
                    <Select value={selectedSheet} onValueChange={async (value) => {
                        setSelectedSheet(value);
                        if (file) {
                            try {
                                const result = await parseExcelFile(file, value);
                                setParseResult(result);
                                setColumnMapping(result.suggestedMapping);
                            } catch (err) {
                                setError((err as Error).message);
                            }
                        }
                    }}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {parseResult.sheetNames.map((sheetName) => (
                                <SelectItem key={sheetName} value={sheetName}>
                                    {sheetName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        {parseResult.rowCount} rows detected in "{selectedSheet}"
                    </p>
                    <Button onClick={() => setStep('mapping')} className="w-full">
                        Continue with "{selectedSheet}"
                    </Button>
                </div>
            )}

            <Alert>
                <Download className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                    <span>Need a template?</span>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={generateSampleTemplate}
                        className="h-auto p-0"
                    >
                        Download sample
                    </Button>
                </AlertDescription>
            </Alert>

            {error && (
                <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );

    const renderMappingStep = () => {
        if (!parseResult) return null;

        const fields: Array<{
            key: keyof ColumnMapping;
            label: string;
            required: boolean;
            multiSelect?: boolean;
            helpText?: string;
        }> = [
                { key: 'req_id', label: 'Requirement ID', required: true },
                { key: 'title', label: 'Title', required: false, helpText: 'If empty, will be generated by AI' },
                {
                    key: 'description',
                    label: 'Description',
                    required: false,
                    multiSelect: true,
                    helpText: 'Select multiple columns to merge into a labeled description (each value keeps its column name for AI context)'
                },
                { key: 'priority', label: 'Priority', required: false },
                { key: 'state', label: 'State', required: false },
                { key: 'business_owner', label: 'Business Owner', required: false },
            ];

        const getDescriptionColumns = (): string[] => {
            const desc = columnMapping.description;
            if (!desc) return [];
            return Array.isArray(desc) ? desc : [desc];
        };

        const toggleDescriptionColumn = (header: string) => {
            const current = getDescriptionColumns();
            const newColumns = current.includes(header)
                ? current.filter(h => h !== header)
                : [...current, header];

            const newMapping = { ...columnMapping };
            if (newColumns.length === 0) {
                delete newMapping.description;
            } else if (newColumns.length === 1) {
                newMapping.description = newColumns[0];
            } else {
                newMapping.description = newColumns;
            }
            setColumnMapping(newMapping);
        };

        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Found {parseResult.rowCount} rows. Map Excel columns to requirement fields:
                    </p>

                    {fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <Label>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {field.helpText && (
                                <p className="text-xs text-muted-foreground">{field.helpText}</p>
                            )}

                            {field.multiSelect && field.key === 'description' ? (
                                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {parseResult.headers.map((header) => {
                                        const selected = getDescriptionColumns().includes(header);
                                        return (
                                            <div key={header} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`desc-${header}`}
                                                    checked={selected}
                                                    onCheckedChange={() => toggleDescriptionColumn(header)}
                                                />
                                                <label
                                                    htmlFor={`desc-${header}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {header}
                                                </label>
                                            </div>
                                        );
                                    })}
                                    {getDescriptionColumns().length > 0 && (
                                        <p className="text-xs text-muted-foreground pt-2 border-t">
                                            Selected {getDescriptionColumns().length} column(s). They will be merged and labeled with the column name to keep context.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <Select
                                    value={
                                        Array.isArray(columnMapping[field.key])
                                            ? '__NONE__'
                                            : (columnMapping[field.key] as string || '__NONE__')
                                    }
                                    onValueChange={(value) => {
                                        const newMapping = { ...columnMapping };
                                        if (value === '__NONE__') {
                                            delete newMapping[field.key];
                                        } else {
                                            newMapping[field.key] = value;
                                        }
                                        setColumnMapping(newMapping);
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select column..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__NONE__">- None -</SelectItem>
                                        {parseResult.headers.map((header) => (
                                            <SelectItem key={header} value={header}>
                                                {header}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setStep('upload')}>
                        Back
                    </Button>
                    <Button
                        onClick={handleMappingComplete}
                        disabled={!columnMapping.req_id}
                    >
                        Continue to Preview
                    </Button>
                </div>
            </div>
        );
    };

    const renderPreviewStep = () => {
        const validCount = requirements.length - validationErrors.length;
        const hasErrors = validationErrors.length > 0;

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            {validCount} valid requirements ready to import
                        </p>
                        {hasErrors && (
                            <p className="text-sm text-destructive">
                                {validationErrors.length} rows have errors
                            </p>
                        )}
                    </div>
                </div>

                {hasErrors && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            <p className="font-semibold mb-2">Validation Errors:</p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {validationErrors.slice(0, 10).map((err, i) => (
                                    <p key={i} className="text-xs">
                                        Row {err.row}: {err.message}
                                    </p>
                                ))}
                                {validationErrors.length > 10 && (
                                    <p className="text-xs italic">
                                        ...and {validationErrors.length - 10} more errors
                                    </p>
                                )}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                            <tr>
                                <th className="text-left p-2 font-medium">ID</th>
                                <th className="text-left p-2 font-medium">Title</th>
                                <th className="text-left p-2 font-medium">Priority</th>
                                <th className="text-left p-2 font-medium">State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requirements.slice(0, 50).map((req, i) => {
                                const rowNum = i + 2;
                                const hasError = validationErrors.some(err => err.row === rowNum);
                                return (
                                    <tr
                                        key={i}
                                        className={hasError ? 'bg-destructive/10' : ''}
                                    >
                                        <td className="p-2 font-mono text-xs">{req.req_id}</td>
                                        <td className="p-2 truncate max-w-xs">{req.title}</td>
                                        <td className="p-2">{req.priority}</td>
                                        <td className="p-2">{req.state}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {requirements.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center p-2">
                            Showing first 50 of {requirements.length} rows
                        </p>
                    )}
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('mapping')}>
                        Back
                    </Button>
                    <Button onClick={handleImport} disabled={validCount === 0}>
                        Import {validCount} Requirements
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Requirements from Excel</DialogTitle>
                    <DialogDescription>
                        Upload an Excel file to quickly import multiple requirements
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    {step === 'upload' && renderUploadStep()}
                    {step === 'mapping' && renderMappingStep()}
                    {step === 'preview' && renderPreviewStep()}
                </div>
            </DialogContent>
        </Dialog>
    );
}
