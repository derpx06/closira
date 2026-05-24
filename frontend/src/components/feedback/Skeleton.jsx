import React from 'react';

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

export const StatCardsSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="panel-card space-y-3 p-6">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-9 w-24" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 7, columns = 5 }) => (
  <div className="panel-card overflow-hidden p-0">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
      <SkeletonBlock className="h-4 w-40" />
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 px-6 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonBlock key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const CardGridSkeleton = ({ cards = 4 }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {Array.from({ length: cards }).map((_, index) => (
      <div key={index} className="panel-card space-y-3 p-5">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
      </div>
    ))}
  </div>
);
