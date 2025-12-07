import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, Settings, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useRequirementActions } from '@/hooks/useRequirementActions';
import type { Requirement, TechnologyPreset } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PriorityBadge, StateBadge } from '@/components/shared/RequirementBadges';
import { useWorkflow } from '@/hooks/workflow/useWorkflow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RequirementHeaderProps {
    requirement: Requirement;
    onBack: () => void;
    refetchRequirement: () => Promise<void>;
    presets?: TechnologyPreset[];
}

export function RequirementHeader({ requirement, onBack, refetchRequirement, presets = [] }: RequirementHeaderProps) {
    const { user } = useAuth();
    const { saveHeader } = useRequirementActions({ requirement, user, refetchRequirement });
    const { availableTransitions, canTransition } = useWorkflow(requirement);

    // Title Editing State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(requirement.title);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Owner Editing State
    const [isEditingOwner, setIsEditingOwner] = useState(false);
    const [tempOwner, setTempOwner] = useState(requirement.business_owner || '');
    const ownerInputRef = useRef<HTMLInputElement>(null);

    // Optimistic State
    const [currentPriority, setCurrentPriority] = useState(requirement.priority);
    const [currentState, setCurrentState] = useState(requirement.state);
    const [currentTechId, setCurrentTechId] = useState(requirement.tech_preset_id);

    useEffect(() => {
        setTempTitle(requirement.title);
    }, [requirement.title]);

    useEffect(() => {
        setTempOwner(requirement.business_owner || '');
    }, [requirement.business_owner]);

    useEffect(() => {
        setCurrentPriority(requirement.priority);
    }, [requirement.priority]);

    useEffect(() => {
        setCurrentState(requirement.state);
    }, [requirement.state]);

    useEffect(() => {
        setCurrentTechId(requirement.tech_preset_id);
    }, [requirement.tech_preset_id]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        if (isEditingOwner && ownerInputRef.current) {
            ownerInputRef.current.focus();
        }
    }, [isEditingOwner]);

    const handleSaveTitle = async () => {
        if (tempTitle.trim() === requirement.title) {
            setIsEditingTitle(false);
            return;
        }

        if (!tempTitle.trim()) {
            toast.error("Title cannot be empty");
            return;
        }

        await saveHeader({
            title: tempTitle,
            priority: currentPriority,
            state: currentState,
            business_owner: tempOwner,
            tech_preset_id: currentTechId
        }, () => setIsEditingTitle(false));
    };

    const handleKeyDownTitle = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveTitle();
        if (e.key === 'Escape') {
            setTempTitle(requirement.title);
            setIsEditingTitle(false);
        }
    };

    const handleSaveOwner = async () => {
        const newOwner = tempOwner.trim();
        if (newOwner === (requirement.business_owner || '')) {
            setIsEditingOwner(false);
            return;
        }

        await saveHeader({
            title: requirement.title,
            priority: currentPriority,
            state: currentState,
            business_owner: newOwner,
            tech_preset_id: currentTechId
        }, () => setIsEditingOwner(false));
    };

    const handleKeyDownOwner = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveOwner();
        if (e.key === 'Escape') {
            setTempOwner(requirement.business_owner || '');
            setIsEditingOwner(false);
        }
    };

    const handlePriorityChange = async (value: string) => {
        if (value === currentPriority) return;
        setCurrentPriority(value as Requirement['priority']); // Optimistic

        await saveHeader({
            title: requirement.title,
            priority: value,
            state: currentState,
            business_owner: tempOwner,
            tech_preset_id: currentTechId
        }, () => { });
    };

    const handleStateChange = async (value: string) => {
        if (value === currentState) return;

        const check = canTransition(value as any);
        if (!check.allowed) {
            console.error("Transition not allowed:", check.reason);
            toast.error(`Cannot transition: ${check.reason}`);
            return;
        }

        setCurrentState(value as Requirement['state']); // Optimistic

        await saveHeader({
            title: requirement.title,
            priority: currentPriority,
            state: value,
            business_owner: tempOwner,
            tech_preset_id: currentTechId
        }, () => { });
    };

    const handleTechnologyChange = async (value: string) => {
        const newValue = value === 'none' ? null : value;
        if (newValue === currentTechId) return;

        setCurrentTechId(newValue); // Optimistic

        await saveHeader({
            title: requirement.title,
            priority: currentPriority,
            state: currentState,
            business_owner: tempOwner,
            tech_preset_id: newValue
        }, () => { });
    };

    // Calculate current state options based on workflow
    const stateOptions = [
        { value: currentState, label: 'Current: ' + currentState.replace('_', ' '), isAllowed: true },
        ...availableTransitions.map(t => ({
            value: t.to,
            label: t.label,
            isAllowed: t.isAllowed,
            reasons: (t as any).reasons
        }))
    ];
    // Remove duplicates
    const uniqueStateOptions = stateOptions.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);

    const currentPreset = presets.find(p => p.id === currentTechId);

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
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                            {/* Title Section */}
                            <div className="flex items-center gap-3 min-h-[40px]">
                                {isEditingTitle ? (
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        value={tempTitle}
                                        onChange={(e) => setTempTitle(e.target.value)}
                                        className="text-3xl font-bold text-slate-900 tracking-tight leading-tight outline-none bg-white border-b-2 border-blue-500 w-full px-1"
                                        onBlur={handleSaveTitle}
                                        onKeyDown={handleKeyDownTitle}
                                    />
                                ) : (
                                    <h1
                                        onClick={() => setIsEditingTitle(true)}
                                        className={cn(
                                            "text-3xl font-bold text-slate-900 tracking-tight leading-tight cursor-pointer hover:bg-slate-100/50 rounded px-1 -ml-1 transition-colors border border-transparent hover:border-slate-200",
                                            !titleInputRef.current && "truncate"
                                        )}
                                        title="Click to edit title"
                                    >
                                        {requirement.title}
                                    </h1>
                                )}
                            </div>

                            {/* Badges Section */}
                            <div className="flex items-center gap-3">
                                {/* Priority Dropdown */}
                                <Select
                                    value={currentPriority}
                                    onValueChange={handlePriorityChange}
                                >
                                    <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-slate-100/50 rounded focus:ring-0 [&>svg]:hidden transition-colors">
                                        <PriorityBadge priority={currentPriority as any} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low Priority</SelectItem>
                                        <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                                        <SelectItem value="HIGH">High Priority</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* State Dropdown */}
                                <Select
                                    value={currentState}
                                    onValueChange={handleStateChange}
                                >
                                    <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-slate-100/50 rounded focus:ring-0 [&>svg]:hidden transition-colors">
                                        <StateBadge state={currentState as any} />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-[200px]">
                                        {uniqueStateOptions.length === 0 ? (
                                            <div className="px-2 py-1.5 text-xs text-slate-500">No transitions available</div>
                                        ) : (
                                            uniqueStateOptions.map((opt) => (
                                                <div key={opt.value}>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <SelectItem
                                                                    value={opt.value}
                                                                    disabled={!opt.isAllowed && opt.value !== currentState}
                                                                    className="flex items-center justify-between w-full"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{opt.label}</span>
                                                                        {(!opt.isAllowed && opt.value !== currentState) && (
                                                                            <Lock className="h-3 w-3 text-slate-400" />
                                                                        )}
                                                                    </div>
                                                                </SelectItem>
                                                            </TooltipTrigger>
                                                            {(!opt.isAllowed && opt.value !== currentState && (opt as any).reasons?.length > 0) && (
                                                                <TooltipContent side="right">
                                                                    <div className="text-xs">
                                                                        {/* @ts-ignore */}
                                                                        {(opt as any).reasons.map((r: string, i: number) => (
                                                                            <div key={i}>• {r}</div>
                                                                        ))}
                                                                    </div>
                                                                </TooltipContent>
                                                            )}
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>

                                <span className="text-sm text-slate-400 font-medium px-2 border-l border-slate-200">
                                    {requirement.req_id}
                                </span>
                            </div>
                        </div>

                        {/* Owner and Technology Inline Editing */}
                        <div className="flex items-center gap-3">
                            {/* Owner Field */}
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm border border-slate-200 min-w-[150px]">
                                <div className="p-1.5 bg-blue-50 rounded">
                                    <User className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="leading-tight flex-1">
                                    <div className="text-[10px] uppercase text-slate-500 font-medium">Owner</div>
                                    {isEditingOwner ? (
                                        <input
                                            ref={ownerInputRef}
                                            type="text"
                                            value={tempOwner}
                                            onChange={(e) => setTempOwner(e.target.value)}
                                            className="text-sm font-semibold text-slate-900 outline-none bg-transparent border-b border-blue-500 w-full px-0 py-0"
                                            onBlur={handleSaveOwner}
                                            onKeyDown={handleKeyDownOwner}
                                        />
                                    ) : (
                                        <div
                                            onClick={() => setIsEditingOwner(true)}
                                            className="text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-50 rounded px-1 -ml-1 transition-colors truncate"
                                            title="Click to edit owner"
                                        >
                                            {requirement.business_owner || 'N/A'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Technology Field */}
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow-sm border border-slate-200 min-w-[180px]">
                                <div className="p-1.5 bg-purple-50 rounded">
                                    <Settings className="h-4 w-4 text-purple-600" />
                                </div>
                                <div className="leading-tight flex-1">
                                    <div className="text-[10px] uppercase text-slate-500 font-medium">Technology</div>
                                    <Select
                                        value={currentTechId || 'none'}
                                        onValueChange={handleTechnologyChange}
                                    >
                                        <SelectTrigger className="w-full h-auto p-0 border-0 bg-transparent hover:bg-slate-50 rounded focus:ring-0 [&>svg]:hidden transition-colors px-1 -ml-1">
                                            <div className="text-sm font-semibold text-slate-900 truncate text-left">
                                                {currentPreset?.name || 'Not set'}
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not set</SelectItem>
                                            {presets.map((preset) => (
                                                <SelectItem key={preset.id} value={preset.id}>
                                                    {preset.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
