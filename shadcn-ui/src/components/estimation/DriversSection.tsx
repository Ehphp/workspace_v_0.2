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
                className="pb-3 bg-gradient-to-r from-slate-50 to-blue-50 cursor-pointer"
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-semibold text-slate-900">Complexity Drivers</CardTitle>
                                <CardDescription className="text-xs">
                                    Select factors that affect the complexity
                                </CardDescription>
                            </div>
                            <div className="text-right mr-8">
                                <div className="text-xs text-muted-foreground">Multiplier</div>
                                <div className="text-xl font-bold text-primary">
                                    {currentMultiplier.toFixed(2)}x
                                </div>
                            </div>
                        </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                        {drivers.map((driver) => {
                            const selectedValue = selectedDriverValues[driver.id] || ''; // Use ID
                            const selectedOption = driver.options.find((opt) => opt.value === selectedValue);

                            return (
                                <div key={driver.id} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">
                                            {driver.name}
                                        </label>
                                        {selectedOption && (
                                            <Badge variant="outline">
                                                {selectedOption.multiplier}x
                                            </Badge>
                                        )}
                                    </div>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={(value) => onDriverChange(driver.id, value)} // Pass ID
                                    >
                                        <SelectTrigger>
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
                                    <p className="text-xs text-muted-foreground">
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
