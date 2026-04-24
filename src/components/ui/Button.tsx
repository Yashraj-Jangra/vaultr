import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
}

export const Button = ({ children, className = '', variant = 'default', ...props }: ButtonProps) => {
  const styles: Record<string, string> = {
    default: 'border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-hover)] hover:text-[var(--fg)] bg-[var(--surface)]',
    primary: 'bg-neutral-100 text-neutral-900 hover:bg-white shadow-[0_2px_8px_rgba(255,255,255,0.06)]',
    ghost: 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
    danger: 'text-red-500 hover:text-red-400',
  };

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
