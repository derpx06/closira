import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({
  title = 'No data available',
  description = 'There are no records to show right now.',
  actionLabel,
  onAction,
  icon = Inbox,
}) => {
  const IconComponent = icon;

  return (
    <div className="panel-card py-14 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
        <IconComponent size={28} />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
