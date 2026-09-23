import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { formatAmount, parseAmount } from '@/shared/format/money';

export type CfFieldKind = 'text' | 'amount' | 'number' | 'decimal';

type CfFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  kind?: CfFieldKind;
};

function amountText(value: string) {
  const parsed = parseAmount(value);
  return parsed == null ? '' : formatAmount(parsed);
}

export const CfField = forwardRef<HTMLInputElement, CfFieldProps>(function CfField(
  { kind = 'text', className = '', onInput, onChange, inputMode, value, ...props },
  ref,
) {
  const mode = inputMode ?? (kind === 'decimal' ? 'decimal' : kind === 'text' ? undefined : 'numeric');
  const shown = kind === 'amount' && value != null && value !== '' ? amountText(String(value)) : value;

  const handleInput: NonNullable<CfFieldProps['onInput']> = (event) => {
    const input = event.currentTarget;
    if (kind === 'amount') {
      const next = amountText(input.value);
      if (input.value !== next) {
        input.value = next;
      }
    } else if (kind === 'number') {
      const next = input.value.replace(/[^\d]/g, '');
      if (input.value !== next) {
        input.value = next;
      }
    }
    onInput?.(event);
    onChange?.(event as unknown as ChangeEvent<HTMLInputElement>);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={mode}
      autoComplete="off"
      {...(shown !== undefined ? { value: shown } : {})}
      {...props}
      className={['form-control', 'cf-field', kind === 'amount' ? 'cf-amount' : '', className].filter(Boolean).join(' ')}
      onInput={handleInput}
    />
  );
});
