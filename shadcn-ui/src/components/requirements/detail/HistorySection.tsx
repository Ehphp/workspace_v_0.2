import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstimationTimeline } from '@/components/estimation/EstimationTimeline';
import { History, Clock, CheckCircle2, Check } from 'lucide-react';
import { useEstimationActions } from '@/hooks/useEstimationActions';
import { cn } from '@/lib/utils';
import React from 'react';

type HistoryItem = {
  id: string;
  scenario_name: string;
  created_at: string;
  total_days: number;
  base_days: number;
  driver_multiplier: number;
  risk_score: number;
  contingency_percent: number;
  estimation_activities?: Array<{ activity_id: string; is_ai_suggested: boolean }>;
  estimation_drivers?: Array<{ driver_id: string; selected_value: string }>;
  estimation_risks?: Array<{ risk_id: string }>;
  requirement_id: string;
  user_id: string;
};

interface HistorySectionProps {
  history: HistoryItem[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  assignedEstimationId?: string | null;
  onAssign?: () => void;
  requirementId: string;
}

export function HistorySection({
  history,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  assignedEstimationId,
  onAssign,
  requirementId
}: HistorySectionProps) {
  const { assignEstimation, assigning } = useEstimationActions();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(totalCount, page * pageSize);

  const handleAssign = async (estimationId: string) => {
    await assignEstimation(requirementId, estimationId, onAssign);
  };

  return (
    <div className="space-y-4">
      {history.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <EstimationTimeline estimations={history} />
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : history.length === 0 ? (
        <Card className="rounded-xl shadow-lg border-white/50 bg-white/80 backdrop-blur-sm">
          <CardContent className="text-center py-12 text-slate-600">
            <History className="h-12 w-12 mx-auto mb-4 opacity-40 text-slate-400" />
            <p className="text-sm font-medium">No estimation history yet</p>
            <p className="text-xs mt-2 text-slate-500">Save an estimation to start building history</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {showingFrom}-{showingTo} of {totalCount}
            </span>
            <div className="flex lg:hidden items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {history.map((est) => {
              const hasActivities = (est.estimation_activities?.length || 0) > 0;
              const hasDrivers = (est.estimation_drivers?.length || 0) > 0;
              const hasRisks = (est.estimation_risks?.length || 0) > 0;
              const isAssigned = assignedEstimationId === est.id;
              const isAssigning = assigning === est.id;

              return (
                <Card
                  key={est.id}
                  className={cn(
                    "rounded-xl shadow-md transition-all duration-300 border-l-4 bg-white/90 backdrop-blur-sm relative overflow-hidden group",
                    isAssigned ? "border-l-emerald-500 ring-2 ring-emerald-500/20" : "border-l-blue-500 hover:shadow-xl"
                  )}
                >
                  {isAssigned && (
                    <div className="absolute top-0 right-0 p-1.5 bg-emerald-500 rounded-bl-lg shadow-sm z-10">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <CardContent className="p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 pr-4">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 truncate mb-0.5">{est.scenario_name}</h4>
                        <div className="flex items-center gap-1 text-[9px] text-slate-500">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(est.created_at).toLocaleDateString()}{' '}
                          {new Date(est.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 border-slate-200 bg-blue-50">
                        {est.contingency_percent.toFixed(0)}% risk buffer
                      </Badge>
                    </div>

                    <div className="text-center py-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg relative group-hover:bg-blue-50/80 transition-colors">
                      <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {est.total_days.toFixed(1)}
                      </div>
                      <div className="text-[9px] text-slate-600 font-medium uppercase">days</div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                      <div className="text-center bg-slate-50 rounded px-1.5 py-1">
                        <div className="text-slate-600">Base</div>
                        <div className="font-bold text-slate-900">{est.base_days.toFixed(1)}</div>
                      </div>
                      <div className="text-center bg-purple-50 rounded px-1.5 py-1">
                        <div className="text-purple-600">Driver</div>
                        <div className="font-bold text-purple-700">{est.driver_multiplier.toFixed(2)}x</div>
                      </div>
                      <div className="text-center bg-amber-50 rounded px-1.5 py-1">
                        <div className="text-amber-600">Risk</div>
                        <div className="font-bold text-amber-700">{est.risk_score}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-700">
                      <div className="flex items-center gap-1.5 bg-slate-50 rounded px-1.5 py-0.5">
                        <div className="w-5 h-5 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                          {est.estimation_activities?.length ?? 0}
                        </div>
                        <span>Activities</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-purple-50 rounded px-1.5 py-0.5">
                        <div className="w-5 h-5 rounded-lg bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700">
                          {est.estimation_drivers?.length ?? 0}
                        </div>
                        <span>Drivers</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-amber-50 rounded px-1.5 py-0.5">
                        <div className="w-5 h-5 rounded-lg bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">
                          {est.estimation_risks?.length ?? 0}
                        </div>
                        <span>Risks</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {hasActivities && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{est.estimation_activities?.length} activities</Badge>}
                      {hasDrivers && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{est.estimation_drivers?.length} drivers</Badge>}
                      {hasRisks && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{est.estimation_risks?.length} risks</Badge>}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-end">
                      {!isAssigned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs w-full hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => handleAssign(est.id)}
                          disabled={!!assigning}
                        >
                          {isAssigning ? (
                            <span className="animate-spin mr-2">⏳</span>
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {isAssigning ? 'Assigning...' : 'Assign as Official'}
                        </Button>
                      ) : (
                        <div className="w-full text-center py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Official Estimation
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
