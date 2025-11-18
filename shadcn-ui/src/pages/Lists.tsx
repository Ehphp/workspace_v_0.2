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
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none"></div>

      {/* Fixed Header with glassmorphism */}
      <header className="relative border-b border-white/20 backdrop-blur-md bg-white/80 flex-none shadow-sm z-10">
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
      </header>

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