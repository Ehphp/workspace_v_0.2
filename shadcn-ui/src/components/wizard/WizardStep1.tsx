import { useState } from 'react';
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
  const canProceed = Boolean(data.title && data.description);
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

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        <div className="grid gap-4 md:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief requirement title"
                value={data.title || ''}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="bg-white"
                autoFocus
              />
            </div>

            <div className={`relative group rounded-xl border transition-all duration-200 bg-white ${isFocused
              ? 'border-blue-400 shadow-[0_8px_30px_rgba(59,130,246,0.12)]'
              : 'border-slate-200'
              }`}>
              <label
                htmlFor="description"
                className={`absolute left-4 transition-all duration-150 pointer-events-none ${isFocused || data.description
                  ? '-top-2 text-[11px] font-semibold bg-white px-2 text-blue-600'
                  : 'top-3.5 text-sm text-slate-500'
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
                rows={6}
                maxLength={maxChars}
                className="w-full px-4 pt-8 pb-3 pr-10 bg-transparent border-0 rounded-xl resize-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 text-sm leading-relaxed"
                placeholder="Describe scope, constraints, integrations, and outcomes..."
              />

              <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <div className={`w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden ${charPercentage > 90 ? 'ring-2 ring-amber-500' : ''
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
                <div className="flex items-center gap-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Markdown friendly</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-white/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="business_owner" className="text-xs">Business Owner</Label>
                  <Input
                    id="business_owner"
                    placeholder="John Doe"
                    value={data.business_owner || ''}
                    onChange={(e) => onUpdate({ business_owner: e.target.value })}
                    className="bg-white h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="priority" className="text-xs">Priority</Label>
                  <Select
                    value={data.priority}
                    onValueChange={(value: WizardData['priority']) => onUpdate({ priority: value })}
                  >
                    <SelectTrigger id="priority" className="h-10 text-sm bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="state" className="text-xs">State</Label>
                  <Select
                    value={data.state}
                    onValueChange={(value: WizardData['state']) => onUpdate({ state: value })}
                  >
                    <SelectTrigger id="state" className="h-10 text-sm bg-white">
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

            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/80">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-blue-900">Tips for better AI suggestions</p>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside leading-relaxed">
                    <li>Explain what needs to be built and why it matters</li>
                    <li>Mention integrations, data sources, or technical constraints</li>
                    <li>List key user flows or acceptance criteria</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
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
