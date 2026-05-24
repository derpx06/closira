import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ChevronRight,
  DatabaseZap,
  LayoutDashboard,
  Link2,
  MessageCircle,
  MessagesSquare,
  Ticket,
  Target,
  UsersRound,
  X,
} from 'lucide-react';


const Sidebar = ({ isMobileOpen, setMobileOpen }) => {
  const { role } = useAuth();
  const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
  const isAdmin = normalizedRole === 'admin';

  const primaryNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, exact: true },
    { label: 'Queries', path: '/queries', icon: MessagesSquare, exact: true },
    { label: 'Leads', path: '/leads', icon: Target, exact: true },
    { label: 'Chat', path: '/chat', icon: MessageCircle, exact: true },
    { label: 'Connections', path: '/connections', icon: Link2, exact: true },
  ];

  const workflowNavItems = [];

  const adminNavItems = [];

  if (isAdmin) {
    adminNavItems.push({ label: 'Teams', path: '/teams', icon: UsersRound, exact: true });
    adminNavItems.push({ label: 'Knowledge Hub', path: '/knowledge-base', icon: DatabaseZap, exact: true });
  }


  const handleMobileClose = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const renderNavList = (items) => (
    <div className="space-y-2">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={!!item.exact}
          onClick={handleMobileClose}
          className={({ isActive }) =>
            `group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
              isActive
                ? 'border-primary/35 bg-[linear-gradient(110deg,_rgba(219,234,254,0.9)_0%,_rgba(239,246,255,0.9)_42%,_rgba(255,255,255,0.95)_100%)] text-slate-900 shadow-[0_10px_25px_-22px_rgba(15,23,42,1)]'
                : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white/95 hover:text-slate-900 hover:shadow-[0_10px_20px_-20px_rgba(15,23,42,0.8)]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all ${
                  isActive ? 'bg-primary opacity-100' : 'bg-transparent opacity-0 group-hover:opacity-100'
                }`}
              />
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-[0_8px_20px_-10px_rgba(29,78,216,0.95)]'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}
              >
                {React.createElement(item.icon, { size: 16 })}
              </span>
              <span className="flex-1">{item.label}</span>
              <ChevronRight
                size={16}
                className={`transition-all ${
                  isActive
                    ? 'translate-x-0 text-primary opacity-100'
                    : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`}
              />
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-[1px] transition-opacity md:hidden"
          onClick={handleMobileClose}
        />
      )}

      {/* Core Navigation Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_36%,_#f1f5f9_100%)] shadow-xl shadow-slate-900/10 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 md:shadow-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_56%)]" />
        <div className="pointer-events-none absolute right-0 top-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />

        {/* Brand Header */}
        <div className="relative flex items-center justify-between border-b border-slate-200/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,1)]">
              <Ticket size={18} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Closira Workspace</p>
              <p className="text-base font-bold tracking-tight text-slate-900">Closira</p>
            </div>
          </div>

          {/* Mobile close button visible only when mobile menu is open */}
          <button
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none md:hidden"
            onClick={handleMobileClose}
            aria-label="Close sidebar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(100vh-4.5rem)] flex-col">
          {/* Vertical Navigation Links */}
          <nav className="soft-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-5">
            <section>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Core Navigation</p>
              {renderNavList(primaryNavItems)}
            </section>

            {workflowNavItems.length > 0 && (
              <section>
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Workflow</p>
                {renderNavList(workflowNavItems)}
              </section>
            )}

            {adminNavItems.length > 0 && (
              <section>
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Admin Controls</p>
                {renderNavList(adminNavItems)}
              </section>
            )}
          </nav>

          {/* <div className="border-t border-slate-200/90 p-4">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <BadgeCheck size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">System Status</p>
                  <p className="text-xs text-slate-500">All services operational</p>
                </div>
              </div>
              <div className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Role: {isAdmin ? 'Admin' : 'Agent'}
              </div>
            </div>
          </div> */}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
