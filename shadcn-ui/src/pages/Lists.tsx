import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Archive, Trash2, MoreVertical, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { List } from '@/types/database';
import { CreateListDialog } from '@/components/lists/CreateListDialog';
import { EditListDialog } from '@/components/lists/EditListDialog';
import { DeleteListDialog } from '@/components/lists/DeleteListDialog';
import { Header } from '@/components/layout/Header';

export default function Lists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editList, setEditList] = useState<List | null>(null);
  const [deleteList, setDeleteList] = useState<List | null>(null);

  useEffect(() => {
    if (user) {
      loadLists();
    }
  }, [user, showArchived]);

  const loadLists = async () => {
    if (!user) return;

    let query = supabase
      .from('lists')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (!showArchived) {
      query = query.neq('status', 'ARCHIVED');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading lists:', error);
    } else {
      setLists(data || []);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      DRAFT: {
        gradient: 'from-amber-500 to-orange-500',
        bgGradient: 'from-amber-50 to-orange-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200/50'
      },
      ACTIVE: {
        gradient: 'from-emerald-500 to-teal-500',
        bgGradient: 'from-emerald-50 to-teal-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200/50'
      },
      ARCHIVED: {
        gradient: 'from-slate-500 to-gray-500',
        bgGradient: 'from-slate-50 to-gray-50',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200/50'
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT;

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${config.bgGradient} border ${config.borderColor} shadow-sm`}>
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient} animate-pulse`}></div>
        <span className={`text-xs font-semibold ${config.textColor}`}>{status}</span>
      </div>
    );
  };

  const getStatusIcon = (status: string) => {
    const iconConfig = {
      DRAFT: {
        gradient: 'from-amber-400 to-orange-500',
        icon: Edit
      },
      ACTIVE: {
        gradient: 'from-emerald-400 to-teal-500',
        icon: FolderOpen
      },
      ARCHIVED: {
        gradient: 'from-slate-400 to-gray-500',
        icon: Archive
      },
    };

    const config = iconConfig[status as keyof typeof iconConfig] || iconConfig.DRAFT;
    const Icon = config.icon;

    return (
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none"></div>

      {/* Use shared Header component with navigation */}
      <Header />

      {/* Page specific header */}
      <div className="relative border-b border-white/20 bg-white/40 backdrop-blur-sm flex-none z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">My Projects</h1>
              <p className="text-sm text-slate-600 mt-1">Manage your estimation projects</p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative border-b border-white/20 bg-white/40 backdrop-blur-sm flex-none z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={showArchived ? 'outline' : 'default'}
              onClick={() => setShowArchived(false)}
              className={!showArchived
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:shadow-lg transition-all duration-300'
                : 'hover:bg-white/60 border-slate-300 transition-all duration-300'}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Active
            </Button>
            <Button
              size="sm"
              variant={showArchived ? 'default' : 'outline'}
              onClick={() => setShowArchived(true)}
              className={showArchived
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 shadow-md hover:shadow-lg transition-all duration-300'
                : 'hover:bg-white/60 border-slate-300 transition-all duration-300'}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="relative flex-1 overflow-hidden z-0">
        <div className="container mx-auto px-6 h-full">{lists.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardContent className="flex flex-col items-center py-12 px-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4 shadow-lg">
                  <FolderOpen className="h-10 w-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-slate-900">No projects yet</h3>
                <p className="text-slate-600 text-center mb-6">
                  Create your first project to start estimating requirements
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-full overflow-y-auto py-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {lists.map((list) => (
                <Card
                  key={list.id}
                  className="group border-slate-200/50 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/lists/${list.id}/requirements`)}
                >
                  {/* Colored top border based on status */}
                  <div className={`h-1 bg-gradient-to-r ${list.status === 'ACTIVE' ? 'from-emerald-400 to-teal-500' :
                      list.status === 'DRAFT' ? 'from-amber-400 to-orange-500' :
                        'from-slate-400 to-gray-500'
                    }`}></div>

                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-4 mb-3">
                      {/* Status Icon with gradient */}
                      {getStatusIcon(list.status)}

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <CardTitle
                            className="text-lg font-bold text-slate-900 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 truncate"
                          >
                            {list.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {getStatusBadge(list.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white/80 transition-all duration-300">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-md border-slate-200/50 shadow-xl">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditList(list); }} className="cursor-pointer hover:bg-blue-50 transition-colors">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Project
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive cursor-pointer hover:bg-red-50 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setDeleteList(list); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <CardDescription className="line-clamp-2 text-slate-600">
                          {list.description || 'No description'}
                        </CardDescription>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-3">
                      {getStatusBadge(list.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5 text-sm">
                      {/* Owner with gradient icon */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500 font-medium">Owner</div>
                          <div className="text-sm text-slate-900 font-semibold truncate">{list.owner || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Updated date with gradient icon */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500 font-medium">Last Updated</div>
                          <div className="text-sm text-slate-900 font-semibold">
                            {new Date(list.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      <CreateListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadLists}
      />

      <EditListDialog
        open={!!editList}
        onOpenChange={(open) => !open && setEditList(null)}
        list={editList}
        onSuccess={() => {
          setEditList(null);
          loadLists();
        }}
      />

      {deleteList && (
        <DeleteListDialog
          open={!!deleteList}
          onOpenChange={(open) => !open && setDeleteList(null)}
          listId={deleteList.id}
          listName={deleteList.name}
          onSuccess={() => {
            setDeleteList(null);
            loadLists();
          }}
        />
      )}
    </div>
  );
}