import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const Unauthorized = () => {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your current role does not have permission to open this Closira route.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Return to Closira Dashboard
        </Link>
      </div>
    </div>
  );
};

export default Unauthorized;
