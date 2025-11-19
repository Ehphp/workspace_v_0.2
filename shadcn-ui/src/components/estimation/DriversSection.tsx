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
        <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader
                className="pb-3 bg-gradient-to-r from-pink-50 to-rose-50 cursor-pointer border-b border-pink-100"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold text-slate-900">Complexity Drivers</CardTitle>
                                    <CardDescription className="text-xs">
                                        Factors affecting complexity
                                    </CardDescription>
                                </div>
                                <div className="text-right mr-8">
                                    <div className="text-xs text-slate-500">Multiplier</div>
                                    <div className="text-xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent transition-all duration-300">
                                        {currentMultiplier.toFixed(3)}x
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-pink-600" /> : <ChevronDown className="h-4 w-4 text-pink-600" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {drivers.map((driver) => {
                            const selectedValue = selectedDriverValues[driver.id] || ''; // Use ID
                            const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

                            return (
                                <div key={driver.id} className="p-3 rounded-xl border-2 border-slate-200 hover:border-pink-200 hover:bg-pink-50/30 transition-all duration-300 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-slate-900">
                                            {driver.name}
                                        </label>
                                        {selectedOption && (
                                            <Badge className="bg-gradient-to-r from-pink-600 to-rose-600 border-0">
                                                {selectedOption.multiplier}x
                                            </Badge>
                                        )}
                                    </div>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={(value) => onDriverChange(driver.id, value)} // Pass ID
                                    >
                                        <SelectTrigger className="border-slate-300">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {driver.options.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label} ({option.multiplier}x)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-600 leading-relaxed">
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
