import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Activity, Driver, Risk } from '@/types/database';

interface EstimationComparisonProps {
    estimations: any[];
    activities: Activity[];
    drivers: Driver[];
    risks: Risk[];
}

export function EstimationComparison({ estimations, activities, drivers, risks }: EstimationComparisonProps) {
    const [estimation1Id, setEstimation1Id] = useState<string>('');
    const [estimation2Id, setEstimation2Id] = useState<string>('');

    if (estimations.length < 2) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground text-sm">
                        <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>At least 2 estimations are needed to compare</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const est1 = estimations.find((e) => e.id === estimation1Id);
    const est2 = estimations.find((e) => e.id === estimation2Id);

    const getDifference = (val1: number, val2: number) => {
        const diff = val1 - val2;
        const percent = val2 !== 0 ? ((diff / val2) * 100).toFixed(1) : '0';
        return { diff, percent };
    };

    const renderDifferenceIcon = (diff: number) => {
        if (diff > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
        if (diff < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
        return <Minus className="h-4 w-4 text-gray-400" />;
    };

    const getActivityName = (activityId: string) => {
        return activities.find((a) => a.id === activityId)?.name || 'Unknown';
    };

    const getDriverName = (driverId: string) => {
        return drivers.find((d) => d.id === driverId)?.name || 'Unknown';
    };

    const getRiskName = (riskId: string) => {
        return risks.find((r) => r.id === riskId)?.name || 'Unknown';
    };

    return (
        <div className="space-y-4">
            {/* Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <GitCompare className="h-4 w-4" />
                        Compare Estimations
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Select two estimations to compare their differences
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium mb-2 block">First Estimation</label>
                            <Select value={estimation1Id} onValueChange={setEstimation1Id}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select estimation" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estimations.map((est) => (
                                        <SelectItem key={est.id} value={est.id}>
                                            {est.scenario_name} - {new Date(est.created_at).toLocaleDateString()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-2 block">Second Estimation</label>
                            <Select value={estimation2Id} onValueChange={setEstimation2Id}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select estimation" />
                                </SelectTrigger>
                                <SelectContent>
                                    {estimations.map((est) => (
                                        <SelectItem key={est.id} value={est.id}>
                                            {est.scenario_name} - {new Date(est.created_at).toLocaleDateString()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Comparison Results */}
            {est1 && est2 && (
                <div className="space-y-4">
                    {/* Summary Comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold">Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Total Days</div>
                                    <div className="text-2xl font-bold">{est1.total_days.toFixed(1)}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{est1.scenario_name}</div>
                                </div>
                                <div className="flex items-center justify-center">
                                    {renderDifferenceIcon(est1.total_days - est2.total_days)}
                                    <span className="ml-2 text-sm font-semibold">
                                        {getDifference(est1.total_days, est2.total_days).percent}%
                                    </span>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs text-muted-foreground mb-1">Total Days</div>
                                    <div className="text-2xl font-bold">{est2.total_days.toFixed(1)}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{est2.scenario_name}</div>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
                                <div>
                                    <div className="text-muted-foreground">Base Days</div>
                                    <div className="font-semibold">{est1.base_days.toFixed(1)}</div>
                                </div>
                                <div className="flex items-center justify-center">
                                    {renderDifferenceIcon(est1.base_days - est2.base_days)}
                                </div>
                                <div className="text-right">
                                    <div className="text-muted-foreground">Base Days</div>
                                    <div className="font-semibold">{est2.base_days.toFixed(1)}</div>
                                </div>

                                <div>
                                    <div className="text-muted-foreground">Multiplier</div>
                                    <div className="font-semibold">{est1.driver_multiplier.toFixed(3)}x</div>
                                </div>
                                <div className="flex items-center justify-center">
                                    {renderDifferenceIcon(est1.driver_multiplier - est2.driver_multiplier)}
                                </div>
                                <div className="text-right">
                                    <div className="text-muted-foreground">Multiplier</div>
                                    <div className="font-semibold">{est2.driver_multiplier.toFixed(3)}x</div>
                                </div>

                                <div>
                                    <div className="text-muted-foreground">Risk Score</div>
                                    <div className="font-semibold">{est1.risk_score}</div>
                                </div>
                                <div className="flex items-center justify-center">
                                    {renderDifferenceIcon(est1.risk_score - est2.risk_score)}
                                </div>
                                <div className="text-right">
                                    <div className="text-muted-foreground">Risk Score</div>
                                    <div className="font-semibold">{est2.risk_score}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activities Comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold">Activities</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-xs">
                                {/* Activities only in est1 */}
                                {est1.estimation_activities
                                    ?.filter(
                                        (a1: any) =>
                                            !est2.estimation_activities?.some((a2: any) => a2.activity_id === a1.activity_id)
                                    )
                                    .map((act: any) => (
                                        <div key={act.activity_id} className="flex items-center gap-2">
                                            <Badge variant="destructive" className="text-xs">Removed</Badge>
                                            <span>{getActivityName(act.activity_id)}</span>
                                        </div>
                                    ))}

                                {/* Activities only in est2 */}
                                {est2.estimation_activities
                                    ?.filter(
                                        (a2: any) =>
                                            !est1.estimation_activities?.some((a1: any) => a1.activity_id === a2.activity_id)
                                    )
                                    .map((act: any) => (
                                        <div key={act.activity_id} className="flex items-center gap-2">
                                            <Badge variant="default" className="text-xs">Added</Badge>
                                            <span>{getActivityName(act.activity_id)}</span>
                                        </div>
                                    ))}

                                {est1.estimation_activities?.length === est2.estimation_activities?.length &&
                                    est1.estimation_activities?.every((a1: any) =>
                                        est2.estimation_activities?.some((a2: any) => a2.activity_id === a1.activity_id)
                                    ) && (
                                        <div className="text-muted-foreground text-center py-2">No changes in activities</div>
                                    )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Drivers Comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold">Drivers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-xs">
                                {est1.estimation_drivers?.map((d1: any) => {
                                    const d2 = est2.estimation_drivers?.find((d: any) => d.driver_id === d1.driver_id);
                                    if (!d2 || d1.selected_value === d2.selected_value) return null;

                                    return (
                                        <div key={d1.driver_id} className="flex items-center justify-between">
                                            <span className="font-medium">{getDriverName(d1.driver_id)}</span>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{d1.selected_value}</Badge>
                                                <span>→</span>
                                                <Badge variant="outline">{d2.selected_value}</Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risks Comparison */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold">Risks</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-xs">
                                {/* Risks only in est1 */}
                                {est1.estimation_risks
                                    ?.filter(
                                        (r1: any) => !est2.estimation_risks?.some((r2: any) => r2.risk_id === r1.risk_id)
                                    )
                                    .map((risk: any) => (
                                        <div key={risk.risk_id} className="flex items-center gap-2">
                                            <Badge variant="destructive" className="text-xs">Removed</Badge>
                                            <span>{getRiskName(risk.risk_id)}</span>
                                        </div>
                                    ))}

                                {/* Risks only in est2 */}
                                {est2.estimation_risks
                                    ?.filter(
                                        (r2: any) => !est1.estimation_risks?.some((r1: any) => r1.risk_id === r2.risk_id)
                                    )
                                    .map((risk: any) => (
                                        <div key={risk.risk_id} className="flex items-center gap-2">
                                            <Badge variant="default" className="text-xs">Added</Badge>
                                            <span>{getRiskName(risk.risk_id)}</span>
                                        </div>
                                    ))}

                                {est1.estimation_risks?.length === est2.estimation_risks?.length &&
                                    est1.estimation_risks?.every((r1: any) =>
                                        est2.estimation_risks?.some((r2: any) => r2.risk_id === r1.risk_id)
                                    ) && (
                                        <div className="text-muted-foreground text-center py-2">No changes in risks</div>
                                    )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
