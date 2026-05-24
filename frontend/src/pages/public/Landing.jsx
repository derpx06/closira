import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  MapPin,
  PhoneCall,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Ticket,
  TriangleAlert,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const quickStats = [
  { label: 'Channels Supported', value: '3' },
  { label: 'Workflow Stages', value: '4' },
  { label: 'Qualification Questions', value: '2-3' },
  { label: 'Hallucination Policy', value: 'Zero Guessing' },
];

const coreCapabilities = [
  {
    title: 'SOP-Grounded FAQ Answering',
    body: 'Closira answers inbound customer questions using only your SOP source and avoids unsupported claims.',
    icon: ScanSearch,
  },
  {
    title: 'Structured Lead Qualification',
    body: 'The AI asks 2-3 targeted questions such as business type, team size, and current tools, then stores key responses.',
    icon: UsersRound,
  },
  {
    title: 'Confidence-Based Escalation',
    body: 'Closira escalates to a human when confidence is low, the request is out-of-scope, sentiment is angry, or escalation is requested.',
    icon: TriangleAlert,
  },
  {
    title: 'Clean Session Summaries',
    body: 'Each conversation ends with a structured summary: customer intent, details collected, SOP gaps, and next recommended action.',
    icon: ClipboardList,
  },
  {
    title: 'Safe and Reliable AI Behaviour',
    body: 'Prompt design includes strict boundaries, consistent tone, and explicit rules for graceful fallback when data is missing.',
    icon: ShieldCheck,
  },
  {
    title: 'Agentic Workflow Logic',
    body: 'Multi-step orchestration handles intake, qualification, escalation checks, and final reporting in one reliable workflow.',
    icon: BrainCircuit,
  },
];

const workflow = [
  {
    title: 'FAQ Answering',
    detail: 'Respond to customer questions directly from SOP data and avoid hallucinations.',
    icon: CheckCircle2,
  },
  {
    title: 'Lead Qualification',
    detail: 'Ask 2-3 structured questions, capture answers, and prepare a qualification snapshot.',
    icon: UsersRound,
  },
  {
    title: 'Escalation Detection',
    detail: 'Trigger handoff for low confidence, out-of-scope requests, complaints, or explicit human-request signals.',
    icon: TriangleAlert,
  },
  {
    title: 'Conversation Summary',
    detail: 'Generate a final structured summary with intent, key details, SOP gaps, and recommended next action.',
    icon: ClipboardList,
  },
];

const sopHighlights = [
  'Business: Bloom Aesthetics Clinic',
  'Hours: Mon-Sat, 9 am-7 pm',
  'Services: Botox (from £200), Fillers (from £250), Consultations (free)',
  'Booking: WhatsApp or website, 24hr cancellation required',
  'Escalate on complaint, medical question, pricing negotiation, or >2 unanswered questions',
];

const footerGroups = [
  {
    title: 'Platform',
    items: ['FAQ Engine', 'Lead Qualification', 'Escalation Layer', 'Session Summaries'],
  },
  {
    title: 'Use Cases',
    items: ['WhatsApp Support', 'Email Triage', 'Phone Follow-up', 'SMB Operations'],
  },
  {
    title: 'Deliverables',
    items: ['prompt_design.md', 'test_transcripts/', 'README.md', 'Prototype Walkthrough'],
  },
];

const Landing = () => {
  const { isAuthenticated } = useAuth();
  const currentYear = new Date().getFullYear();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-root relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f0f9ff_38%,_#ffffff_80%)] text-slate-900">
      <div className="landing-noise pointer-events-none absolute inset-0 opacity-55" />
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="landing-orb landing-orb-a pointer-events-none absolute -left-24 top-20 h-56 w-56 rounded-full bg-sky-300/35 blur-3xl" />
      <div className="landing-orb landing-orb-b pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-blue-300/25 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="landing-soft-glow inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <Ticket size={18} strokeWidth={2.25} />
          </span>
          Closira
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          <a href="#about" className="hover:text-slate-900">About</a>
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#workflow" className="hover:text-slate-900">Workflow</a>
          <a href="#contact" className="hover:text-slate-900">Contact</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/auth/login" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-white sm:px-4">
            Login
          </Link>
          <Link to="/auth/signup" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark sm:px-4">
            Get Started
          </Link>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-14 pt-4 md:px-10 md:pb-20">
        <section id="about" className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="landing-fade-up space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
              <Sparkles size={14} />
              AI-Powered Customer Communication
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
                Closira helps SMBs respond faster, safer, and smarter.
              </h1>
              <p className="landing-copy max-w-xl text-lg text-slate-600 md:text-xl">
                Closira handles inbound enquiries across WhatsApp, email, and phone using business-defined SOPs to answer accurately, qualify leads, schedule follow-ups, and escalate to human agents when needed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/auth/signup" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-primary-dark">
                Launch Workspace
                <ArrowRight size={16} />
              </Link>
              <Link to="/auth/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Open Dashboard
              </Link>
            </div>

            <div className="grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickStats.map((item) => (
                <article key={item.label} className="landing-card-hover rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
                  <p className="text-xl font-bold text-slate-900">{item.value}</p>
                  <p className="landing-copy mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="landing-fade-up-delayed landing-glass rounded-3xl border border-cyan-100 bg-white/95 p-6 shadow-xl shadow-cyan-100/60 backdrop-blur md:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Sample SOP Snapshot</p>
            <h2 className="mt-2 text-xl font-bold text-slate-800">Bloom Aesthetics Clinic</h2>
            <ul className="landing-copy mt-4 space-y-2 text-sm text-slate-600">
              {sopHighlights.map((item) => (
                <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">{item}</li>
              ))}
            </ul>
          </aside>
        </section>

        <section id="features" className="landing-section-reveal mt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Platform Highlights</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Core intelligence behind every conversation</h2>
            </div>
            <p className="landing-copy max-w-md text-sm text-slate-600">
              Designed for practical SMB customer support where safety, clarity, and reliable escalation matter.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreCapabilities.map(({ title, body, icon }) => (
              <article key={title} className="landing-card-hover landing-glass rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="inline-flex rounded-xl bg-primary/10 p-2 text-primary">
                  {React.createElement(icon, { size: 20 })}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-800">{title}</h3>
                <p className="landing-copy mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="landing-section-reveal mt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Assignment Workflow</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Four mandatory conversation stages</h2>
            </div>
            <p className="landing-copy max-w-md text-sm text-slate-600">
              One session flow from first customer question to final summary and next-action recommendation.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step, index) => (
              <article key={step.title} className="landing-card-hover landing-glass rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="inline-flex rounded-lg bg-cyan-50 p-2 text-cyan-700">
                    {React.createElement(step.icon, { size: 18 })}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{step.title}</h3>
                <p className="landing-copy mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section-reveal mt-20">
          <div className="landing-glass rounded-3xl border border-cyan-100 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96)_0%,_rgba(240,249,255,0.92)_52%,_rgba(219,234,254,0.9)_100%)] p-8 shadow-xl shadow-cyan-100/60 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                  <Clock3 size={14} />
                  Ready for Real Customer Interactions
                </p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
                  Build safer AI support flows with clear escalation logic.
                </h3>
                <p className="landing-copy mt-2 text-sm text-slate-600 md:text-base">
                  Implement prompt design, SOP-grounded answers, escalation detection, and test transcripts in one clean prototype.
                </p>
              </div>

              <Link to="/auth/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700">
                Start Building
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="relative mt-16 border-t border-slate-200/70 bg-white/85">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] md:px-10">
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-900">Closira</p>
            <p className="landing-copy mt-3 max-w-sm text-sm text-slate-600">
              AI-powered customer communication platform for SMBs across WhatsApp, email, and phone.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
              <ul className="landing-copy mt-3 space-y-2 text-sm text-slate-600">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 border-t border-slate-200/70 px-6 py-4 text-xs text-slate-500 md:flex-row md:items-center md:px-10">
          <p>Copyright {currentYear} Closira. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><Mail size={13} />support@closira.com</span>
            <span className="inline-flex items-center gap-1.5"><PhoneCall size={13} />+91 80000 12345</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={13} />Pune</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
