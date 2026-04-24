import React, { HTMLAttributes } from 'react';

export const Card = ({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={`border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)] shadow-[0_2px_16px_rgba(0,0,0,0.4)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
