import { useState } from 'react';
import { ArrowLeft, Pencil, Save, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequirementActions, type EditedData } from '@/hooks/useRequirementActions';
import type { Requirement } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PriorityBadge, StateBadge } from '@/components/shared/RequirementBadges';

interface RequirementHeaderProps {
    requirement: Requirement;
    onBack: () => void;
    refetchRequirement: () => Promise<void>;
    onQuickEstimate: () => void;
    isQuickEstimating: boolean;
}

export function RequirementHeader({ requirement, onBack, refetchRequirement, onQuickEstimate, isQuickEstimating }: RequirementHeaderProps) {
    const { user } = useAuth();
    const { saveHeader, isSavingSection } = useRequirementActions({ requirement, user, refetchRequirement });
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<Pick<EditedData, 'title' | 'priority' | 'state'>>({
        title: requirement.title,
        priority: requirement.priority,
        state: requirement.state,
    });

    const handleSave = async () => {
        await saveHeader(editedData, () => setIsEditing(false));
    };

    const handleCancel = () => {
        setEditedData({
            title: requirement.title,
            priority: requirement.priority,
            state: requirement.state,
        });
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col gap-3 mb-2">
            <div className="flex items-start gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="mt-1 shrink-0 hover:bg-slate-100 rounded-full transition-colors"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-5 w-5 text-slate-500" />
                </Button>

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Input
                                value={editedData.title}
                                onChange={(e) => setEditedData({ ...editedData, title: e.target.value })}
                                className="text-2xl font-bold h-auto py-2 px-3 bg-white shadow-sm border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                                placeholder="Requirement title"
                                autoFocus
                            />
                            <div className="flex items-center gap-3">
                                <Select
                                    value={editedData.priority}
                                    onValueChange={(value) => setEditedData({ ...editedData, priority: value })}
                                >
                                    <SelectTrigger className="w-[140px] bg-white shadow-sm border-slate-200">
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low Priority</SelectItem>
                                        <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                                        <SelectItem value="HIGH">High Priority</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={editedData.state}
                                    onValueChange={(value) => setEditedData({ ...editedData, state: value })}
                                >
                                    <SelectTrigger className="w-[140px] bg-white shadow-sm border-slate-200">
                                        <SelectValue placeholder="State" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CREATED">Created</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="DONE">Done</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex items-center gap-2 ml-auto">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCancel}
                                        disabled={isSavingSection('header')}
                                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                    >
                                        <X className="h-4 w-4 mr-1.5" />
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={isSavingSection('header')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                                    >
                                        <Save className="h-4 w-4 mr-1.5" />
                                        {isSavingSection('header') ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="group relative rounded-xl -ml-2 p-2 hover:bg-slate-50/80 transition-all duration-200 border border-transparent hover:border-slate-200/50">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                                            {requirement.title}
                                        </h1>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsEditing(true)}
                                            className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <PriorityBadge priority={requirement.priority} />
                                        <StateBadge state={requirement.state} />
                                        <span className="text-sm text-slate-400 font-medium px-2 border-l border-slate-200">
                                            {requirement.req_id}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={onQuickEstimate}
                                    disabled={isQuickEstimating || !requirement.description}
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Quick Estimate: AI suggests activities only (no drivers/risks). Review and save when ready."
                                >
                                    {isQuickEstimating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                            <span className="text-xs font-medium">Estimating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-3 w-3 mr-1" />
                                            <span className="text-xs font-medium">Quick Estimate</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
