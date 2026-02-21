import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Driver } from '@/types/database';

interface DriversSectionProps {
    drivers: Driver[];
    selectedDriverValues: Record<string, string>; // driver.id -> value
    onDriverChange: (driverId: string, value: string) => void;
    currentMultiplier: number;
    isExpanded?: boolean;
    onToggle?: () => void;
}

export function DriversSection({
    drivers,
    selectedDriverValues,
    onDriverChange,
    currentMultiplier,
}: DriversSectionProps) {
    return (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
            <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">2</span>
                    Driver Complessità
                </h3>
                <div className="text-right flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500">Moltiplicatore</span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        {currentMultiplier.toFixed(3)}x
                    </span>
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-lg border-2 border-slate-200 bg-slate-50/30 p-1.5">
                <div className="space-y-1">
                    {drivers.map((driver) => {
                        const selectedValue = selectedDriverValues[driver.id] || '';
                        const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

                        return (
                            <div key={driver.id} className="bg-white/80 p-1.5 rounded border border-slate-200 flex items-center gap-2">
                                <span className="text-[10px] font-medium text-slate-600 w-24 truncate shrink-0" title={driver.name}>
                                    {driver.name}
                                </span>
                                <Select
                                    value={selectedValue || '_NONE_'}
                                    onValueChange={(v) => onDriverChange(driver.id, v === '_NONE_' ? '' : v)}
                                >
                                    <SelectTrigger className="flex-1 h-6 text-[10px] bg-slate-50/80 border-slate-200">
                                        <SelectValue placeholder="--" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_NONE_" className="text-slate-400 text-[10px]">--</SelectItem>
                                        {driver.options.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-[10px]">
                                                {opt.label} ({opt.multiplier}x)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedOption && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
