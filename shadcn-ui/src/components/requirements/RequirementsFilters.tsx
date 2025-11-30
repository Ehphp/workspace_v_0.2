import type React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Upload, MoreVertical, Trash2, ArrowUpDown } from 'lucide-react';

interface RequirementsFiltersProps {
    // Search
    searchTerm: string;
    onSearchChange: (term: string) => void;

    // Filters
    filterPriority: string;
    onPriorityChange: (priority: string) => void;
    filterState: string;
    onStateChange: (state: string) => void;

    // Sort
    sortBy: string;
    onSortChange: (sort: string) => void;

    // Actions
    onImport: () => void;
    onClearAll: () => void;
    requirementsCount: number;
}

export function RequirementsFilters({
    searchTerm,
    onSearchChange,
    filterPriority,
    onPriorityChange,
    filterState,
    onStateChange,
    sortBy,
    onSortChange,
    onImport,
    onClearAll,
    requirementsCount,
}: RequirementsFiltersProps) {
    return (
        <div className="flex-shrink-0 relative border-b border-slate-200/60 bg-white/95 backdrop-blur-sm z-10">
            <div className="container mx-auto px-6 py-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            placeholder="Search requirements..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 h-10 border border-slate-300 rounded-md focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm shadow-sm"
                        />
                    </div>

                    {/* Priority Filter */}
                    <Select value={filterPriority} onValueChange={onPriorityChange}>
                        <SelectTrigger className="w-32 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* State Filter */}
                    <Select value={filterState} onValueChange={onStateChange}>
                        <SelectTrigger className="w-32 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                            <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="PROPOSED">Proposed</SelectItem>
                            <SelectItem value="SELECTED">Selected</SelectItem>
                            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                            <SelectItem value="DONE">Done</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Sort */}
                    <Select value={sortBy} onValueChange={onSortChange}>
                        <SelectTrigger className="w-44 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                            <SelectItem value="updated-desc">Most Recent</SelectItem>
                            <SelectItem value="updated-asc">Oldest</SelectItem>
                            <SelectItem value="title-asc">Title A→Z</SelectItem>
                            <SelectItem value="title-desc">Title Z→A</SelectItem>
                            <SelectItem value="priority-desc">Priority High→Low</SelectItem>
                            <SelectItem value="priority-asc">Priority Low→High</SelectItem>
                            <SelectItem value="estimation-desc">Estimation High→Low</SelectItem>
                            <SelectItem value="estimation-asc">Estimation Low→High</SelectItem>
                            <SelectItem value="state-asc">State A→Z</SelectItem>
                            <SelectItem value="state-desc">State Z→A</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-auto">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onImport}
                            className="hover:bg-white/60 h-10"
                        >
                            <Upload className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="hover:bg-white/60 h-10"
                                    aria-label="More options"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-md border-slate-200/50">
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive cursor-pointer"
                                    onClick={onClearAll}
                                    disabled={requirementsCount === 0}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </div>
    );
}
