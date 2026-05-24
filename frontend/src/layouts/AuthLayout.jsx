import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BadgeCheck, ShieldCheck, Sparkles, Ticket } from 'lucide-react';

const AuthLayout = () => {
  const location = useLocation();
  const isSignup = location.pathname.includes('/auth/signup');

  return (
    <div className="auth-root relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0f2fe_0%,_#f8fafc_44%,_#ffffff_78%)] p-4 md:p-6">
      <div className="auth-orb auth-orb-a pointer-events-none absolute -left-16 top-20 h-52 w-52 rounded-full bg-cyan-300/35 blur-3xl" />
      <div className="auth-orb auth-orb-b pointer-events-none absolute right-0 top-12 h-64 w-64 rounded-full bg-blue-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur md:min-h-[calc(100vh-3rem)]">
        <aside className="hidden w-[43%] flex-col justify-between border-r border-slate-200 bg-[linear-gradient(145deg,_#082f49_0%,_#0f172a_45%,_#1e3a8a_100%)] p-10 text-white lg:flex">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-900">
                <Ticket size={16} />
              </span>
              Closira
            </Link>

            <h2 className="mt-10 text-3xl font-bold leading-tight">
              {isSignup
                ? 'Launch your Closira workspace and start handling customer conversations in minutes.'
                : 'Welcome back to your Closira operations console.'}
            </h2>
            <p className="auth-copy mt-4 text-sm leading-relaxed text-blue-100/90">
              AI-powered control for SOP-grounded replies, escalation, and team collaboration.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
              <BadgeCheck size={18} className="mt-0.5 shrink-0 text-cyan-200" />
              <p className="auth-copy text-sm text-slate-100">Monitor enquiry lifecycles, qualification status, and escalation outcomes with role-based dashboards.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-cyan-200" />
              <p className="auth-copy text-sm text-slate-100">Keep response commitments on track from first message to final handoff.</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-white/10 p-3">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-cyan-200" />
              <p className="auth-copy text-sm text-slate-100">Reduce agent overhead with SOP-driven automation and AI-assisted workflows.</p>
            </div>
          </div>
        </aside>

        <main className="w-full overflow-y-auto p-6 sm:p-8 lg:w-[57%] lg:px-10 lg:py-9">
          <header className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Secure Access</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {isSignup ? 'Register your Closira organization' : 'Sign in to your account'}
            </h1>
            <p className="auth-copy mt-2 text-sm text-slate-600">
              {isSignup
                ? 'Set up your company profile and configure teams, conversation queues, and escalation rules.'
                : 'Access your Closira workspace to manage conversations, escalations, and follow-ups.'}
            </p>
          </header>

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
