// Chunk 6 form primitives — semantic-token, uniform sizing.
//
// The legacy `ui/input.tsx` (chunk 3 chunky h-11 white card) and
// `ui/select.tsx` (chunk 6 C.8 h-8 pill chip) target two different use
// cases: Input is for prominent standalone fields (LoginPage), Select is
// for filter chips next to other chips. Mixing them inside dialog forms
// produces visual chaos — different heights, shapes, font sizes.
//
// These primitives are the form-context flavor: identical h, padding,
// border, focus ring, semantic colors. Use them inside Dialog forms.
// AdminCenter create/edit dialogs are the primary consumer.

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Single source of truth for form-field box styles. Keep both inputs and
// selects locked to the same shape so a 2-col grid never visually breaks.
const FORM_FIELD_BOX =
  'flex h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm';

export const FormInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input ref={ref} type={type} className={cn(FORM_FIELD_BOX, className)} {...props} />
  ),
);
FormInput.displayName = 'FormInput';

export const FormSelect = forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(FORM_FIELD_BOX, 'appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
FormSelect.displayName = 'FormSelect';

export const FormTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
FormTextarea.displayName = 'FormTextarea';

/**
 * Standard label + control + error wrapper. Pairs with FormInput/FormSelect/
 * FormTextarea to give every form row uniform spacing.
 */
export const FormField: React.FC<{
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ label, required, error, hint, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="block text-sm font-medium text-foreground">
      {label}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-xs text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);
