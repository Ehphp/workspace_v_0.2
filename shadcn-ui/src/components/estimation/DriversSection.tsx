import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Driver } from '@/types/database';

interface DriversSectionProps {
    drivers: Driver[];
    selectedDriverValues: Record<string, string>; // driver.id -> value
    onDriverChange: (driverId: string, value: string) => void; // Use ID instead of code
    currentMultiplier: number;
    isExpanded: boolean;
    onToggle: () => void;
}

export function DriversSection({
    drivers,
    selectedDriverValues,
    onDriverChange,
    currentMultiplier,
    isExpanded,
    onToggle,
}: DriversSectionProps) {
    return (
        <Card className="rounded-lg shadow-sm border-slate-200 bg-white">
            <CardHeader
                className="pb-2 pt-3 px-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-6 h-6 rounded bg-pink-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xs font-semibold text-slate-900">Complexity Drivers</CardTitle>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500">Multiplier</div>
                                    <div className="text-sm font-bold text-pink-600">
                                        {currentMultiplier.toFixed(3)}x
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="px-3 pb-3 pt-0">
                    <div className="grid gap-2 md:grid-cols-2">
                        {drivers.map((driver) => {
                            const selectedValue = selectedDriverValues[driver.id] || ''; // Use ID
                            const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

                            return (
                                <div key={driver.id} className="p-2 rounded border border-slate-200 hover:border-pink-200 hover:bg-pink-50/30 transition-colors space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-900">
                                            {driver.name}
                                        </label>
                                        {selectedOption && (
                                            <Badge className="text-[10px] h-4 px-1 bg-pink-600">
                                                {selectedOption.multiplier}x
                                            </Badge>
                                        )}
                                    </div>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={(value) => onDriverChange(driver.id, value)} // Pass ID
                                    >
                                        <SelectTrigger className="h-7 text-xs">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {driver.options.map((option) => (
                                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                                    {option.label} ({option.multiplier}x)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                                        {driver.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
