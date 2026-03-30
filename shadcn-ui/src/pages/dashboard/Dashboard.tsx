import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { fetchProjects, fetchProjectIds, PROJECT_FK } from '@/lib/projects';
import { Button } from '@/components/ui/button';
import { Plus, Search, Layers, TrendingUp, ListChecks, BarChart3, PieChart, LayoutGrid, List as ListIcon, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Project } from '@/types/database';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { DeleteProjectDialog } from '@/components/projects/DeleteProjectDialog';
import { PageShell } from '@/components/layout/PageShell';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RecentRequirements } from '@/components/dashboard/RecentRequirements';
import { StatusDistributionChart } from '@/components/charts/StatusDistributionChart';
import { TechStackUsageChart } from '@/components/charts/TechStackUsageChart';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, currentOrganization, fetchOrganizations } = useAuthStore();
  const { stats } = useDashboardData();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated-desc');
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [techData, setTechData] = useState<{ name: string; value: number }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load organizations if not loaded
  useEffect(() => {
    if (user && !currentOrganization) {
      console.log('[Dashboard] No organization found, fetching...');
      fetchOrganizations();
    }
  }, [user, currentOrganization, fetchOrganizations]);

  useEffect(() => {
    if (user && currentOrganization) {
      console.log('[Dashboard] Loading data for organization:', currentOrganization.id);
      loadProjects();
      loadChartData();
    }
  }, [user, currentOrganization, showArchived]);

  const loadProjects = async () => {
    if (!user || !currentOrganization) return;

    try {
      const data = await fetchProjects({
        organizationId: currentOrganization.id,
        ...(showArchived
          ? { status: 'ARCHIVED' }
          : { excludeStatus: 'ARCHIVED' }),
        orderBy: 'updated_at',
        ascending: false,
      });
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
    setLoading(false);
  };

  const loadChartData = async () => {
    if (!user || !currentOrganization) return;

    try {
      // Get organization's projects
      const projectIds = await fetchProjectIds(currentOrganization.id);

      if (projectIds.length === 0) return;

      // Get status distribution and tech stack
      // For charts, we don't need ALL requirements if there are thousands
      // Limit to most recent 500 for chart aggregation as a reasonable sample
      const { data: requirements } = await supabase
        .from('requirements')
        .select('state, technology_id')
        .in(PROJECT_FK, projectIds)
        .order('updated_at', { ascending: false })
        .limit(500);

      const statusCounts: Record<string, number> = {};
      const techCounts: Record<string, number> = {};

      // Fetch technologies to map IDs to names (this is cached/small table)
      const { data: presets } = await supabase
        .from('technologies')
        .select('id, name');

      const presetMap = new Map(presets?.map(p => [p.id, p.name]) || []);

      requirements?.forEach(r => {
        // Status counts
        statusCounts[r.state] = (statusCounts[r.state] || 0) + 1;

        // Tech counts
        if (r.technology_id) {
          const techName = presetMap.get(r.technology_id) || 'Unknown';
          techCounts[techName] = (techCounts[techName] || 0) + 1;
        }
      });

      const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        color:
          name === 'PROPOSED' ? '#3b82f6' :
            name === 'APPROVED' ? '#10b981' :
              name === 'ESTIMATED' ? '#8b5cf6' :
                '#64748b',
      }));

      setStatusData(statusChartData);

      const techChartData = Object.entries(techCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7);

      setTechData(techChartData);
    } catch (err) {
      console.error('Error loading chart data:', err);
    }
  };

  const filteredProjects = projects
    .filter((project) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        project.name.toLowerCase().includes(searchLower) ||
        (project.description && project.description.toLowerCase().includes(searchLower))
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
    <PageShell
      fullHeight
      background="default"
      noContainer
      headerClassName="bg-white border-b border-slate-200 shadow-sm z-20 relative"
      className="relative"
      contentClassName="flex flex-col overflow-hidden relative z-10"
    >

      {/* Top Bar: KPIs & Actions - Fixed Height */}
      {/* Top Bar: Headers - Fixed Height */}
      <div className="flex-shrink-0 relative z-10 border-b border-slate-200 bg-white">
        <div className="container mx-auto max-w-7xl px-6 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 text-xs mt-0.5">Gestisci i tuoi progetti e requisiti</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cerca progetti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 bg-white border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 shadow-sm h-9 px-4 rounded-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Flex column, no outer scroll */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-0">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col flex-1 min-h-0 py-3 gap-3">

          {/* KPI Cards - Fixed height */}
          <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={Layers}
              label="Progetti"
              value={stats.totalProjects}
              gradient="from-white to-blue-50/80"
              iconGradient="from-blue-500 to-indigo-600"
              subtitle="totali"
            />
            <KpiCard
              icon={ListChecks}
              label="Requisiti"
              value={stats.activeRequirements}
              gradient="from-white to-emerald-50/80"
              iconGradient="from-emerald-500 to-teal-600"
              subtitle="attivi"
            />
            <KpiCard
              icon={TrendingUp}
              label="Giorni Stimati"
              value={stats.totalEstimatedDays}
              gradient="from-white to-purple-50/80"
              iconGradient="from-purple-500 to-pink-600"
              subtitle="totali"
            />
            <KpiCard
              icon={BarChart3}
              label="Media"
              value={stats.averageDaysPerReq}
              gradient="from-white to-amber-50/80"
              iconGradient="from-amber-500 to-orange-600"
              subtitle="giorni/requisito"
            />
          </div>

          {/* Main Grid - fills remaining viewport */}
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-3">

            {/* Left Column: Projects List */}
            <div className="col-span-12 lg:col-span-8 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex-shrink-0 px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  <div>
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">I tuoi Progetti</h2>
                    <p className="text-xs text-slate-400">{filteredProjects.length} progetti</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/analytics/accuracy')}
                    className="h-7 text-xs rounded-lg"
                  >
                    <Target className="w-3.5 h-3.5 mr-1.5" />
                    Accuratezza
                  </Button>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-28 h-8 text-xs border-slate-200 bg-white rounded-lg">
                      <SelectValue placeholder="Ordina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated-desc">Più recenti</SelectItem>
                      <SelectItem value="name-asc">Nome A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <ListIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {filteredProjects.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="Nessun progetto trovato"
                    description="Crea il tuo primo progetto per iniziare"
                    action={
                      <Button
                        onClick={() => setShowCreateDialog(true)}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Crea Progetto
                      </Button>
                    }
                  />
                ) : (
                  <div className={viewMode === 'grid' ? "grid grid-cols-2 xl:grid-cols-3 gap-3" : "flex flex-col gap-2"}>
                    {filteredProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onEdit={setEditProject}
                        onDelete={setDeleteProject}
                        layout={viewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sidebar */}
            <div className="col-span-12 lg:col-span-4 flex flex-col min-h-0">

              {/* Recent Activity */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex-shrink-0 px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attività Recente</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                  <RecentRequirements />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadProjects}
      />

      <EditProjectDialog
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
        project={editProject}
        onSuccess={() => {
          setEditProject(null);
          loadProjects();
        }}
      />

      {deleteProject && (
        <DeleteProjectDialog
          open={!!deleteProject}
          onOpenChange={(open) => !open && setDeleteProject(null)}
          projectId={deleteProject.id}
          projectName={deleteProject.name}
          onSuccess={() => {
            setDeleteProject(null);
            loadProjects();
          }}
        />
      )}
    </PageShell>
  );
}
