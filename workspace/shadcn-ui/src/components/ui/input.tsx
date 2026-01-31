import * as React from 'react';

import { cn } from '@/lib/utils';
import { getBaseInputClasses, type InputState } from './base-input';

export interface InputProps extends React.ComponentProps<'input'> {
  state?: InputState;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state, disabled, ...props }, ref) => {
    return (
      <input
        type={type}
        disabled={disabled}
        className={cn(
          getBaseInputClasses(disabled ? 'disabled' : state),
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
