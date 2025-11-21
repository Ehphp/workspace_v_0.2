import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WizardData } from '@/hooks/useWizardState';

interface WizardStep1Props {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onNext: () => void;
}

export function WizardStep1({ data, onUpdate, onNext }: WizardStep1Props) {
  const [isFocused, setIsFocused] = useState(false);
  const canProceed = data.description;
  const charCount = data.description.length;
  const maxChars = 2000;
  const charPercentage = (charCount / maxChars) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg ring-4 ring-blue-100">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Requirement Information</h2>
            <p className="text-sm text-slate-600">
              Describe what needs to be developed
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Modern Card-style Textarea */}
        <div className={`relative group bg-white rounded-2xl border-2 transition-all duration-300 ${isFocused
            ? 'border-blue-500 shadow-xl shadow-blue-100 ring-4 ring-blue-50'
            : 'border-slate-200 shadow-md hover:border-slate-300 hover:shadow-lg'
          }`}>
          {/* Floating Label */}
          <label
            htmlFor="description"
            className={`absolute left-4 transition-all duration-200 pointer-events-none ${isFocused || data.description
                ? '-top-2.5 text-xs font-semibold bg-white px-2 text-blue-600'
                : 'top-4 text-sm text-slate-400'
              }`}
          >
            Requirement Description
          </label>

          {/* Icon */}
          <div className={`absolute right-4 top-4 transition-colors duration-200 ${isFocused ? 'text-blue-500' : 'text-slate-300'
            }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <textarea
            id="description"
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={12}
            maxLength={maxChars}
            className="w-full px-4 pt-6 pb-4 pr-12 bg-transparent border-0 rounded-2xl resize-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 text-sm leading-relaxed"
            placeholder="e.g., Implement a user authentication system with login, registration, password reset, and 2FA. The system should integrate with our existing API and support OAuth providers..."
          />

          {/* Character Counter */}
          <div className="px-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden ${charPercentage > 90 ? 'ring-2 ring-amber-500' : ''
                }`}>
                <div
                  className={`h-full transition-all duration-300 ${charPercentage > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    }`}
                  style={{ width: `${Math.min(charPercentage, 100)}%` }}
                />
              </div>
              <span className={`font-medium ${charPercentage > 90 ? 'text-amber-600' : 'text-slate-500'
                }`}>
                {charCount} / {maxChars}
              </span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">💡 Tips for better AI suggestions</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Describe <strong>what</strong> needs to be built and <strong>why</strong></li>
                <li>Include technical constraints and integration requirements</li>
                <li>Mention specific features, user flows, or data structures</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <span className="font-semibold">Next: Select Technology</span>
          <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}