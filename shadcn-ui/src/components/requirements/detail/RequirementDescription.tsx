import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequirementActions } from '@/hooks/useRequirementActions';
import type { Requirement } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';

interface RequirementDescriptionProps {
    requirement: Requirement;
    refetchRequirement: () => Promise<void>;
}

export function RequirementDescription({ requirement, refetchRequirement }: RequirementDescriptionProps) {
    const { user } = useAuth();
    const { saveDescription, isSavingSection } = useRequirementActions({ requirement, user, refetchRequirement });
    const [isEditing, setIsEditing] = useState(false);
    const [description, setDescription] = useState(requirement.description || '');

    const handleSave = async () => {
        await saveDescription(description, () => setIsEditing(false));
    };

    const handleCancel = () => {
        setDescription(requirement.description || '');
        setIsEditing(false);
    };

    return (
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        Description
                    </CardTitle>
                    {!isEditing && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsEditing(true)}
                                className="text-slate-500 hover:text-blue-600"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[200px] font-mono text-sm leading-relaxed resize-y"
                            placeholder="Describe the requirement in detail..."
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancel}
                                disabled={isSavingSection('description')}
                            >
                                <X className="h-4 w-4 mr-1.5" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSavingSection('description')}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Save className="h-4 w-4 mr-1.5" />
                                {isSavingSection('description') ? 'Saving...' : 'Save Description'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="prose prose-sm max-w-none text-slate-600">
                        {requirement.description ? (
                            <div className="whitespace-pre-wrap">{requirement.description}</div>
                        ) : (
                            <div className="text-slate-400 italic">No description provided. Click edit to add one.</div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
