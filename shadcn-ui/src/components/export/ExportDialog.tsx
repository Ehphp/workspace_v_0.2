/**
 * Export Dialog Component
 * Modern dialog for selecting export format and options
 */

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    FileSpreadsheet,
    FileDown,
    Loader2,
    Check,
    Sparkles
} from 'lucide-react';
import { exportAndDownload } from '@/lib/export';
import type { ExportableEstimation, ExportFormat, ExportOptions } from '@/types/export';

interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estimations: ExportableEstimation[];
    projectName?: string;
}

const FORMAT_OPTIONS: {
    id: ExportFormat;
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    supportsBulk: boolean;
}[] = [
        {
            id: 'pdf',
            label: 'PDF',
            description: 'Documento professionale per presentazioni',
            icon: FileText,
            color: 'text-red-600',
            bgColor: 'bg-red-50 border-red-200 hover:border-red-400',
            supportsBulk: false,
        },
        {
            id: 'excel',
            label: 'Excel',
            description: 'Foglio di calcolo per analisi e modifiche',
            icon: FileSpreadsheet,
            color: 'text-green-600',
            bgColor: 'bg-green-50 border-green-200 hover:border-green-400',
            supportsBulk: true,
        },
        {
            id: 'csv',
            label: 'CSV',
            description: 'Dati grezzi per import in altri tool',
            icon: FileDown,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 border-blue-200 hover:border-blue-400',
            supportsBulk: true,
        },
    ];

export function ExportDialog({
    open,
    onOpenChange,
    estimations,
    projectName
}: ExportDialogProps) {
    const { toast } = useToast();
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
    const [isExporting, setIsExporting] = useState(false);
    const [options, setOptions] = useState({
        includeDescription: true,
        includeActivities: true,
        includeDrivers: true,
        includeRisks: true,
        includeHistory: false,
        includeAiReasoning: false,
    });

    const isBulkExport = estimations.length > 1;
    const selectedFormatInfo = FORMAT_OPTIONS.find(f => f.id === selectedFormat);

    const handleExport = async () => {
        if (isBulkExport && selectedFormat === 'pdf') {
            toast({
                title: 'Formato non supportato',
                description: 'PDF supporta solo singole stime. Usa Excel per export multipli.',
                variant: 'destructive',
            });
            return;
        }

        setIsExporting(true);

        try {
            const result = await exportAndDownload({
                format: selectedFormat,
                estimations,
                projectName,
                ...options,
            });

            if (result.success) {
                toast({
                    title: 'Export completato',
                    description: `File ${result.filename} scaricato con successo.`,
                });
                onOpenChange(false);
            } else {
                toast({
                    title: 'Errore export',
                    description: result.error || 'Si è verificato un errore durante l\'export.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Export error:', error);
            toast({
                title: 'Errore export',
                description: 'Si è verificato un errore imprevisto.',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const toggleOption = (key: keyof typeof options) => {
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white/95 backdrop-blur-xl border-slate-200/60">
                <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
                    <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        Esporta Stima
                    </DialogTitle>
                    <DialogDescription className="text-slate-600">
                        {isBulkExport
                            ? `Esporta ${estimations.length} requisiti stimati`
                            : `Esporta la stima per "${estimations[0]?.requirement.title}"`
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Format Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">
                            Formato di export
                        </Label>
                        <div className="grid grid-cols-3 gap-3">
                            {FORMAT_OPTIONS.map((format) => {
                                const isSelected = selectedFormat === format.id;
                                const isDisabled = isBulkExport && !format.supportsBulk;
                                const Icon = format.icon;

                                return (
                                    <motion.button
                                        key={format.id}
                                        onClick={() => !isDisabled && setSelectedFormat(format.id)}
                                        disabled={isDisabled}
                                        whileHover={!isDisabled ? { scale: 1.02 } : {}}
                                        whileTap={!isDisabled ? { scale: 0.98 } : {}}
                                        className={`
                      relative p-4 rounded-xl border-2 transition-all duration-200
                      ${isSelected
                                                ? `${format.bgColor} ring-2 ring-offset-2 ring-${format.id === 'pdf' ? 'red' : format.id === 'excel' ? 'green' : 'blue'}-500`
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                            }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                                    >
                                        {isSelected && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute top-2 right-2"
                                            >
                                                <Check className={`w-4 h-4 ${format.color}`} />
                                            </motion.div>
                                        )}
                                        <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? format.color : 'text-slate-400'}`} />
                                        <p className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {format.label}
                                        </p>
                                        {isDisabled && (
                                            <Badge variant="secondary" className="mt-2 text-[10px]">
                                                Solo singolo
                                            </Badge>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </div>
                        {selectedFormatInfo && (
                            <p className="text-xs text-slate-500 text-center">
                                {selectedFormatInfo.description}
                            </p>
                        )}
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-slate-700">
                            Includi nell'export
                        </Label>
                        <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <OptionCheckbox
                                id="description"
                                label="Descrizione requisito"
                                checked={options.includeDescription}
                                onChange={() => toggleOption('includeDescription')}
                            />
                            <OptionCheckbox
                                id="activities"
                                label="Breakdown attività per fase"
                                checked={options.includeActivities}
                                onChange={() => toggleOption('includeActivities')}
                            />
                            <OptionCheckbox
                                id="drivers"
                                label="Dettaglio driver con moltiplicatori"
                                checked={options.includeDrivers}
                                onChange={() => toggleOption('includeDrivers')}
                            />
                            <OptionCheckbox
                                id="risks"
                                label="Assessment rischi"
                                checked={options.includeRisks}
                                onChange={() => toggleOption('includeRisks')}
                            />
                            <OptionCheckbox
                                id="aiReasoning"
                                label="Ragionamento AI (se disponibile)"
                                checked={options.includeAiReasoning}
                                onChange={() => toggleOption('includeAiReasoning')}
                                badge="AI"
                            />
                        </div>
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                        <AnimatePresence mode="wait">
                            {isExporting ? (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Generazione in corso...</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="ready"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-center gap-2"
                                >
                                    <FileDown className="w-5 h-5" />
                                    <span>Scarica {selectedFormat.toUpperCase()}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface OptionCheckboxProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: () => void;
    badge?: string;
}

function OptionCheckbox({ id, label, checked, onChange, badge }: OptionCheckboxProps) {
    return (
        <div className="flex items-center gap-3 py-1">
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <Label
                htmlFor={id}
                className="text-sm text-slate-700 cursor-pointer flex items-center gap-2"
            >
                {label}
                {badge && (
                    <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">
                        {badge}
                    </Badge>
                )}
            </Label>
        </div>
    );
}
