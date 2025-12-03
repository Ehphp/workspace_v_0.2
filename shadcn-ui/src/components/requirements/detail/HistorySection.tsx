import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EstimationTimeline } from '@/components/estimation/EstimationTimeline';
import { History, Clock, CheckCircle2, Check } from 'lucide-react';
import { useEstimationActions } from '@/hooks/useEstimationActions';
import { cn } from '@/lib/utils';
import React from 'react';
import type { EstimationHistoryItem } from '@/hooks/useEstimationHistory';

interface HistorySectionProps {
  history: EstimationHistoryItem[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  assignedEstimationId?: string | null;
  onAssign?: () => void;
  requirementId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
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
  requirementId,
  selectedIds,
  onSelectionChange
}: HistorySectionProps) {
  const { assignEstimation, assigning } = useEstimationActions();

  const handleAssign = async (estimationId: string) => {
    await assignEstimation(requirementId, estimationId, onAssign);
  };

  const handleCardClick = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(item => item !== id));
    } else if (selectedIds.length >= 2) {
      onSelectionChange([selectedIds[1], id]); // Keep the last one and add new one
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      {history.length > 0 && (
        <div className="space-y-4">
          <EstimationTimeline
            estimations={history}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
          />
        </div>
      )}


    </div>
  );
}
