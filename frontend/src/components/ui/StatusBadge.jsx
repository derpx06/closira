import React from 'react';

const StatusBadge = ({ status }) => {
  // Map internal database statuses to accessible Tailwind UI strings
  const getBadgeStyling = (currentStatus) => {
    const normalized = String(currentStatus || '').trim().toLowerCase();
    switch (normalized) {
      case 'approved':
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const label = (() => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'Pending';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  })();

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyling(status)}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
