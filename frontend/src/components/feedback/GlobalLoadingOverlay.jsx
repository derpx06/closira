import React from 'react';
import { Loader2 } from 'lucide-react';
import { useGlobalLoading } from '../../contexts/GlobalLoadingContext';

const GlobalLoadingOverlay = () => {
  const { isLoading } = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px]">
      <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <Loader2 size={18} className="animate-spin text-primary" />
        <span className="text-sm font-semibold text-slate-700">Processing request...</span>
      </div>
    </div>
  );
};

export default GlobalLoadingOverlay;
