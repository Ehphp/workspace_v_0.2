import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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

export default function Lists() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editList, setEditList] = useState<List | null>(null);
  const [deleteList, setDeleteList] = useState<List | null>(null);

  const loadLists = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

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
      const errorMessage = 'Failed to load projects. Please try again.';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } else {
      setLists(data || []);
    }
    setLoading(false);
  }, [user, showArchived, toast]);

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) return;

    if (!user) {
      navigate('/login');
      return;
    }

    let isMounted = true;

    loadLists();

    return () => {
      isMounted = false;
    };
  }, [user, loadLists, navigate, authLoading, showArchived]);

  const getStatusBadge = (status: string) => {
    const variants = {
      DRAFT: 'secondary',
      ACTIVE: 'default',
      ARCHIVED: 'outline',
    } as const;

    type StatusKey = keyof typeof variants;
    const isValidStatus = (s: string): s is StatusKey => s in variants;
    const validStatus = isValidStatus(status) ? status : 'DRAFT';

    return (
      <Badge variant={variants[validStatus]}>
        {status}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>

      {/* Header with glassmorphism */}
      <header className="relative border-b border-white/20 backdrop-blur-md bg-white/80 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                My Projects
              </h1>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-6 py-12">
          {lists.length === 0 ? (
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left: Welcome Message */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/80 border border-blue-200/50 backdrop-blur-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span className="text-xs font-medium text-blue-900">Welcome to Your Workspace</span>
                    </div>

                    <h2 className="text-5xl font-bold text-slate-900 leading-tight">
                      Start Your First
                      <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Estimation Project
                      </span>
                    </h2>

                    <p className="text-lg text-slate-600 leading-relaxed">
                      Create a project to organize your requirements and get accurate effort estimations. Each project can contain multiple requirements with detailed analysis.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={() => setShowCreateDialog(true)}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Create Your First Project
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-blue-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                      <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                        <FolderOpen className="h-8 w-8" />
                      </div>
                      <p className="text-xs font-semibold text-slate-900">Projects</p>
                      <p className="text-xs text-slate-500 mt-1">Organize requirements</p>
                    </div>
                    <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-indigo-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                      <div className="text-3xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">Requirements</p>
                      <p className="text-xs text-slate-500 mt-1">Track & estimate</p>
                    </div>
                    <div className="group bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 hover:border-purple-300/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                      <div className="text-3xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">Analytics</p>
                      <p className="text-xs text-slate-500 mt-1">Detailed insights</p>
                    </div>
                  </div>
                </div>

                {/* Right: Features Card */}
                <div className="space-y-6">
                  <Card className="border-slate-200/50 bg-white/60 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">Project Features</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Everything you need</p>
                        </div>
                      </div>

                      <div className="space-y-3 mt-6">
                        {[
                          {
                            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
                            title: 'Organize Requirements',
                            desc: 'Group related requirements into projects for better management',
                            color: 'from-blue-500 to-cyan-500'
                          },
                          {
                            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
                            title: 'Track Progress',
                            desc: 'Monitor status and timeline of each requirement estimation',
                            color: 'from-indigo-500 to-purple-500'
                          },
                          {
                            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
                            title: 'Team Collaboration',
                            desc: 'Share projects with team members and collaborate effectively',
                            color: 'from-purple-500 to-pink-500'
                          },
                          {
                            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />,
                            title: 'Archive Completed',
                            desc: 'Keep your workspace clean by archiving finished projects',
                            color: 'from-pink-500 to-rose-500'
                          },
                        ].map((feature, index) => (
                          <div
                            key={index}
                            className="group flex gap-4 items-start p-4 rounded-xl hover:bg-white/80 transition-all duration-300 hover:shadow-md cursor-default"
                          >
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300`}>
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {feature.icon}
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="text-sm font-bold text-slate-900 mb-1">{feature.title}</p>
                              <p className="text-xs text-slate-600 leading-relaxed">{feature.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {/* Header Section */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Projects</h2>
                    <p className="text-slate-600">Manage and organize your estimation projects</p>
                  </div>
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

              {/* Projects Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lists.map((list) => (
                  <Card
                    key={list.id}
                    className="group border-slate-200/50 bg-white/60 backdrop-blur-sm hover:bg-white/80 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                    onClick={() => navigate(`/lists/${list.id}/requirements`)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open project ${list.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/lists/${list.id}/requirements`);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <CardTitle
                          className="text-lg font-bold text-slate-900 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300"
                        >
                          {list.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(list.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-white/80 transition-all duration-300"
                                aria-label={`Options for ${list.name}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
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
                      <CardDescription className="line-clamp-2">
                        {list.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-slate-50/50 to-blue-50/30 border border-slate-100/50">
                          <span className="font-medium">Owner:</span>
                          <span className="truncate ml-2 text-slate-900 font-medium">{list.owner || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-gradient-to-r from-slate-50/50 to-indigo-50/30 border border-slate-100/50">
                          <span className="font-medium">Updated:</span>
                          <span className="text-slate-900 font-medium">
                            {new Date(list.updated_at).toLocaleDateString()}
                          </span>
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