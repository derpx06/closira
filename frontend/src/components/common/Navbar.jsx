import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Menu, LogOut, User, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const Navbar = ({ toggleMobileMenu }) => {
  const { user, displayRole, logout } = useAuth(); // Pull global session context

  const handleLogout = () => {
    logout();
    toast.success('You have been logged out.');
  };

  const userName = user?.name || 'Closira Workspace User';
  const userEmail = user?.email || 'user@company.com';
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="relative z-10 w-full border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_50%)]" />
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left side: Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none md:hidden"
            onClick={toggleMobileMenu}
            aria-label="Toggle Menu"
          >
            <Menu size={24} />
          </button>
          <div className="hidden min-w-[220px] md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Closira Intelligence Layer</p>
            <p className="text-sm font-semibold tracking-tight text-slate-900">Conversation Operations Console</p>
          </div>
          <span className="ml-1 text-sm font-semibold text-slate-800 md:hidden">Closira</span>
        </div>

        {/* Right side: User Profile, Role Badge, Logout */}
        <div className="ml-auto flex items-center gap-3 sm:gap-4">

          {/* Role Badge - Hidden on very small screens for cleanliness */}
          {displayRole && (
            <span className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary sm:inline-flex">
              <ShieldCheck size={13} />
              {displayRole}
            </span>
          )}

          {/* User Identity Segment */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm sm:gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-[linear-gradient(145deg,_#0f172a,_#1e293b)] text-sm font-semibold text-white shadow-[0_10px_25px_-18px_rgba(15,23,42,1)]">
                {userInitial === 'U' ? <User size={16} /> : userInitial}
              </div>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="max-w-[190px] truncate text-sm font-semibold text-slate-800">{userName}</span>
                <span className="max-w-[210px] truncate text-xs text-slate-500">{userEmail}</span>
              </div>
            </div>

            {/* Secure Logout Action */}
            <button
              onClick={handleLogout}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
              title="Log out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;
