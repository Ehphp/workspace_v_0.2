import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, Settings, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useRequirementActions } from '@/hooks/useRequirementActions';
import type { Requirement, Technology } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { PriorityBadge, StateBadge } from '@/components/shared/RequirementBadges';
import { useWorkflow } from '@/hooks/workflow/useWorkflow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface RequirementHeaderProps {
    requirement: Requirement;
    onBack: () => void;
    refetchRequirement: () => Promise<void>;
    presets?: Technology[];
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
    const [currentTechId, setCurrentTechId] = useState(requirement.technology_id);

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
        setCurrentTechId(requirement.technology_id);
    }, [requirement.technology_id]);

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
            technology_id: currentTechId
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
            technology_id: currentTechId
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
            technology_id: currentTechId
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
            technology_id: currentTechId
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
            technology_id: newValue
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
        <div className="flex items-center gap-3">
            {/* Back button */}
            <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-slate-100 rounded-lg w-8 h-8"
                onClick={onBack}
            >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
            </Button>

            {/* Title — click to edit */}
            <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="text-lg font-semibold text-slate-900 outline-none bg-white border-b-2 border-blue-500 w-full"
                        onBlur={handleSaveTitle}
                        onKeyDown={handleKeyDownTitle}
                    />
                ) : (
                    <h1
                        onClick={() => setIsEditingTitle(true)}
                        className="text-lg font-semibold text-slate-900 truncate cursor-pointer hover:text-slate-700 transition-colors"
                        title="Clicca per modificare il titolo"
                    >
                        {requirement.title}
                    </h1>
                )}
            </div>

            {/* Inline metadata chips */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Priority */}
                <Select value={currentPriority} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-slate-100/70 rounded-md focus:ring-0 [&>svg]:hidden">
                        <PriorityBadge priority={currentPriority as any} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="LOW">Priorità Bassa</SelectItem>
                        <SelectItem value="MEDIUM">Priorità Media</SelectItem>
                        <SelectItem value="HIGH">Priorità Alta</SelectItem>
                    </SelectContent>
                </Select>

                {/* State */}
                <Select value={currentState} onValueChange={handleStateChange}>
                    <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:bg-slate-100/70 rounded-md focus:ring-0 [&>svg]:hidden">
                        <StateBadge state={currentState as any} />
                    </SelectTrigger>
                    <SelectContent className="min-w-[200px] rounded-xl">
                        {uniqueStateOptions.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">Nessuna transizione disponibile</div>
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

                {/* Req ID */}
                <span className="text-xs text-slate-400 font-mono">{requirement.req_id}</span>

                {/* Separator */}
                <div className="w-px h-5 bg-slate-200" />

                {/* Owner chip */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {isEditingOwner ? (
                        <input
                            ref={ownerInputRef}
                            type="text"
                            value={tempOwner}
                            onChange={(e) => setTempOwner(e.target.value)}
                            className="text-xs font-medium text-slate-900 outline-none bg-white border-b border-blue-500 w-24"
                            onBlur={handleSaveOwner}
                            onKeyDown={handleKeyDownOwner}
                        />
                    ) : (
                        <span
                            onClick={() => setIsEditingOwner(true)}
                            className="font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors truncate max-w-[100px]"
                            title="Clicca per modificare"
                        >
                            {requirement.business_owner || 'N/D'}
                        </span>
                    )}
                </div>

                {/* Technology chip */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Settings className="h-3.5 w-3.5 text-slate-400" />
                    <Select value={currentTechId || 'none'} onValueChange={handleTechnologyChange}>
                        <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent hover:text-blue-600 focus:ring-0 [&>svg]:hidden text-xs font-medium text-slate-700 cursor-pointer transition-colors">
                            {currentPreset?.name || 'N/D'}
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="none">Non impostato</SelectItem>
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
    );
}
