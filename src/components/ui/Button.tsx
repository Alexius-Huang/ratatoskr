import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary';
type Size = 'sm' | 'md';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant: Variant;
  size?: Size;
};

const BASE = 'rounded transition-colors';

const VARIANT: Record<Variant, string> = {
  primary:
    'font-medium bg-nord-10 text-nord-6 hover:bg-nord-9 disabled:opacity-50',
  secondary:
    'text-nord-4 hover:text-nord-6 border border-nord-3',
  tertiary:
    'font-medium bg-nord-3 text-nord-4 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-nord-2 enabled:hover:text-nord-6',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant,
  size = 'sm',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]}`}
      {...rest}
    />
  );
}
