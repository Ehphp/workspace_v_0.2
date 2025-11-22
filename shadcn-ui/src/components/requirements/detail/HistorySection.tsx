import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstimationTimeline } from '@/components/estimation/EstimationTimeline';
import { History, Clock } from 'lucide-react';
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
};

interface HistorySectionProps {
  history: HistoryItem[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function HistorySection({
  history,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: HistorySectionProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(totalCount, page * pageSize);

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

              return (
                <Card
                  key={est.id}
                  className="rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-500 bg-white/90 backdrop-blur-sm"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 truncate mb-1">{est.scenario_name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          {new Date(est.created_at).toLocaleDateString()}{' '}
                          {new Date(est.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-slate-200 bg-blue-50">
                        {est.contingency_percent.toFixed(0)}% risk buffer
                      </Badge>
                    </div>

                    <div className="text-center py-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                      <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {est.total_days.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium uppercase mt-1">days</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="text-center bg-slate-50 rounded px-2 py-1">
                        <div className="text-slate-600">Base</div>
                        <div className="font-bold text-slate-900">{est.base_days.toFixed(1)}</div>
                      </div>
                      <div className="text-center bg-purple-50 rounded px-2 py-1">
                        <div className="text-purple-600">Driver</div>
                        <div className="font-bold text-purple-700">{est.driver_multiplier.toFixed(2)}x</div>
                      </div>
                      <div className="text-center bg-amber-50 rounded px-2 py-1">
                        <div className="text-amber-600">Risk</div>
                        <div className="font-bold text-amber-700">{est.risk_score}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700">
                      <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-[11px] font-bold text-blue-700">
                          {est.estimation_activities?.length ?? 0}
                        </div>
                        <span>Activities</span>
                      </div>
                      <div className="flex items-center gap-2 bg-purple-50 rounded px-2 py-1">
                        <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-[11px] font-bold text-purple-700">
                          {est.estimation_drivers?.length ?? 0}
                        </div>
                        <span>Drivers</span>
                      </div>
                      <div className="flex items-center gap-2 bg-amber-50 rounded px-2 py-1">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-[11px] font-bold text-amber-700">
                          {est.estimation_risks?.length ?? 0}
                        </div>
                        <span>Risks</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>AI suggested</span>
                        <span className="font-semibold">
                          {est.estimation_activities?.filter((a) => a.is_ai_suggested).length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Manual</span>
                        <span className="font-semibold">
                          {hasActivities
                            ? (est.estimation_activities?.length || 0) -
                              (est.estimation_activities?.filter((a) => a.is_ai_suggested).length || 0)
                            : 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {hasActivities && <Badge variant="secondary">{est.estimation_activities?.length} activities</Badge>}
                      {hasDrivers && <Badge variant="secondary">{est.estimation_drivers?.length} drivers</Badge>}
                      {hasRisks && <Badge variant="secondary">{est.estimation_risks?.length} risks</Badge>}
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
