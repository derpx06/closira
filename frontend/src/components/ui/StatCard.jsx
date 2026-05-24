import React from 'react';

const StatCard = ({ title, value, icon, valueColorClass = 'text-slate-900', trend, description }) => {
  return (
    <div className="panel-card flex flex-col justify-between p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <h3 className={`text-3xl font-bold ${valueColorClass}`}>
            {value}
          </h3>
        </div>

        {icon && (
          <div className="rounded-lg bg-slate-50 p-3 text-slate-400">
            {icon}
          </div>
        )}
      </div>

      {(trend || description) && (
        <div className="mt-4 flex items-center text-sm">
          {trend && (
            <span className={`flex items-center gap-1 font-medium ${trend.isUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.isUp ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {description && (
            <span className={`text-slate-500 ${trend ? 'ml-2' : ''}`}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
