import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequirementActions, type EditedData } from '@/hooks/useRequirementActions';
import type { Requirement, TechnologyPreset } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface RequirementInfoProps {
    requirement: Requirement;
    presets: TechnologyPreset[];
    refetchRequirement: () => Promise<void>;
}

export function RequirementInfo({ requirement, presets, refetchRequirement }: RequirementInfoProps) {
    const { user } = useAuth();
    const { saveDetails, isSavingSection } = useRequirementActions({ requirement, user, refetchRequirement });
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<Pick<EditedData, 'business_owner' | 'labels' | 'tech_preset_id'>>({
        business_owner: requirement.business_owner || '',
        labels: requirement.labels || [],
        tech_preset_id: requirement.tech_preset_id,
    });

    const handleSave = async () => {
        await saveDetails(editedData, () => setIsEditing(false));
    };

    const handleCancel = () => {
        setEditedData({
            business_owner: requirement.business_owner || '',
            labels: requirement.labels || [],
            tech_preset_id: requirement.tech_preset_id,
        });
        setIsEditing(false);
    };

    const selectedPresetName = presets.find(p => p.id === requirement.tech_preset_id)?.name || 'None';

    return (
        <Card className="shadow-sm border-slate-200 h-fit">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800">Details</CardTitle>
                    {!isEditing && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="text-slate-500 hover:text-blue-600"
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {isEditing ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="space-y-2">
                            <Label>Business Owner</Label>
                            <Input
                                value={editedData.business_owner}
                                onChange={(e) => setEditedData({ ...editedData, business_owner: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Technology Preset</Label>
                            <Select
                                value={editedData.tech_preset_id || 'none'}
                                onValueChange={(value) => setEditedData({ ...editedData, tech_preset_id: value === 'none' ? null : value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select technology" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {presets.map((preset) => (
                                        <SelectItem key={preset.id} value={preset.id}>
                                            {preset.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Labels (comma separated)</Label>
                            <Input
                                value={editedData.labels.join(', ')}
                                onChange={(e) => setEditedData({ ...editedData, labels: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                placeholder="e.g. frontend, backend, api"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancel}
                                disabled={isSavingSection('details')}
                            >
                                <X className="h-4 w-4 mr-1.5" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSavingSection('details')}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Save className="h-4 w-4 mr-1.5" />
                                Save
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Labels</div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {requirement.labels && requirement.labels.length > 0 ? (
                                    requirement.labels.map((label, i) => (
                                        <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                                            {label}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm text-slate-400">-</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1 pt-4 border-t border-slate-100">
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Created</span>
                                <span>{new Date(requirement.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Updated</span>
                                <span>{new Date(requirement.updated_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
