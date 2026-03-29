import { useState, useRef } from 'react';
import { useRequirementValidation, VALIDATION_BLOCK_THRESHOLD } from '@/hooks/useRequirementValidation';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
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
  const { validate, validationResult, isValidating, resetValidation } = useRequirementValidation();
  const [validationDismissed, setValidationDismissed] = useState(false);

  // Reset validation when description changes significantly
  const handleDescriptionChange = (value: string) => {
    onUpdate({ description: value });
    if (validationResult) {
      resetValidation();
      setValidationDismissed(false);
    }
  };

  // Validation gate: run validation before proceeding to next step
  const handleNextWithValidation = async () => {
    // If already validated and passed (or user dismissed warning), proceed
    if (validationResult?.isValid) {
      onNext();
      return;
    }
    if (validationResult && !validationResult.isValid && validationDismissed) {
      onNext();
      return;
    }

    // Run validation
    const result = await validate(data.description);
    if (result.isValid) {
      onUpdate({ requirementValidation: result });
      onNext();
      return;
    }

    // Block or warn based on confidence
    onUpdate({ requirementValidation: result });
    // If blocked (high confidence invalid), user must fix — we don't call onNext
    // If warning (low confidence), user can dismiss and proceed
  };

  /** Whether the validation gate is hard-blocking */
  const isValidationBlocking = validationResult
    && !validationResult.isValid
    && validationResult.confidence >= VALIDATION_BLOCK_THRESHOLD
    && !validationDismissed;

  /** Whether the validation gate shows a dismissible warning */
  const isValidationWarning = validationResult
    && !validationResult.isValid
    && validationResult.confidence < VALIDATION_BLOCK_THRESHOLD
    && !validationDismissed;

  const canProceed = Boolean(data.description); // Title is now optional
  const charCount = data.description.length;
  const maxChars = 2000;
  const charPercentage = (charCount / maxChars) * 100;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
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
            <div className={`relative group rounded-xl border transition-all duration-200 bg-white ${isFocused
              ? 'border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
              : 'border-slate-200'
              }`}>
              <label
                htmlFor="description"
                className={`absolute left-3 transition-all duration-150 pointer-events-none z-10 ${isFocused || data.description
                  ? '-top-1.1 text-[10px] font-semibold bg-white px-2 text-blue-600 ' : 'top-2.5 text-xs text-slate-500'
                  }`}
              >
                Requirement Description *
              </label>

              <textarea
                id="description"
                value={data.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                rows={4}
                maxLength={maxChars}
                className="w-full px-3 pt-6 pb-2 pr-10 bg-transparent border-0 rounded-xl resize-none focus:outline-none focus:ring-0 text-slate-900 placeholder-slate-400 text-xs leading-relaxed"
                placeholder="Describe scope, constraints, integrations, and outcomes..."
                autoFocus
              />

              <div className="px-3 pb-2 flex items-center justify-between text-[10px] text-slate-500">
                <div className="flex items-center gap-2">
                  <div className={`w-14 h-1 bg-slate-100 rounded-full overflow-hidden ${charPercentage > 90 ? 'ring-1 ring-amber-500' : ''
                    }`}>
                    <div
                      className={`h-full transition-all duration-300 ${charPercentage > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-blue-600'
                        }`}
                      style={{ width: `${Math.min(charPercentage, 100)}%` }}
                    />
                  </div>
                  <span className={charPercentage > 90 ? 'font-semibold text-amber-700' : 'font-medium'}>
                    {charCount}/{maxChars}
                  </span>
                </div>
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

      {/* Validation Gate Feedback */ }
  {
    validationResult && !validationResult.isValid && !validationDismissed && (
      <div className={`rounded-xl border-2 p-3 animate-in fade-in slide-in-from-top-2 duration-300 ${isValidationBlocking
        ? 'border-red-300 bg-gradient-to-br from-red-50 via-white to-red-50'
        : 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50'
        }`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isValidationBlocking
            ? 'bg-gradient-to-br from-red-500 to-red-600'
            : 'bg-gradient-to-br from-amber-500 to-amber-600'
            }`}>
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <h4 className={`text-sm font-semibold ${isValidationBlocking ? 'text-red-900' : 'text-amber-900'
                }`}>
                {isValidationBlocking ? 'Requisito non valido' : 'Attenzione'}
              </h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isValidationBlocking
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
                }`}>
                {validationResult.category === 'nonsense' && 'Testo non sensato'}
                {validationResult.category === 'too_vague' && 'Troppo generico'}
                {validationResult.category === 'not_software' && 'Non è software'}
                {validationResult.category === 'off_topic' && 'Fuori contesto'}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${isValidationBlocking ? 'text-red-800' : 'text-amber-800'
              }`}>
              {validationResult.reason}
            </p>
            {validationResult.suggestions && validationResult.suggestions.length > 0 && (
              <ul className="text-[10px] text-slate-600 space-y-0.5 mt-1">
                {validationResult.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
            {isValidationWarning && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setValidationDismissed(true)}
                  className="h-7 text-[11px] text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                >
                  Procedi comunque
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  {/* Validation passed indicator */ }
  {
    validationResult?.isValid && (
      <div className="flex items-center gap-2 text-[11px] text-emerald-700 px-1">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span className="font-medium">Requisito validato</span>
      </div>
    )
  }

  <div className="flex justify-end pt-3 border-t border-slate-200">
    <Button
      onClick={handleNextWithValidation}
      disabled={!canProceed || isValidating || !!isValidationBlocking}
      size="lg"
      className="h-10 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
    >
      {isValidating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          <span className="font-semibold text-sm">Validazione in corso...</span>
        </>
      ) : (
        <>
          <span className="font-semibold text-sm">Next: AI Understanding</span>
          <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </>
      )}
    </Button>
  </div>
    </div >
  );
}
