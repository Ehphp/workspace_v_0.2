/**
 * Review Step Component
 * 
 * Allows user to review and edit the generated preset before saving.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    CheckCircle2,
    Edit2,
    Save,
    TrendingUp,
    AlertCircle,
    Sparkles,
    Calendar
} from 'lucide-react';
import type { GeneratedPreset, SuggestedActivity } from '@/types/ai-preset-generation';
import { calculateEstimatedDays, groupActivitiesByPriority } from '@/types/ai-preset-generation';

interface ReviewStepProps {
    preset: GeneratedPreset;
    onSave: () => void;
    onEdit: (preset: GeneratedPreset) => void;
    saving?: boolean;
}

export function ReviewStep({
    preset,
    onSave,
    onEdit,
    saving = false
}: ReviewStepProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedName, setEditedName] = useState(preset.name);
    const [editedDescription, setEditedDescription] = useState(preset.description);

    const grouped = groupActivitiesByPriority(preset.activities);
    const totalDays = calculateEstimatedDays(preset.activities);

    const handleSaveName = () => {
        if (editedName.trim().length >= 3) {
            onEdit({ ...preset, name: editedName.trim() });
            setIsEditingName(false);
        }
    };

    const handleSaveDescription = () => {
        if (editedDescription.trim().length >= 10) {
            onEdit({ ...preset, description: editedDescription.trim() });
            setIsEditingDescription(false);
        }
    };

    const handleToggleActivity = (activityCode: string) => {
        const newActivities = preset.activities.some(a => a.code === activityCode)
            ? preset.activities.filter(a => a.code !== activityCode)
            : [...preset.activities, preset.activities.find(a => a.code === activityCode)!];

        onEdit({ ...preset, activities: newActivities });
    };

    const renderActivitySection = (title: string, activities: SuggestedActivity[], icon: any) => {
        if (activities.length === 0) return null;

        const Icon = icon;

        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-slate-600" />
                    <h4 className="font-semibold text-slate-900">{title}</h4>
                    <Badge variant="outline" className="ml-auto">{activities.length}</Badge>
                </div>
                <div className="space-y-2">
                    {activities.map((activity) => (
                        <div
                            key={activity.code}
                            className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-300 transition-all"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2">
                                    <div className="font-medium text-slate-900">{activity.name}</div>
                                    <Badge variant="secondary" className="text-xs">
                                        {activity.baseDays}d
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className={`text-xs ${activity.confidence >= 0.8 ? 'border-emerald-300 text-emerald-700' :
                                            activity.confidence >= 0.6 ? 'border-blue-300 text-blue-700' :
                                                'border-amber-300 text-amber-700'
                                            }`}
                                    >
                                        {Math.round(activity.confidence * 100)}% conf.
                                    </Badge>
                                </div>
                                {activity.reasoning && (
                                    <p className="text-sm text-slate-600 mt-1">{activity.reasoning}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 pb-4 border-b border-slate-200">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                    Rivedi e Salva il Preset
                </h2>
                <p className="text-slate-600">
                    Controlla il preset generato e apporta modifiche se necessario
                </p>
            </div>

            {/* AI Confidence Alert */}
            <Alert className="border-blue-200 bg-blue-50">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                    <span className="font-semibold">Confidenza AI:</span> {Math.round(preset.confidence * 100)}% - {preset.reasoning}
                </AlertDescription>
            </Alert>

            {/* Preset Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Name */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Nome Preset</label>
                    {isEditingName ? (
                        <div className="flex gap-2">
                            <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="flex-1"
                                autoFocus
                            />
                            <Button onClick={handleSaveName} size="sm" variant="outline">
                                <Save className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold text-slate-900">{preset.name}</div>
                            <Button
                                onClick={() => setIsEditingName(true)}
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                            >
                                <Edit2 className="w-3 h-3" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Descrizione Breve</label>
                    {isEditingDescription ? (
                        <div className="space-y-2">
                            <Textarea
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                rows={2}
                                className="resize-none"
                                autoFocus
                            />
                            <Button onClick={handleSaveDescription} size="sm" variant="outline">
                                <Save className="w-4 h-4 mr-2" />
                                Salva
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-slate-700">{preset.description}</p>
                            <Button
                                onClick={() => setIsEditingDescription(true)}
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                            >
                                <Edit2 className="w-3 h-3" />
                                Modifica
                            </Button>
                        </div>
                    )}
                </div>

                {/* Detailed Description */}
                {preset.detailedDescription && (
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Descrizione Dettagliata</label>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {preset.detailedDescription}
                            </p>
                        </div>
                    </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                    <div className="text-center p-3 rounded-lg bg-slate-50">
                        <div className="text-2xl font-bold text-slate-900">{preset.activities.length}</div>
                        <div className="text-xs text-slate-600">Attività Totali</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-emerald-50">
                        <div className="text-2xl font-bold text-emerald-700">{grouped.core.length}</div>
                        <div className="text-xs text-slate-600">Core</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50">
                        <div className="text-2xl font-bold text-blue-700">{grouped.recommended.length}</div>
                        <div className="text-xs text-slate-600">Recommended</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50">
                        <div className="text-2xl font-bold text-amber-700">{totalDays}</div>
                        <div className="text-xs text-slate-600">Giorni Stimati</div>
                    </div>
                </div>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Attività Selezionate
                </h3>

                {renderActivitySection('Core Activities', grouped.core, CheckCircle2)}
                {renderActivitySection('Recommended Activities', grouped.recommended, Sparkles)}
                {renderActivitySection('Optional Activities', grouped.optional, Calendar)}
            </div>

            {/* Drivers & Risks */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Drivers */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <h4 className="font-semibold text-slate-900">Driver Values</h4>
                    <div className="space-y-2">
                        {Object.entries(preset.driverValues).map(([code, value]) => (
                            <div key={code} className="flex justify-between text-sm">
                                <span className="text-slate-600">{code}:</span>
                                <Badge variant="outline">{value}</Badge>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Risks */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Identified Risks
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {preset.riskCodes.map((code) => (
                            <Badge key={code} variant="destructive" className="text-xs">
                                {code}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Button
                    onClick={onSave}
                    disabled={saving || preset.activities.length < 3}
                    size="lg"
                    className="flex-1 gap-2"
                >
                    {saving ? (
                        <>
                            <Sparkles className="w-5 h-5 animate-spin" />
                            Salvataggio...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Salva Preset
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
