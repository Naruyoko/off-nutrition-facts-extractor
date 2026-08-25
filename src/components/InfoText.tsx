import React, { ReactNode } from 'react';
import { Info } from 'lucide-react';

export const InfoText: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className={`text-[11px] text-slate-400 flex items-center gap-1.5 text-center sm:text-left`}>
      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>{children}</span>
    </div>
  );
};
