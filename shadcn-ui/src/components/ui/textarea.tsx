import * as React from 'react';

import { cn } from '@/lib/utils';
import { getBaseInputClasses, type InputState } from './base-input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: InputState;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, state, disabled, ...props }, ref) => {
    return (
      <textarea
        disabled={disabled}
        className={cn(
          getBaseInputClasses(disabled ? 'disabled' : state),
          'min-h-[80px] resize-vertical',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
