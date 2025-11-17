import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Driver } from '@/types/database';

interface DriversSectionProps {
    drivers: Driver[];
    selectedDriverValues: Record<string, string>;
    onDriverChange: (driverCode: string, value: string) => void;
    currentMultiplier: number;
}

export function DriversSection({
    drivers,
    selectedDriverValues,
    onDriverChange,
    currentMultiplier,
}: DriversSectionProps) {
    return (
        <Card className="rounded-lg shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Complexity Drivers</CardTitle>
                        <CardDescription className="text-xs">
                            Select factors that affect the complexity
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">Multiplier</div>
                        <div className="text-xl font-bold text-primary">
                            {currentMultiplier.toFixed(2)}x
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                    {drivers.map((driver) => {
                        const selectedValue = selectedDriverValues[driver.code] || '';
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
                                    onValueChange={(value) => onDriverChange(driver.code, value)}
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
        </Card>
    );
}
