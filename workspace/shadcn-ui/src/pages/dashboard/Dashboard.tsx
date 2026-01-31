import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Plus, Search, Layers, TrendingUp, ListChecks, BarChart3, PieChart, LayoutGrid, List as ListIcon } from 'lucide-react';
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
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RecentRequirements } from '@/components/dashboard/RecentRequirements';
import { StatusDistributionChart } from '@/components/charts/StatusDistributionChart';
import { TechStackUsageChart } from '@/components/charts/TechStackUsageChart';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, currentOrganization, fetchOrganizations } = useAuthStore();
  const { stats } = useDashboardData();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('updated-desc');
  const [editList, setEditList] = useState<List | null>(null);
  const [deleteList, setDeleteList] = useState<List | null>(null);
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
      loadLists();
      loadChartData();
    }
  }, [user, currentOrganization, showArchived]);

  const loadLists = async () => {
    if (!user || !currentOrganization) return;

    let query = supabase
      .from('lists')
      .select('*')
      .eq('organization_id', currentOrganization.id)
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

  const loadChartData = async () => {
    if (!user || !currentOrganization) return;

    try {
      // Get organization's lists
      const { data: orgLists } = await supabase
        .from('lists')
        .select('id')
        .eq('organization_id', currentOrganization.id);

      const listIds = orgLists?.map(l => l.id) || [];

      if (listIds.length === 0) return;

      // Get status distribution and tech stack
      // For charts, we don't need ALL requirements if there are thousands
      // Limit to most recent 500 for chart aggregation as a reasonable sample
      const { data: requirements } = await supabase
        .from('requirements')
        .select('state, tech_preset_id')
        .in('list_id', listIds)
        .order('updated_at', { ascending: false })
        .limit(500);

      const statusCounts: Record<string, number> = {};
      const techCounts: Record<string, number> = {};

      // Fetch presets to map IDs to names (this is cached/small table)
      const { data: presets } = await supabase
        .from('technology_presets')
        .select('id, name');

      const presetMap = new Map(presets?.map(p => [p.id, p.name]) || []);

      requirements?.forEach(r => {
        // Status counts
        statusCounts[r.state] = (statusCounts[r.state] || 0) + 1;

        // Tech counts
        if (r.tech_preset_id) {
          const techName = presetMap.get(r.tech_preset_id) || 'Unknown';
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
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Animated Background Blobs */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 -left-20 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, 50, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/3 -right-20 w-[30rem] h-[30rem] bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, 50, 0],
          y: [0, 100, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-1/3 w-[25rem] h-[25rem] bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"
      />

      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm z-20 relative">
        <Header />
      </div>

      {/* Main Content Area - Flex 1 with no scroll on parent */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Top Bar: KPIs & Actions - Fixed Height */}
        {/* Top Bar: Headers - Fixed Height */}
        <div className="flex-shrink-0 relative z-10 border-b border-white/50 bg-white/60 backdrop-blur-xl">
          <div className="container mx-auto max-w-7xl px-6 py-5">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-slate-500 text-sm mt-1">Gestisci i tuoi progetti e requisiti</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cerca progetti..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-white/80 border-slate-200/80 rounded-xl focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 h-10 px-5 rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid - Flex 1 with internal scrolling */}
        <div className="flex-1 overflow-y-auto relative z-0">
          <div className="container mx-auto max-w-7xl px-6 py-6 space-y-8">

            {/* KPI Cards - Larger and more prominent */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div className="grid grid-cols-12 gap-6 min-h-[500px]">

              {/* Left Column: Projects List */}
              <div className="col-span-12 lg:col-span-8 flex flex-col bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50/80 to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Layers className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800">I tuoi Progetti</h2>
                      <p className="text-xs text-slate-500">{filteredLists.length} progetti</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32 h-9 text-xs border-slate-200 bg-white rounded-lg">
                        <SelectValue placeholder="Ordina" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updated-desc">Più recenti</SelectItem>
                        <SelectItem value="name-asc">Nome A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {filteredLists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Layers className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="font-medium">Nessun progetto trovato</p>
                      <p className="text-sm text-slate-400 mt-1">Crea il tuo primo progetto per iniziare</p>
                      <Button
                        onClick={() => setShowCreateDialog(true)}
                        className="mt-4 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crea Progetto
                      </Button>
                    </div>
                  ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 xl:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
                      {filteredLists.map((list) => (
                        <ProjectCard
                          key={list.id}
                          project={list}
                          onEdit={setEditList}
                          onDelete={setDeleteList}
                          layout={viewMode}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Sidebar */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

                {/* Recent Activity */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 shadow-lg overflow-hidden flex-1 hover:shadow-xl transition-all duration-300">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50/80 to-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-slate-800">Attività Recente</h3>
                    </div>
                  </div>
                  <div className="p-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <RecentRequirements />
                  </div>
                </div>

              </div>
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
