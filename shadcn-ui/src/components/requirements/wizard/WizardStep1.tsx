import { useState, useEffect, useRef } from 'react';
import { useRequirementNormalization } from '@/hooks/useRequirementNormalization';
import { Loader2, Wand2, CheckCircle2, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep1Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function WizardStep1({ data, onUpdate, onNext }: WizardStep1Props) {
  const [isFocused, setIsFocused] = useState(false);
  const { normalize, isNormalizing, normalizationResult, resetNormalization } = useRequirementNormalization();
  const normalizationCardRef = useRef<HTMLDivElement>(null);
  const [editedNormalizedDescription, setEditedNormalizedDescription] = useState<string>('');

  const handleNormalize = async () => {
    if (!data.description) return;
    console.log('Starting normalization for description:', data.description.substring(0, 50));
    const result = await normalize(data.description);
    console.log('Normalization result:', result);
    if (result?.normalizedDescription) {
      setEditedNormalizedDescription(result.normalizedDescription);
    }
  };

  // Auto-scroll to normalization result when it appears
  useEffect(() => {
    if (normalizationResult && normalizationCardRef.current) {
      normalizationCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
      // Initialize edited version with AI result
      if (normalizationResult.normalizedDescription) {
        setEditedNormalizedDescription(normalizationResult.normalizedDescription);
      }
    }
  }, [normalizationResult]);

  const applyNormalization = () => {
    if (editedNormalizedDescription) {
      onUpdate({
        description: editedNormalizedDescription,
        normalizationResult: normalizationResult
      });
      resetNormalization();
      setEditedNormalizedDescription('');
    }
  };

  const canProceed = Boolean(data.description); // Title is now optional
  const charCount = data.description.length;
  const maxChars = 2000;
  const charPercentage = (charCount / maxChars) * 100;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg ring-2 ring-blue-100">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">Requirement Information</h2>
            <p className="text-xs text-slate-600">Concise context keeps the wizard fast to scan</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="px-2 py-1 rounded-md bg-slate-100 font-semibold text-slate-700">Required</span>
          <span className="hidden sm:inline">
            {charCount}/{maxChars} chars
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        <div className="grid gap-3 md:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Brief requirement title"
                value={data.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="bg-white h-9 text-sm"
                autoFocus
              />
            </div>

            <div className={`relative group rounded-xl border transition-all duration-200 bg-white ${isFocused
              ? 'border-blue-400 shadow-[0_8px_30px_rgba(59,130,246,0.12)]'
              : 'border-slate-200'
              }`}>
              <label
                htmlFor="description"
                className={`absolute left-3 transition-all duration-150 pointer-events-none ${isFocused || data.description
                  ? '-top-2 text-[10px] font-semibold bg-white px-2 text-blue-600'
                  : 'top-2.5 text-xs text-slate-500'
                  }`}
              >
                Requirement Description *
              </label>

              <textarea
                id="description"
                value={data.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                rows={4}
                maxLength={maxChars}
                className="w-full px-3 pt-6 pb-2 pr-10 bg-transparent border-0 rounded-xl resize-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 text-xs leading-relaxed"
                placeholder="Describe scope, constraints, integrations, and outcomes..."
              />

              <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-slate-500">
                <div className="flex items-center gap-2">
                  <div className={`w-14 h-1 bg-slate-100 rounded-full overflow-hidden ${charPercentage > 90 ? 'ring-1 ring-amber-500' : ''
                    }`}>
                    <div
                      className={`h-full transition-all duration-300 ${charPercentage > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                        }`}
                      style={{ width: `${Math.min(charPercentage, 100)}%` }}
                    />
                  </div>
                  <span className={charPercentage > 90 ? 'font-semibold text-amber-700' : 'font-medium'}>
                    {charCount}/{maxChars}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNormalize}
                    disabled={isNormalizing || !data.description || data.description.length < 10}
                    className="h-5 px-1.5 text-[9px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {isNormalizing ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-2.5 h-2.5 mr-1" />
                        Analyze & Improve
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl border border-slate-200 bg-white/80 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="business_owner" className="text-[10px]">Business Owner</Label>
                  <Input
                    id="business_owner"
                    placeholder="John Doe"
                    value={data.business_owner || ''}
                    onChange={(e) => onUpdate({ business_owner: e.target.value })}
                    className="bg-white h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="priority" className="text-[10px]">Priority</Label>
                  <Select
                    value={data.priority}
                    onValueChange={(value: WizardData['priority']) => onUpdate({ priority: value })}
                  >
                    <SelectTrigger id="priority" className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="state" className="text-[10px]">State</Label>
                  <Select
                    value={data.state}
                    onValueChange={(value: WizardData['state']) => onUpdate({ state: value })}
                  >
                    <SelectTrigger id="state" className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPOSED">Proposed</SelectItem>
                      <SelectItem value="SELECTED">Selected</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/80">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 space-y-0.5">
                  <p className="text-xs font-semibold text-blue-900">Tips for better AI suggestions</p>
                  <ul className="text-[10px] text-blue-800 space-y-0.5 leading-relaxed">
                    <li>Explain what needs to be built and why it matters</li>
                    <li>Mention integrations, data sources, or technical constraints</li>
                    <li>List key user flows or acceptance criteria</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Normalization Result Card */}
        {normalizationResult && (
          <div ref={normalizationCardRef} className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-white" />
                <span className="text-sm font-bold text-white">AI Analysis Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${normalizationResult.isValidRequirement
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                  }`}>
                  {normalizationResult.isValidRequirement ? '✓ Valid' : '⚠ Needs Work'}
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/20 text-white font-semibold">
                  {(normalizationResult.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Compact comparison - stacked on small screens */}
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Original
                  </Label>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed max-h-24 overflow-y-auto">
                    {normalizationResult.originalDescription}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
                    <Wand2 className="w-3 h-3" />
                    AI-Improved (Editable)
                  </Label>
                  <textarea
                    value={editedNormalizedDescription}
                    onChange={(e) => setEditedNormalizedDescription(e.target.value)}
                    className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 p-2.5 rounded-lg border-2 border-indigo-200 text-xs text-slate-800 leading-relaxed font-medium max-h-24 overflow-y-auto shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    rows={3}
                  />
                </div>
              </div>

              {(normalizationResult.validationIssues?.length > 0 || normalizationResult.transformNotes?.length > 0) && (
                <div className="grid gap-2">
                  {normalizationResult.validationIssues?.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Issues ({normalizationResult.validationIssues.length})
                      </Label>
                      <ul className="bg-amber-50/80 rounded border border-amber-200 p-2 text-[10px] text-amber-900 space-y-1 max-h-20 overflow-y-auto">
                        {normalizationResult.validationIssues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                            <span className="flex-1">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {normalizationResult.transformNotes?.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-blue-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Improvements ({normalizationResult.transformNotes.length})
                      </Label>
                      <ul className="bg-blue-50/80 rounded border border-blue-200 p-2 text-[10px] text-blue-900 space-y-1 max-h-20 overflow-y-auto">
                        {normalizationResult.transformNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-1 w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                            <span className="flex-1">{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetNormalization}
                  className="h-8 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                >
                  Keep Original
                </Button>
                <Button
                  size="sm"
                  onClick={applyNormalization}
                  className="h-8 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Use This
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-3 border-t border-slate-200">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          size="lg"
          className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
        >
          <span className="font-semibold text-sm">Next: Select Technology</span>
          <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
