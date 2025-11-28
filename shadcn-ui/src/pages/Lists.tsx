import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Archive, Trash2, MoreVertical, Edit, Search, ArrowUpDown, BarChart3 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated-desc');
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

    if (showArchived) {
      query = query.eq('status', 'ARCHIVED');
    } else {
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

  const filteredLists = lists
    .filter((list) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        list.name.toLowerCase().includes(searchLower) ||
        (list.description && list.description.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'updated-desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'updated-asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header - flex-shrink-0 */}
      <div className="flex-shrink-0">
        <Header />
      </div>

      {/* Page specific header - flex-shrink-0 */}
      <div className="flex-shrink-0 relative border-b border-white/20 bg-white/40 backdrop-blur-sm z-10">
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

      {/* Controls Bar - flex-shrink-0 */}
      <div className="flex-shrink-0 relative border-b border-slate-200/60 bg-white/95 backdrop-blur-sm z-10">
        <div className="container mx-auto px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm shadow-sm"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-44 h-10 border-slate-300 bg-white/80 backdrop-blur-sm shadow-sm">
                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-lg border-slate-200/50">
                <SelectItem value="updated-desc">Most Recent</SelectItem>
                <SelectItem value="updated-asc">Oldest</SelectItem>
                <SelectItem value="name-asc">Name A→Z</SelectItem>
                <SelectItem value="name-desc">Name Z→A</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle (Active/Archived) */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setShowArchived(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!showArchived
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Active
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${showArchived
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Split into Cards (Top) and Chart (Bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">

        {/* Top Section: Projects Row */}
        <div className="flex-shrink-0 min-h-[400px] flex flex-col justify-center border-b border-slate-200/60 bg-slate-50/30 relative">
          <div className="w-full overflow-x-auto overflow-y-hidden pb-8 pt-4 px-6 custom-scrollbar">
            <div className="flex gap-6 mx-auto w-max min-w-full justify-center items-center h-full p-2">
              {filteredLists.length === 0 ? (
                <div className="flex items-center justify-center w-full">
                  <Card className="max-w-md border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
                    <CardContent className="flex flex-col items-center py-12 px-8">
                      {searchTerm ? (
                        <>
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center mb-4 shadow-lg">
                            <Search className="h-10 w-10 text-slate-400" />
                          </div>
                          <h3 className="text-xl font-bold mb-2 text-slate-900">No results found</h3>
                          <p className="text-slate-600 text-center">
                            No projects match your search "{searchTerm}"
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => setSearchTerm('')}
                            className="mt-6"
                          >
                            Clear Search
                          </Button>
                        </>
                      ) : showArchived ? (
                        <>
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center mb-4 shadow-lg">
                            <Archive className="h-10 w-10 text-slate-600" />
                          </div>
                          <h3 className="text-xl font-bold mb-2 text-slate-900">No archived projects</h3>
                          <p className="text-slate-600 text-center">
                            You don't have any archived projects yet
                          </p>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredLists.map((list) => (
                  <Card
                    key={list.id}
                    className="group w-[320px] flex-shrink-0 border-slate-200/50 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                    onClick={() => navigate(`/lists/${list.id}/requirements`)}
                  >
                    {/* Colored top border based on status */}
                    <div className={`h-1 flex-shrink-0 bg-gradient-to-r ${list.status === 'ACTIVE' ? 'from-emerald-400 to-teal-500' :
                      list.status === 'DRAFT' ? 'from-amber-400 to-orange-500' :
                        'from-slate-400 to-gray-500'
                      }`}></div>

                    <CardHeader className="pb-2 pt-4 px-4 flex-shrink-0">
                      <div className="flex items-start gap-3">
                        {/* Status Icon with gradient */}
                        <div className="transform scale-90">
                          {getStatusIcon(list.status)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <CardTitle
                              className="text-base font-bold text-slate-900 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 truncate"
                            >
                              {list.name}
                            </CardTitle>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                              <div className="transform scale-90 origin-right">
                                {getStatusBadge(list.status)}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/80 transition-all duration-300">
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
                          <CardDescription className="line-clamp-2 text-xs text-slate-600 h-8">
                            {list.description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 flex-1 flex flex-col justify-end">
                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <span className="truncate font-medium">{list.owner || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(list.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Chart Placeholder */}
        <div className="flex-1 bg-white/40 backdrop-blur-sm p-6 flex flex-col">
          <div className="h-full w-full rounded-2xl border-2 border-dashed border-slate-200/60 bg-white/40 flex items-center justify-center group hover:border-blue-300/50 hover:bg-blue-50/30 transition-all duration-500">
            <div className="text-center text-slate-400 group-hover:text-blue-500/70 transition-colors duration-300">
              <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-blue-100/50 flex items-center justify-center mx-auto mb-4 transition-colors duration-300">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Project Analytics</h3>
              <p className="text-sm text-slate-400/80">Detailed insights and charts coming soon</p>
            </div>
          </div>
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
