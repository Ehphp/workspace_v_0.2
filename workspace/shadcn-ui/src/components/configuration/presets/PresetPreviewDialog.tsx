import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { PresetView } from '@/hooks/usePresetManagement';

interface PresetPreviewDialogProps {
    preset: PresetView | null;
    onOpenChange: (open: boolean) => void;
}

export function PresetPreviewDialog({ preset, onOpenChange }: PresetPreviewDialogProps) {
    return (
        <Dialog open={!!preset} onOpenChange={(open) => !open && onOpenChange(false)}>
            <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-slate-900">{preset?.name}</DialogTitle>
                    <DialogDescription className="text-slate-500">{preset?.description}</DialogDescription>
                </DialogHeader>
                {preset && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Badge variant="outline" className="border-slate-200 text-slate-600">{preset.tech_category}</Badge>
                            {preset.is_custom && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Custom</Badge>}
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-slate-900">Attività ({preset.defaultActivities.length})</h4>
                            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 max-h-[200px] overflow-y-auto space-y-1">
                                {preset.defaultActivities.map((a, i) => (
                                    <div key={i} className="text-sm flex justify-between text-slate-700">
                                        <span>{i + 1}. {a.name}</span>
                                        <span className="text-slate-500 text-xs">{a.base_hours}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold text-sm mb-2 text-slate-900">Drivers</h4>
                                <div className="flex flex-wrap gap-1">
                                    {preset.driverDefaults.map(d => (
                                        <Badge key={d.code} variant="outline" className="text-xs border-slate-200 text-slate-600">{d.code}: {d.value}</Badge>
                                    ))}
                                    {preset.driverDefaults.length === 0 && <span className="text-xs text-slate-500">-</span>}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-2 text-slate-900">Rischi</h4>
                                <div className="flex flex-wrap gap-1">
                                    {preset.defaultRisks.map(r => (
                                        <Badge key={r.code} variant="secondary" className="text-xs bg-orange-50 text-orange-800 border border-orange-100">{r.code}</Badge>
                                    ))}
                                    {preset.defaultRisks.length === 0 && <span className="text-xs text-slate-500">-</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
