import { useState } from 'react';
import { ArrowLeft, Pencil, Save, X, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequirementActions, type EditedData } from '@/hooks/useRequirementActions';
import type { Requirement, TechnologyPreset } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PriorityBadge, StateBadge } from '@/components/shared/RequirementBadges';

interface RequirementHeaderProps {
    requirement: Requirement;
    onBack: () => void;
    refetchRequirement: () => Promise<void>;
    presets?: TechnologyPreset[];
}

export function RequirementHeader({ requirement, onBack, refetchRequirement, presets = [] }: RequirementHeaderProps) {
    const { user } = useAuth();
    const { saveHeader, isSavingSection } = useRequirementActions({ requirement, user, refetchRequirement });
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState({
        title: requirement.title,
        priority: requirement.priority,
        state: requirement.state,
    });
    const [displayData, setDisplayData] = useState({
        title: requirement.title,
        priority: requirement.priority,
        state: requirement.state,
    });

    const handleSave = async () => {
        // Optimistic update - apply immediately to UI
        setDisplayData({
            title: editedData.title,
            priority: editedData.priority as typeof requirement.priority,
            state: editedData.state as typeof requirement.state,
        });
        setIsEditing(false);

        // Save in background
        await saveHeader(editedData, () => { });
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
                {!isEditing && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1 shrink-0 hover:bg-slate-100 rounded-full transition-colors"
                        onClick={onBack}
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-500" />
                    </Button>
                )}

                <div className={`flex-1 min-w-0 ${isEditing ? 'ml-12' : ''}`}>
                    <div className="group relative rounded-xl -ml-2 p-2 hover:bg-slate-50/80 transition-all duration-200 border border-transparent hover:border-slate-200/50">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedData.title}
                                            onChange={(e) => setEditedData({ ...editedData, title: e.target.value })}
                                            className="text-3xl font-bold text-slate-900 tracking-tight leading-tight outline-none bg-transparent w-full"
                                            placeholder="Requirement title"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSave();
                                                if (e.key === 'Escape') handleCancel();
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                                                {displayData.title}
                                            </h1>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEditedData(displayData);
                                                    setIsEditing(true);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {isEditing ? (
                                        <div className="relative group/badge cursor-pointer">
                                            <Select
                                                value={editedData.priority}
                                                onValueChange={(value) => setEditedData({ ...editedData, priority: value })}
                                            >
                                                <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0 [&>svg]:hidden">
                                                    <PriorityBadge priority={editedData.priority as typeof requirement.priority} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low Priority</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                                                    <SelectItem value="HIGH">High Priority</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <PriorityBadge priority={displayData.priority} />
                                    )}

                                    {isEditing ? (
                                        <div className="relative group/badge cursor-pointer">
                                            <Select
                                                value={editedData.state}
                                                onValueChange={(value) => setEditedData({ ...editedData, state: value })}
                                            >
                                                <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-transparent focus:ring-0 [&>svg]:hidden">
                                                    <StateBadge state={editedData.state as typeof requirement.state} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CREATED">Created</SelectItem>
                                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                                    <SelectItem value="DONE">Done</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <StateBadge state={displayData.state} />
                                    )}

                                    <span className="text-sm text-slate-400 font-medium px-2 border-l border-slate-200">
                                        {requirement.req_id}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCancel}
                                            disabled={isSavingSection('header')}
                                            className="h-7 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md"
                                        >
                                            <X className="h-3 w-3 mr-1" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSave}
                                            disabled={isSavingSection('header')}
                                            className="h-7 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md"
                                        >
                                            <Save className="h-3 w-3 mr-1" />
                                            {isSavingSection('header') ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm border border-slate-200">
                                            <div className="p-1.5 bg-blue-50 rounded">
                                                <User className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div className="leading-tight">
                                                <div className="text-[10px] uppercase text-slate-500 font-medium">Owner</div>
                                                <div className="text-sm font-semibold text-slate-900">{requirement.business_owner || 'N/A'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm border border-slate-200">
                                            <div className="p-1.5 bg-purple-50 rounded">
                                                <Settings className="h-4 w-4 text-purple-600" />
                                            </div>
                                            <div className="leading-tight">
                                                <div className="text-[10px] uppercase text-slate-500 font-medium">Technology</div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {presets.find(p => p.id === requirement.tech_preset_id)?.name || 'Not set'}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
