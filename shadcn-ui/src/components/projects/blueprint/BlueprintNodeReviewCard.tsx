/**
 * BlueprintNodeReviewCard — per-node structured curation card
 *
 * Supports: confirm, reject, reclassify, edit, and evidence display.
 * Used in the CreateProjectFromSources review phase and in the
 * ProjectBlueprintTab for post-creation curation.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Check,
    X,
    Pencil,
    ChevronDown,
    ChevronUp,
    FileText,
    AlertTriangle,
    Shield,
} from 'lucide-react';
import type {
    BlueprintComponent,
    BlueprintDataDomain,
    BlueprintIntegration,
    BlueprintComponentType,
    IntegrationDirection,
    CriticalityLevel,
    ReviewStatus,
    EvidenceRef,
} from '@/types/project-technical-blueprint';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_TYPES: { value: BlueprintComponentType; label: string }[] = [
    // Generic
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'database', label: 'Database' },
    { value: 'integration', label: 'Integration' },
    { value: 'reporting', label: 'Reporting' },
    { value: 'security', label: 'Security' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'external_system', label: 'External System' },
    { value: 'other', label: 'Other' },
    // Power Platform
    { value: 'canvas_app', label: 'Canvas App' },
    { value: 'model_driven_app', label: 'Model-Driven App' },
    { value: 'dataverse_table', label: 'Dataverse Table' },
    { value: 'custom_connector', label: 'Custom Connector' },
    { value: 'cloud_flow', label: 'Cloud Flow' },
    { value: 'power_automate_desktop', label: 'Power Automate Desktop' },
    { value: 'pcf_control', label: 'PCF Control' },
    // Backend
    { value: 'api_controller', label: 'API Controller' },
    { value: 'service_layer', label: 'Service Layer' },
    { value: 'repository', label: 'Repository' },
    { value: 'middleware', label: 'Middleware' },
    { value: 'queue_processor', label: 'Queue Processor' },
    { value: 'scheduled_job', label: 'Scheduled Job' },
    // Frontend
    { value: 'page', label: 'Page' },
    { value: 'component_library', label: 'Component Library' },
    { value: 'state_manager', label: 'State Manager' },
    { value: 'form', label: 'Form' },
    { value: 'data_grid', label: 'Data Grid' },
];

const DIRECTION_OPTIONS: { value: IntegrationDirection; label: string }[] = [
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'bidirectional', label: 'Bidirectional' },
    { value: 'unknown', label: 'Unknown' },
];

const CRITICALITY_OPTIONS: { value: CriticalityLevel; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

type NodeKind = 'component' | 'data_domain' | 'integration';

const KIND_COLORS: Record<NodeKind, { bg: string; border: string; badge: string }> = {
    component: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
    data_domain: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
    integration: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
};

const KIND_LABELS: Record<NodeKind, string> = {
    component: 'Component',
    data_domain: 'Data Domain',
    integration: 'Integration',
};

const REVIEW_STATUS_STYLES: Record<ReviewStatus, { bg: string; label: string }> = {
    draft: { bg: 'bg-slate-100 text-slate-600', label: 'Draft' },
    reviewed: { bg: 'bg-blue-100 text-blue-700', label: 'Reviewed' },
    approved: { bg: 'bg-emerald-100 text-emerald-700', label: 'Approved' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface BlueprintNodeReviewCardProps {
    kind: NodeKind;
    node: BlueprintComponent | BlueprintDataDomain | BlueprintIntegration;
    index: number;
    qualityFlags?: string[];
    onUpdate: (index: number, patch: Record<string, unknown>) => void;
    onRemove: (index: number) => void;
    onApprove: (index: number) => void;
    onReject: (index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BlueprintNodeReviewCard({
    kind,
    node,
    index,
    qualityFlags,
    onUpdate,
    onRemove,
    onApprove,
    onReject,
}: BlueprintNodeReviewCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);

    const colors = KIND_COLORS[kind];
    const name = kind === 'integration'
        ? (node as BlueprintIntegration).systemName
        : (node as BlueprintComponent | BlueprintDataDomain).name;
    const reviewStatus = node.reviewStatus ?? 'draft';
    const statusStyle = REVIEW_STATUS_STYLES[reviewStatus];
    const evidence = node.evidence ?? [];
    const confidence = node.confidence;

    // Find node-relevant quality flags
    const nodeFlags = (qualityFlags ?? []).filter((f) => {
        if (f === 'core_node_without_evidence' && evidence.length === 0) return true;
        if (f === 'weak_evidence' && evidence.length > 0 && evidence.every(e => e.snippet.length < 20)) return true;
        return false;
    });

    const handleApprove = () => {
        onUpdate(index, { reviewStatus: 'approved' as ReviewStatus });
        onApprove(index);
    };

    const handleReject = () => {
        onReject(index);
    };

    const handleFieldChange = (field: string, value: unknown) => {
        onUpdate(index, { [field]: value });
    };

    return (
        <div className={`rounded-lg border ${colors.border} ${reviewStatus === 'approved' ? 'opacity-80' : ''} transition-all`}>
            {/* Header row */}
            <div className={`flex items-center gap-2 px-3 py-2 ${colors.bg} rounded-t-lg`}>
                <Badge className={`${colors.badge} text-[10px] px-1.5 py-0 h-4 font-semibold`}>
                    {KIND_LABELS[kind]}
                </Badge>
                <span className="text-sm font-semibold text-slate-900 truncate flex-1">
                    {name || 'Unnamed'}
                </span>

                {/* Confidence */}
                {confidence != null && (
                    <span className="text-[10px] text-slate-500 tabular-nums">
                        {Math.round(confidence * 100)}%
                    </span>
                )}

                {/* Review status badge */}
                <Badge className={`${statusStyle.bg} text-[10px] px-1.5 py-0 h-4`}>
                    {statusStyle.label}
                </Badge>

                {/* Quality flag indicator */}
                {nodeFlags.length > 0 && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 ml-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-emerald-600 hover:bg-emerald-50"
                        onClick={handleApprove}
                        title="Approve"
                    >
                        <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-400 hover:bg-slate-100"
                        onClick={() => setEditing(!editing)}
                        title="Edit"
                    >
                        <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-400 hover:bg-red-50"
                        onClick={handleReject}
                        title="Reject & remove"
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-400"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            </div>

            {/* Description line (always visible if present) */}
            {node.description && !editing && (
                <div className="px-3 py-1.5 text-xs text-slate-600 border-t border-slate-100">
                    {node.description}
                </div>
            )}

            {/* Expanded: evidence + details */}
            {expanded && !editing && (
                <div className="px-3 py-2 space-y-2 border-t border-slate-100">
                    {/* Evidence */}
                    {evidence.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Evidence ({evidence.length})
                            </p>
                            <div className="space-y-1">
                                {evidence.map((ev, ei) => (
                                    <div key={ei} className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 border-l-2 border-blue-300 italic">
                                        "{ev.snippet}"
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {evidence.length === 0 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> No evidence — this node was inferred without textual support
                        </p>
                    )}

                    {/* Criticality / Impact */}
                    <div className="flex gap-3 text-[10px]">
                        {node.businessCriticality && (
                            <span className="text-slate-500">
                                <Shield className="w-3 h-3 inline mr-0.5" />
                                Criticality: <span className="font-medium text-slate-700">{node.businessCriticality}</span>
                            </span>
                        )}
                        {node.estimationImpact && (
                            <span className="text-slate-500">
                                Impact: <span className="font-medium text-slate-700">{node.estimationImpact}</span>
                            </span>
                        )}
                        {node.changeLikelihood && (
                            <span className="text-slate-500">
                                Change: <span className="font-medium text-slate-700">{node.changeLikelihood}</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Editing mode */}
            {editing && (
                <div className="px-3 py-2 space-y-2 border-t border-slate-100 bg-white">
                    {/* Name */}
                    <div className="grid grid-cols-2 gap-2">
                        <Input
                            value={name}
                            onChange={(e) =>
                                handleFieldChange(
                                    kind === 'integration' ? 'systemName' : 'name',
                                    e.target.value,
                                )
                            }
                            placeholder="Name"
                            className="text-sm h-7"
                        />
                        {/* Type / Direction */}
                        {kind === 'component' && (
                            <Select
                                value={(node as BlueprintComponent).type}
                                onValueChange={(v) => handleFieldChange('type', v)}
                            >
                                <SelectTrigger className="text-xs h-7">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMPONENT_TYPES.map((ct) => (
                                        <SelectItem key={ct.value} value={ct.value}>
                                            {ct.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {kind === 'integration' && (
                            <Select
                                value={(node as BlueprintIntegration).direction ?? 'unknown'}
                                onValueChange={(v) => handleFieldChange('direction', v)}
                            >
                                <SelectTrigger className="text-xs h-7">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIRECTION_OPTIONS.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                            {d.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Description */}
                    <Input
                        value={node.description ?? ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        placeholder="Description"
                        className="text-sm h-7"
                    />

                    {/* Criticality */}
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Criticality</label>
                            <Select
                                value={node.businessCriticality ?? '__NONE__'}
                                onValueChange={(v) => handleFieldChange('businessCriticality', v === '__NONE__' ? undefined : v)}
                            >
                                <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__NONE__">—</SelectItem>
                                    {CRITICALITY_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Est. Impact</label>
                            <Select
                                value={node.estimationImpact ?? '__NONE__'}
                                onValueChange={(v) => handleFieldChange('estimationImpact', v === '__NONE__' ? undefined : v)}
                            >
                                <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__NONE__">—</SelectItem>
                                    {CRITICALITY_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Change Likelihood</label>
                            <Select
                                value={node.changeLikelihood ?? '__NONE__'}
                                onValueChange={(v) => handleFieldChange('changeLikelihood', v === '__NONE__' ? undefined : v)}
                            >
                                <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__NONE__">—</SelectItem>
                                    {CRITICALITY_OPTIONS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => setEditing(false)}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
