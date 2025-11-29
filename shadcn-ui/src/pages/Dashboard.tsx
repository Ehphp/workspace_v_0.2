import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
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

  useEffect(() => {
    if (user) {
      loadLists();
      loadChartData();
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

  const loadChartData = async () => {
    if (!user) return;

    try {
      // Get user's lists
      const { data: userLists } = await supabase
        .from('lists')
        .select('id')
        .eq('user_id', user.id);

      const listIds = userLists?.map(l => l.id) || [];

      if (listIds.length === 0) return;

      // Get status distribution and tech stack
      const { data: requirements } = await supabase
        .from('requirements')
        .select('state, tech_preset_id')
        .in('list_id', listIds);

      const statusCounts: Record<string, number> = {};
      const techCounts: Record<string, number> = {};

      // Fetch presets to map IDs to names
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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 z-20">
        <Header />
      </div>

      {/* Main Content Area - Flex 1 with no scroll on parent */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar: KPIs & Actions - Fixed Height */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col gap-4">
              {/* Welcome & Actions */}
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                  <p className="text-sm text-slate-500">Welcome back, {user?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search projects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
                    />
                  </div>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <KpiCard
                  icon={Layers}
                  label="Total Projects"
                  value={stats.totalProjects}
                  gradient="from-white to-blue-50"
                  iconGradient="from-blue-500 to-indigo-500"
                />
                <KpiCard
                  icon={ListChecks}
                  label="Active Requirements"
                  value={stats.activeRequirements}
                  gradient="from-white to-emerald-50"
                  iconGradient="from-emerald-500 to-teal-500"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Total Days"
                  value={stats.totalEstimatedDays}
                  gradient="from-white to-purple-50"
                  iconGradient="from-purple-500 to-pink-500"
                />
                <KpiCard
                  icon={BarChart3}
                  label="Avg Days/Req"
                  value={stats.averageDaysPerReq}
                  gradient="from-white to-amber-50"
                  iconGradient="from-amber-500 to-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid - Flex 1 with internal scrolling */}
        <div className="flex-1 overflow-hidden">
          <div className="container mx-auto max-w-7xl h-full px-6 py-4">
            <div className="grid grid-cols-12 gap-6 h-full">

              {/* Left Column: Projects List - Scrollable */}
              <div className="col-span-8 flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <h2 className="font-semibold text-slate-700">Projects</h2>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium border border-slate-200">
                      {filteredLists.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32 h-8 text-xs border-slate-200 bg-white">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updated-desc">Recent</SelectItem>
                        <SelectItem value="name-asc">Name A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {filteredLists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <Layers className="w-12 h-12 mb-2 opacity-20" />
                      <p>No projects found</p>
                    </div>
                  ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
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

              {/* Right Column: Sidebar - Scrollable */}
              <div className="col-span-4 flex flex-col gap-4 h-full min-h-0 overflow-y-auto custom-scrollbar pr-1">

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
                  <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-semibold text-slate-700 text-sm">Recent Activity</h3>
                  </div>
                  <div className="p-2">
                    <RecentRequirements />
                  </div>
                </div>

                {/* Charts Tabs */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-[300px]">
                  <Tabs defaultValue="status" className="h-full flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-700 text-sm">Analytics</h3>
                      <TabsList className="h-7 bg-slate-200/50">
                        <TabsTrigger value="status" className="text-xs h-5 px-2">Status</TabsTrigger>
                        <TabsTrigger value="tech" className="text-xs h-5 px-2">Tech</TabsTrigger>
                      </TabsList>
                    </div>
                    <div className="flex-1 p-4">
                      <TabsContent value="status" className="h-full mt-0">
                        <StatusDistributionChart statusData={statusData} />
                      </TabsContent>
                      <TabsContent value="tech" className="h-full mt-0">
                        <TechStackUsageChart techData={techData} />
                      </TabsContent>
                    </div>
                  </Tabs>
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
