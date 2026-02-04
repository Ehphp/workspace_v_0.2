import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-emerald-500';
            case 'DRAFT':
                return 'bg-amber-500';
            case 'ARCHIVED':
                return 'bg-slate-500';
            default:
                return 'bg-blue-500';
        }
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'DRAFT':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'ARCHIVED':
                return 'bg-slate-50 text-slate-700 border-slate-200';
            default:
                return 'bg-blue-50 text-blue-700 border-blue-200';
        }
    };

    if (layout === 'list') {
        return (
            <div
                className="group relative flex items-center gap-4 p-3 rounded-lg border border-slate-200/60 bg-white/80 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer backdrop-blur-sm"
                onClick={() => navigate(`/dashboard/${project.id}/requirements`)}
            >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-blue-500" />

                <div className="pl-2">
                    <div className="p-2 rounded-md bg-slate-100 text-slate-500">
                        <FolderOpen className="w-4 h-4" />
                    </div>
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4">
                        <h3 className="font-semibold text-slate-900 truncate text-sm">{project.name}</h3>
                        {project.description && (
                            <p className="text-xs text-slate-500 truncate">{project.description}</p>
                        )}
                    </div>

                    <div className="col-span-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeColor(project.status)}`}>
                            {project.status}
                        </span>
                    </div>

                    <div className="col-span-3 flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        <span className="truncate">{project.owner || 'Me'}</span>
                    </div>

                    <div className="col-span-3 flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(project); }}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    return (
        <Card
            className="group relative overflow-hidden border-slate-200/50 bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/30 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col backdrop-blur-xl rounded-xl"
            onClick={() => navigate(`/dashboard/${project.id}/requirements`)}
        >
            {/* Status indicator line */}
            <div className={`absolute top-0 left-0 w-full h-1 ${getStatusColor(project.status)}`} />

            <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-500 group-hover:from-blue-100 group-hover:to-indigo-50 group-hover:text-blue-600 transition-all duration-300 shadow-sm">
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate text-sm leading-tight group-hover:text-blue-700 transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                                {project.description || 'Nessuna descrizione'}
                            </p>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 -mr-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-slate-100">
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

                <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusBadgeColor(project.status)}`}>
                        {project.status}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(project.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </span>
                </div>
            </div>
        </Card>
    );
}
