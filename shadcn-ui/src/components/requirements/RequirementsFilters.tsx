import type React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Upload, MoreVertical, Trash2, ArrowUpDown, X, Filter } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
    const isFiltered = searchTerm !== '' || filterPriority !== 'all' || filterState !== 'all';

    const handleResetFilters = () => {
        onSearchChange('');
        onPriorityChange('all');
        onStateChange('all');
    };

    return (
        <div className="flex-shrink-0 relative border-b border-slate-200/50 bg-white/60 backdrop-blur-xl z-10">
            <div className="container mx-auto px-6 py-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">

                    {/* Left Side: Search & Filters */}
                    <div className="flex flex-1 flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                        {/* Search */}
                        <div className="relative w-full sm:w-[280px] lg:w-[320px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cerca requisiti..."
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-10 h-10 bg-white/80 border-slate-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            {/* Priority Filter */}
                            <Select value={filterPriority} onValueChange={onPriorityChange}>
                                <SelectTrigger className="w-[130px] h-10 bg-white/80 border-slate-200/80 rounded-xl">
                                    <div className="flex items-center gap-2 truncate">
                                        <Filter className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="truncate">
                                            {filterPriority === 'all' ? 'Priorità' : filterPriority}
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutte</SelectItem>
                                    <SelectItem value="HIGH">Alta</SelectItem>
                                    <SelectItem value="MEDIUM">Media</SelectItem>
                                    <SelectItem value="LOW">Bassa</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* State Filter */}
                            <Select value={filterState} onValueChange={onStateChange}>
                                <SelectTrigger className="w-[130px] h-10 bg-white/80 border-slate-200/80 rounded-xl">
                                    <div className="flex items-center gap-2 truncate">
                                        <Filter className="h-3.5 w-3.5 text-slate-500" />
                                        <span className="truncate">
                                            {filterState === 'all' ? 'Stato' : filterState}
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tutti</SelectItem>
                                    <SelectItem value="PROPOSED">Proposto</SelectItem>
                                    <SelectItem value="SELECTED">Selezionato</SelectItem>
                                    <SelectItem value="SCHEDULED">Pianificato</SelectItem>
                                    <SelectItem value="DONE">Completato</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Reset Filters Button */}
                            {isFiltered && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetFilters}
                                    className="h-10 px-3 text-slate-500 hover:text-slate-900 rounded-xl"
                                >
                                    Reset
                                    <X className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Sort & Actions */}
                    <div className="flex items-center gap-2 ml-auto">
                        <Separator orientation="vertical" className="h-6 hidden lg:block mx-2" />

                        {/* Sort */}
                        <Select value={sortBy} onValueChange={onSortChange}>
                            <SelectTrigger className="w-[160px] h-10 bg-white/80 border-slate-200/80 rounded-xl">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <ArrowUpDown className="h-3.5 w-3.5" />
                                    <span className="truncate">Ordina</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="updated-desc">Più recenti</SelectItem>
                                <SelectItem value="updated-asc">Meno recenti</SelectItem>
                                <SelectItem value="title-asc">Titolo A→Z</SelectItem>
                                <SelectItem value="title-desc">Titolo Z→A</SelectItem>
                                <SelectItem value="priority-desc">Priorità Alta→Bassa</SelectItem>
                                <SelectItem value="priority-asc">Priorità Bassa→Alta</SelectItem>
                                <SelectItem value="estimation-desc">Stima Alta→Bassa</SelectItem>
                                <SelectItem value="estimation-asc">Stima Bassa→Alta</SelectItem>
                                <SelectItem value="state-asc">Stato A→Z</SelectItem>
                                <SelectItem value="state-desc">Stato Z→A</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onImport}
                                className="h-10 w-10 p-0 border-slate-200/80 rounded-xl hover:bg-slate-100"
                                title="Importa Requisiti"
                            >
                                <Upload className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 w-10 p-0 border-slate-200/80 rounded-xl hover:bg-slate-100"
                                        aria-label="Altre opzioni"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 rounded-xl border-slate-200/80 shadow-lg">
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive cursor-pointer rounded-lg"
                                        onClick={onClearAll}
                                        disabled={requirementsCount === 0}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Elimina Tutti
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
