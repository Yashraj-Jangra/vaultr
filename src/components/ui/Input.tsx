import React, { InputHTMLAttributes } from 'react';

export const Input = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => {
  return (
    <input
      className={`w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline-none focus:border-[var(--border-hover)] transition-colors shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] ${className}`}
      {...props}
    />
  );
};
