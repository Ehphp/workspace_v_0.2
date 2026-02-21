import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, MoreVertical, Edit, Trash2, Calendar, User } from 'lucide-react';
import { List } from '@/types/database';

interface ProjectCardProps {
    project: List;
    onEdit: (project: List) => void;
    onDelete: (project: List) => void;
    layout?: 'grid' | 'list';
}

export function ProjectCard({ project, onEdit, onDelete, layout = 'grid' }: ProjectCardProps) {
    const navigate = useNavigate();

    const getStatusBorder = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'border-t-emerald-500';
            case 'DRAFT':
                return 'border-t-amber-500';
            case 'ARCHIVED':
                return 'border-t-slate-400';
            default:
                return 'border-t-blue-500';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' };
            case 'DRAFT':
                return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
            case 'ARCHIVED':
                return { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' };
            default:
                return { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' };
        }
    };

    const statusBadge = getStatusBadge(project.status);

    if (layout === 'list') {
        return (
            <div
                className={`group bg-white rounded-lg border border-slate-200 border-l-4 ${getStatusBorder(project.status).replace('border-t-', 'border-l-')} hover:shadow-sm hover:border-slate-300 transition-all cursor-pointer`}
                onClick={() => navigate(`/dashboard/${project.id}/requirements`)}
            >
                <div className="flex items-center gap-3 p-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FolderOpen className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-5">
                            <h3 className="font-semibold text-slate-800 truncate text-sm group-hover:text-blue-700 transition-colors">{project.name}</h3>
                            {project.description && (
                                <p className="text-xs text-slate-500 truncate">{project.description}</p>
                            )}
                        </div>

                        <div className="col-span-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`}></span>
                                {project.status}
                            </span>
                        </div>

                        <div className="col-span-5 flex items-center justify-end gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                            </span>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
                                <Edit className="mr-2 h-4 w-4" /> Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`group bg-white rounded-xl border border-slate-200 border-t-4 ${getStatusBorder(project.status)} shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer overflow-hidden`}
            onClick={() => navigate(`/dashboard/${project.id}/requirements`)}
        >
            <div className="p-4">
                {/* Header: Status badge + Actions */}
                <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`}></span>
                        {project.status}
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
                                <Edit className="mr-2 h-4 w-4" /> Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Project info */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-800 truncate text-sm group-hover:text-blue-700 transition-colors">
                            {project.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {project.description || 'Nessuna descrizione'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(project.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                </div>
            </div>
        </div>
    );
}
